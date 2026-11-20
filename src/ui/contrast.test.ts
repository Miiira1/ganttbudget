import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'
import { colorTokens, contrastRatio } from './contrast'

const tokens = colorTokens(css)
const color = (name: string) => {
  const value = tokens[name]
  if (!value) throw new Error(`barva ${name} v index.css chybí`)
  return value
}
const WHITE = '#ffffff'

describe('kontrast barev (WCAG AA, U-06)', () => {
  it('výpočet odpovídá WCAG (černá na bílé 21 : 1, stejné barvy 1 : 1)', () => {
    expect(contrastRatio('#000000', WHITE)).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#777777')).toBe(1)
  })

  /** [popředí, pozadí] – text musí mít aspoň 4,5 : 1. */
  const text: [string, string][] = [
    // světlý vzhled
    ['miro-graphite', 'miro-paper'],
    ['slate-500', 'miro-paper'], // tlumený text
    ['slate-500', 'slate-50'],
    ['slate-600', 'miro-paper'],
    ['slate-700', 'slate-200'],
    ['miro-turquoise-dark', 'miro-paper'], // odkazy, informace
    ['miro-turquoise-dark', 'miro-turquoise-light'],
    ['miro-graphite', 'miro-yellow'], // primární tlačítko
    ['miro-graphite', 'miro-yellow-light'], // kritická rezerva, upozornění
    ['miro-graphite', 'miro-turquoise-light'], // vybraný řádek
    // tmavý vzhled
    ['miro-paper', 'miro-graphite'],
    ['slate-400', 'slate-900'], // tlumený text
    ['slate-400', 'slate-800'],
    ['slate-300', 'slate-800'],
    ['miro-turquoise', 'slate-800'],
    ['miro-yellow-light', 'slate-800'],
  ]
  it.each(text)('text %s na %s ≥ 4,5 : 1', (fg, bg) => {
    expect(contrastRatio(color(fg), bg.startsWith('#') ? bg : color(bg))).toBeGreaterThanOrEqual(4.5)
  })

  /** Grafika (ikony ⚠, fokus, čáry) – aspoň 3 : 1. */
  const graphics: [string, string][] = [
    ['miro-gold', 'miro-paper'], // ⚠ a tečka „neuloženo“
    ['miro-turquoise-dark', 'miro-paper'], // rámeček fokusu, dnešek
    ['miro-turquoise', 'miro-graphite'], // fokus v tmavém vzhledu
    ['miro-yellow', 'miro-graphite'],
  ]
  it.each(graphics)('grafika %s na %s ≥ 3 : 1', (fg, bg) => {
    expect(contrastRatio(color(fg), color(bg))).toBeGreaterThanOrEqual(3)
  })

  it('tlumený text i na čistě bílé (pole formulářů) ≥ 4,5 : 1', () => {
    expect(contrastRatio(color('slate-500'), WHITE)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('slabé šedé se nepoužívají jako text ani ikony', () => {
  // Zdrojové kódy rozhraní jako text (jen pro tuto kontrolu).
  const sources = import.meta.glob('./**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

  it('světlý vzhled: žádné text-slate-300 / 400 (2,2 : 1); tmavý: žádné dark:text-slate-500 / 600', () => {
    const found: string[] = []
    for (const [file, source] of Object.entries(sources)) {
      if (file.endsWith('.test.tsx')) continue
      source.split('\n').forEach((line, i) => {
        if (/(^|[\s"'`{])text-slate-(300|400)\b/.test(line) || /dark:text-slate-(500|600)\b/.test(line)) found.push(`${file}:${i + 1}`)
      })
    }
    expect(found).toEqual([])
  })

  it('text-slate-500 má vždy tmavou variantu – v tmavém vzhledu by měl jen 3 : 1 (audit U1)', () => {
    const found: string[] = []
    for (const [file, source] of Object.entries(sources)) {
      if (file.endsWith('.test.tsx')) continue
      source.split('\n').forEach((line, i) => {
        if (/(^|[\s"'`{])text-slate-500\b/.test(line) && !/dark:text-/.test(line)) found.push(`${file}:${i + 1}`)
      })
    }
    expect(found).toEqual([])
  })

  it('tlumený text v tmavém vzhledu (slate-400 na pozadí slate-800/900) ≥ 4,5 : 1, slate-500 by nestačil', () => {
    expect(contrastRatio(color('slate-400'), color('slate-900'))).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(color('slate-500'), color('slate-900'))).toBeLessThan(4.5)
  })
})
