import { describe, expect, it } from 'vitest'
import cs from '../../i18n/locales/cs.json'
import en from '../../i18n/locales/en.json'
import { PivotConfigSchema } from '../../model/schema'
import { PRESETS, sameConfig } from './presets'

describe('přednastavené pohledy analýzy (A-06)', () => {
  it('každý projde schématem uložených pohledů a má název česky i anglicky', () => {
    for (const preset of PRESETS) {
      expect(PivotConfigSchema.safeParse(preset.config).success).toBe(true)
      expect(cs.analysis.presets[preset.id as keyof typeof cs.analysis.presets]).toBeTruthy()
      expect(en.analysis.presets[preset.id as keyof typeof en.analysis.presets]).toBeTruthy()
    }
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
  })

  it('porovnání nastavení nezávisí na pořadí filtrů a prázdných seznamech', () => {
    const a = { rows: ['category' as const], column: null, metric: 'cost' as const, agg: 'sum' as const, period: 'month' as const, filters: { kind: ['labor', 'material'], tag: [] } }
    const b = { ...a, filters: { kind: ['material', 'labor'] } }
    expect(sameConfig(a, b)).toBe(true)
    expect(sameConfig(a, { ...b, metric: 'hours' })).toBe(false)
    expect(sameConfig(a, { ...b, filters: { kind: ['labor'] } })).toBe(false)
  })
})
