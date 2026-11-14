import { describe, expect, it } from 'vitest'
import { LANGUAGES } from './languages'
import { formatIsoDate, formatMonth, formatNumber } from './format'
import { createSampleProject } from '../samples/automatizace'
import { ProjectSchema } from '../model/schema'
import { schedule } from '../engine/schedule'

/** Všechny klíče překladového souboru jako "a.b.c" (bez koncovek množného čísla _one/_few…). */
function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k))
}
const baseKeys = (translation: unknown) =>
  new Set(keysOf(translation).map((k) => k.replace(/_(zero|one|two|few|many|other)$/, '')))

describe('překlady', () => {
  const [reference, ...others] = LANGUAGES

  it.each(others)('jazyk $code má stejné klíče jako čeština', (language) => {
    expect([...baseKeys(language.translation)].sort()).toEqual([...baseKeys(reference!.translation)].sort())
  })

  it.each(LANGUAGES)('jazyk $code nemá prázdné texty', (language) => {
    const empty = keysOf(language.translation).filter((key) => {
      const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], language.translation)
      return typeof value === 'string' && value.trim() === ''
    })
    expect(empty).toEqual([])
  })
})

describe('formát data a čísel', () => {
  it('datum podle jazyka, bez posunu časovým pásmem', () => {
    expect(formatIsoDate('2026-11-14', 'cs')).toBe('14. 11. 2026')
    expect(formatIsoDate('2026-11-14', 'en')).toBe('14/11/2026')
  })

  it('názvy měsíců podle jazyka', () => {
    expect(formatMonth(2026, 11, 'cs', 'withYear')).toBe('listopad 2026')
    expect(formatMonth(2026, 11, 'cs', 'long')).toBe('listopad')
    expect(formatMonth(2026, 11, 'en', 'withYear')).toBe('November 2026')
    expect(formatMonth(2027, 1, 'en', 'short')).toBe('Jan')
  })

  it('čísla podle jazyka', () => {
    expect(formatNumber(1250.5, 'cs').replace(/\s/g, ' ')).toBe('1 250,5')
    expect(formatNumber(1250.5, 'en')).toBe('1,250.5')
  })
})

describe('vzorový projekt', () => {
  it.each(LANGUAGES)('v jazyce $code projde kontrolou schématu', (language) => {
    const translate = (key: string): string =>
      String(key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], language.translation))
    const result = ProjectSchema.safeParse(createSampleProject(translate, language.code, '2027-01-04'))
    expect(result.success).toBe(true)
    expect(result.data?.tasks.length).toBeGreaterThanOrEqual(15)
  })

  it('má vazby bez kruhů a všechny činnosti dostanou termín', () => {
    const translate = (key: string) => key
    const project = createSampleProject(translate, 'cs', '2027-01-04')
    const result = schedule(project)
    expect(result.cycleTaskIds.size).toBe(0)
    for (const task of project.tasks.filter((t) => t.kind !== 'phase')) {
      expect(result.tasks.get(task.id)?.start).not.toBeNull()
    }
    // Délka celého projektu odpovídá zadání (6–9 měsíců).
    expect(result.projectFinish! > '2027-07-01' && result.projectFinish! < '2027-10-31').toBe(true)
  })
})
