import { describe, expect, it } from 'vitest'
import { childrenOf, depthOf, rootOf } from './mindMap'
import { MAX_OUTLINE_LINES, mindMapToOutline, parseOutline, type OutlineResult } from './outline'
import { MAX_MIND_MAP_DEPTH, MindMapSchema, type MindMap } from './schema'

let seq = 0
const newId = () => `o${++seq}`
const parse = (text: string) => parseOutline(text, 'Můj projekt', newId)

function map(result: OutlineResult): MindMap {
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.map
}
/** Strom jako text „úroveň:text“ v pořadí (do hloubky). */
function flat(m: MindMap): string[] {
  const out: string[] = []
  const walk = (id: string) => {
    const node = m.nodes.find((n) => n.id === id)!
    out.push(`${depthOf(m, id)}:${node.text}`)
    for (const c of childrenOf(m, id)) walk(c.id)
  }
  walk(rootOf(m).id)
  return out
}

describe('odsazený text → mapa', () => {
  it('odsazení tabulátory, jeden řádek nejvýš = střední téma', () => {
    const m = map(parse('Projekt\n\tPříprava\n\t\tAnalýza\n\tRealizace'))
    expect(flat(m)).toEqual(['0:Projekt', '1:Příprava', '2:Analýza', '1:Realizace'])
    expect(MindMapSchema.safeParse(m).success).toBe(true)
  })

  it('odsazení mezerami (2 i 4), prázdné řádky a Windows konce řádků', () => {
    expect(flat(map(parse('Projekt\r\n  A\r\n    A1\r\n\r\n  B')))).toEqual(['0:Projekt', '1:A', '2:A1', '1:B'])
    expect(flat(map(parse('Projekt\n    A\n        A1\n    B')))).toEqual(['0:Projekt', '1:A', '2:A1', '1:B'])
  })

  it('odrážky, číslování a nadpisy se odstraní', () => {
    const text = '# Projekt\n- Příprava\n  * 1.1 Analýza\n  • a) Rozpočet\n- 2. Realizace\n  + 2.1) Montáž'
    expect(flat(map(parse(text)))).toEqual(['0:Projekt', '1:Příprava', '2:Analýza', '2:Rozpočet', '1:Realizace', '2:Montáž'])
  })

  it('víc řádků nejvýš → zabalí se pod název projektu', () => {
    expect(flat(map(parse('Příprava\n  Analýza\nRealizace')))).toEqual(['0:Můj projekt', '1:Příprava', '2:Analýza', '1:Realizace'])
  })

  it('přeskočená úroveň se srovná na nejbližší možnou', () => {
    expect(flat(map(parse('Projekt\n\t\t\tHluboko\n\tMělce')))).toEqual(['0:Projekt', '1:Hluboko', '1:Mělce'])
  })

  it('chyby s číslem řádku: prázdný text, příliš dlouhý řádek, příliš hluboko, příliš mnoho řádků', () => {
    expect(parse('  \n\n - \n')).toEqual({ ok: false, errors: [{ code: 'empty', line: 0 }] })
    const r = parse(`Projekt\n\t${'x'.repeat(201)}`)
    expect(r).toEqual({ ok: false, errors: [{ code: 'tooLong', line: 2 }] })
    const deep = ['Projekt', ...Array.from({ length: MAX_MIND_MAP_DEPTH + 1 }, (_, i) => `${'\t'.repeat(i + 1)}Úroveň ${i + 1}`)].join('\n')
    expect(parse(deep)).toEqual({ ok: false, errors: [{ code: 'tooDeep', line: MAX_MIND_MAP_DEPTH + 2 }] })
    const many = ['Projekt', ...Array.from({ length: MAX_OUTLINE_LINES }, (_, i) => `\tŘádek ${i}`)].join('\n')
    expect(parse(many)).toMatchObject({ ok: false, errors: [{ code: 'tooMany' }] })
  })

  it('obří vložený text (70 000 řádků) skončí srozumitelnou chybou, ne pádem (audit B5)', () => {
    // Safari dovolí funkci nejvýš 65 536 argumentů – Math.min(...řádky) by tu vyhodil výjimku.
    const huge = Array.from({ length: 70_000 }, (_, i) => (i % 2 ? ' a' : 'b')).join('\n') // víc než 65 536 řádků
    expect(huge.length).toBeLessThanOrEqual(200_000)
    expect(() => parse(huge)).not.toThrow()
    expect(parse(huge)).toMatchObject({ ok: false, errors: [{ code: 'tooMany' }] })
  })
})

describe('mapa → odsazený text', () => {
  it('odrážky s odsazením dvěma mezerami a převod tam a zpět dá stejnou mapu', () => {
    const m = map(parse('Projekt\n\tPříprava\n\t\tAnalýza\n\tRealizace'))
    const text = mindMapToOutline(m)
    expect(text).toBe('Projekt\n  - Příprava\n    - Analýza\n  - Realizace\n')
    expect(flat(map(parse(text)))).toEqual(flat(m))
  })
})
