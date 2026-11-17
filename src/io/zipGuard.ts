/**
 * Ochrana proti „nafouknutým“ souborům XLSX (tzv. ZIP bomba) – fáze 13b. ČISTÁ FUNKCE s testy.
 *
 * Soubor XLSX je ZIP archiv. Malý soubor (např. 50 kB) se může rozbalit na gigabajty a zahltit
 * prohlížeč. Proto ho ještě PŘED knihovnou ExcelJS zkontrolujeme:
 *  1. přečteme centrální adresář ZIP (seznam souborů s velikostmi) – počet souborů, celková
 *     velikost po rozbalení a poměr komprese,
 *  2. každý soubor zkusmo rozbalíme po kouscích a počítáme bajty; když se rozbalí víc, než tvrdí
 *     hlavička (podvržený archiv), rozbalování hned zastavíme.
 * Rozbalená data se nikam neukládají, jen se spočítají.
 */

export const ZIP_LIMITS = {
  /** Největší celková velikost všech souborů po rozbalení. */
  maxTotalBytes: 50 * 1024 * 1024,
  /** Nejvíc souborů v archivu (běžný sešit jich má desítky). */
  maxEntries: 2000,
  /** Nejvyšší poměr rozbaleno : stlačeno u souborů nad 1 MB (běžné XML z Excelu má do ~30 : 1). */
  maxRatio: 200,
}

export type ZipLimits = typeof ZIP_LIMITS

/** Proč soubor neprošel: není to ZIP / nepodporovaný ZIP / moc velký / moc souborů / podezřelá komprese. */
export type ZipIssue = 'notZip' | 'unsupported' | 'tooLarge' | 'tooManyEntries' | 'ratio'

/** Chyba při čtení XLSX, který neprošel kontrolou – aplikace ukáže vlastní hlášku. */
export class UnsafeXlsxError extends Error {
  constructor(readonly issue: ZipIssue) {
    super(`unsafe xlsx: ${issue}`)
  }
}

const SIG_END = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50
/** Pod touto velikostí se poměr komprese neposuzuje (malé XML se stlačí hodně a nic nehrozí). */
const RATIO_MIN_BYTES = 1024 * 1024

interface ZipEntry {
  method: number
  compressedSize: number
  size: number
  localOffset: number
}

/** Najde záznam „konec centrálního adresáře“ (hledá se od konce, za ním může být komentář). */
function findEnd(view: DataView): number {
  const last = view.byteLength - 22
  const first = Math.max(0, last - 0xffff)
  for (let at = last; at >= first; at--) if (view.getUint32(at, true) === SIG_END) return at
  return -1
}

/** Přečte centrální adresář; vrátí seznam souborů, nebo důvod odmítnutí. */
function readDirectory(view: DataView, limits: ZipLimits): ZipEntry[] | ZipIssue {
  const end = findEnd(view)
  if (end < 0) return 'notZip'
  const count = view.getUint16(end + 10, true)
  const dirSize = view.getUint32(end + 12, true)
  const dirOffset = view.getUint32(end + 16, true)
  if (count === 0xffff || dirOffset === 0xffffffff) return 'unsupported' // ZIP64 – XLSX do 5 MB ho nepotřebuje
  if (count > limits.maxEntries) return 'tooManyEntries'
  if (dirOffset + dirSize > end) return 'notZip'

  const entries: ZipEntry[] = []
  let total = 0
  let at = dirOffset
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || view.getUint32(at, true) !== SIG_CENTRAL) return 'notZip'
    const entry: ZipEntry = {
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      localOffset: view.getUint32(at + 42, true),
    }
    if (entry.method !== 0 && entry.method !== 8) return 'unsupported' // jen „bez komprese“ a deflate
    total += entry.size
    if (total > limits.maxTotalBytes) return 'tooLarge'
    if (entry.size > RATIO_MIN_BYTES && entry.size / Math.max(entry.compressedSize, 1) > limits.maxRatio) return 'ratio'
    entries.push(entry)
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true)
  }
  return entries
}

/** Rozbalí data po kouscích a jen počítá bajty; nad `max` přestane. Vrací počet, nebo null (poškozená data). */
async function inflatedSize(data: Uint8Array, max: number): Promise<number | null> {
  const reader = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return size
      size += value.byteLength
      if (size > max) {
        await reader.cancel()
        return size
      }
    }
  } catch {
    return null
  }
}

/** Zkontroluje XLSX (ZIP) dřív, než ho otevře ExcelJS. null = v pořádku, jinak důvod odmítnutí. */
export async function checkZip(buffer: ArrayBuffer | Uint8Array, limits: ZipLimits = ZIP_LIMITS): Promise<ZipIssue | null> {
  // Prohlížeč dává ArrayBuffer, Node (testy) Buffer = Uint8Array nad větším polem.
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.byteLength < 22) return 'notZip'
  const entries = readDirectory(view, limits)
  if (!Array.isArray(entries)) return entries

  for (const entry of entries) {
    const at = entry.localOffset
    if (at + 30 > view.byteLength || view.getUint32(at, true) !== SIG_LOCAL) return 'notZip'
    const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
    if (start + entry.compressedSize > view.byteLength) return 'notZip'
    if (entry.method === 0) {
      if (entry.compressedSize !== entry.size) return 'notZip'
      continue
    }
    const size = await inflatedSize(bytes.subarray(start, start + entry.compressedSize), entry.size)
    if (size === null) return 'notZip'
    if (size > entry.size) return 'tooLarge' // hlavička lže – rozbalilo by se víc, než tvrdí
  }
  return null
}
