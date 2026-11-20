import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../contrast'
import { SERIES_COLORS } from './palette'

/** Pozadí grafů: bílá (světlý vzhled) a slate-900 (tmavý vzhled). */
const LIGHT_BG = '#ffffff'
const DARK_BG = '#262626'

const hex = (classes: string, prefix: string, dark: boolean): string | null => {
  const pattern = new RegExp(`(?:^|\\s)${dark ? 'dark:' : ''}${prefix}-\\[(#[0-9a-f]{6})\\]`, 'i')
  return classes.match(pattern)?.[1] ?? null
}

describe('barvy grafů jsou vidět proti pozadí (WCAG 1.4.11 – grafika ≥ 3 : 1, audit U4)', () => {
  it.each(SERIES_COLORS.map((c, i) => [i, c] as const))('barva %i: výplň, nebo její obrys má ≥ 3 : 1 ve světlém i tmavém vzhledu', (_, color) => {
    for (const [dark, bg] of [
      [false, LIGHT_BG],
      [true, DARK_BG],
    ] as const) {
      const fill = hex(color.fill, 'fill', dark)
      expect(fill).not.toBeNull()
      const edge = hex(color.edge, 'stroke', dark)
      const best = Math.max(contrastRatio(fill!, bg), edge ? contrastRatio(edge, bg) : 0)
      expect(best).toBeGreaterThanOrEqual(3)
    }
  })

  it('čtvereček v legendě má u slabé barvy stejný obrys (ring)', () => {
    for (const color of SERIES_COLORS) {
      const edgeLight = hex(color.edge, 'stroke', false)
      if (edgeLight) expect(color.swatch).toContain(`ring-[${edgeLight}]`)
    }
  })
})
