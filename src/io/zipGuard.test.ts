import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { checkZip, ZIP_LIMITS } from './zipGuard'

interface Entry {
  name: string
  data: Uint8Array
  /** 0 = uloženo bez komprese, 8 = deflate */
  method?: 0 | 8
  /** Podvržená velikost po rozbalení v hlavičce (jinak skutečná). */
  declaredSize?: number
}

/** Stlačení deflate (bez hlaviček) – vestavěné v prohlížeči i v Node. */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Sestaví jednoduchý ZIP (místní hlavičky + centrální adresář + konec adresáře). CRC se nekontroluje. */
async function makeZip(entries: Entry[]): Promise<ArrayBuffer> {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const e of entries) {
    const method = e.method ?? 8
    const body = method === 8 ? await deflateRaw(e.data) : e.data
    const name = new TextEncoder().encode(e.name)
    const size = e.declaredSize ?? e.data.length
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(8, method, true)
    local.setUint32(18, body.length, true)
    local.setUint32(22, size, true)
    local.setUint16(26, name.length, true)
    parts.push(new Uint8Array(local.buffer), name, body)
    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)
    dir.setUint16(10, method, true)
    dir.setUint32(20, body.length, true)
    dir.setUint32(24, size, true)
    dir.setUint16(28, name.length, true)
    dir.setUint32(42, offset, true)
    central.push(new Uint8Array(dir.buffer), name)
    offset += 30 + name.length + body.length
  }
  const dirSize = central.reduce((sum, p) => sum + p.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, dirSize, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((sum, p) => sum + p.length, 0))
  let at = 0
  for (const p of all) {
    out.set(p, at)
    at += p.length
  }
  return out.buffer
}

const zeros = (bytes: number) => new Uint8Array(bytes)
const text = (s: string) => new TextEncoder().encode(s)

describe('kontrola ZIP před načtením XLSX (ochrana proti „nafouknutým“ souborům)', () => {
  it('výchozí limity: 50 MB po rozbalení, 2 000 souborů, poměr komprese 200 : 1', () => {
    expect(ZIP_LIMITS).toEqual({ maxTotalBytes: 50 * 1024 * 1024, maxEntries: 2000, maxRatio: 200 })
  })

  it('běžný sešit z ExcelJS projde', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Činnosti')
    for (let i = 1; i <= 200; i++) sheet.addRow([i, `Činnost ${i}`, 5])
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array // v Node je to Buffer (Uint8Array)
    expect(await checkZip(buffer)).toBeNull()
    expect(await checkZip(new Uint8Array(buffer).buffer)).toBeNull() // i čistý ArrayBuffer
  })

  it('malý ZIP s uloženým i stlačeným souborem projde (i když se malý soubor hodně stlačí)', async () => {
    const zip = await makeZip([
      { name: 'a.txt', data: text('ahoj'), method: 0 },
      { name: 'b.xml', data: zeros(500_000) }, // pod 1 MB se poměr komprese neposuzuje
    ])
    expect(await checkZip(zip)).toBeNull()
  })

  it('soubor, který není ZIP, nebo je useknutý → notZip', async () => {
    expect(await checkZip(text('Toto není sešit Excelu').buffer as ArrayBuffer)).toBe('notZip')
    const zip = new Uint8Array(await makeZip([{ name: 'a.xml', data: text('x'.repeat(1000)) }]))
    expect(await checkZip(zip.slice(10).buffer)).toBe('notZip')
  })

  it('celková velikost po rozbalení nad limit → tooLarge', async () => {
    const zip = await makeZip([{ name: 'a.xml', data: zeros(700_000) }, { name: 'b.xml', data: zeros(700_000) }])
    expect(await checkZip(zip, { ...ZIP_LIMITS, maxTotalBytes: 1_000_000 })).toBe('tooLarge')
  })

  it('podezřelý poměr komprese u velkého souboru → ratio', async () => {
    expect(await checkZip(await makeZip([{ name: 'bomba.xml', data: zeros(5_000_000) }]))).toBe('ratio')
  })

  it('příliš mnoho souborů v archivu → tooManyEntries', async () => {
    const zip = await makeZip([1, 2, 3].map((i) => ({ name: `${i}.xml`, data: text('x') })))
    expect(await checkZip(zip, { ...ZIP_LIMITS, maxEntries: 2 })).toBe('tooManyEntries')
  })

  it('hlavička lže o velikosti (rozbalí se víc, než tvrdí) → tooLarge', async () => {
    const zip = await makeZip([{ name: 'lez.xml', data: zeros(3_000_000), declaredSize: 100_000 }])
    expect(await checkZip(zip)).toBe('tooLarge')
  })

  it('mezera mezi centrálním adresářem a jeho koncem (znak předsazených dat) → notZip (audit B1)', async () => {
    // Útočník předsadí skutečný archiv falešným adresářem; kontrola by pak četla jiná data než
    // knihovna, která sešit otevře. Platný sešit má adresář vždy těsně před koncovým záznamem.
    const zip = new Uint8Array(await makeZip([{ name: 'a.xml', data: text('x'.repeat(100)) }]))
    const endAt = zip.length - 22
    const shifted = new Uint8Array(zip.length + 8)
    shifted.set(zip.subarray(0, endAt), 0) // data + centrální adresář
    shifted.set(zip.subarray(endAt), endAt + 8) // 8 bajtů navíc, pak koncový záznam
    expect(await checkZip(zip.buffer)).toBeNull()
    expect(await checkZip(shifted.buffer)).toBe('notZip')
  })

  it('neznámý způsob komprese → unsupported', async () => {
    const zip = new Uint8Array(await makeZip([{ name: 'a.xml', data: text('x'), method: 0 }]))
    // Metodu přepíšeme v centrálním adresáři na 12 (bzip2).
    const view = new DataView(zip.buffer)
    const dirAt = view.getUint32(zip.length - 22 + 16, true)
    view.setUint16(dirAt + 10, 12, true)
    expect(await checkZip(zip.buffer)).toBe('unsupported')
  })
})
