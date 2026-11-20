import { describe, expect, it } from 'vitest'
import { OVERSCAN, VIRTUALIZE_FROM, visibleRange } from './virtualRows'

const H = 28 // výška řádku

describe('viditelný rozsah řádků (audit R3 – kreslit jen to, co je vidět)', () => {
  it('menší plán (do 300 řádků) se kreslí celý – beze změny proti dřívějšku', () => {
    expect(VIRTUALIZE_FROM).toBe(300)
    expect(visibleRange(5000, 600, 300, H)).toEqual({ first: 0, last: 300 })
    expect(visibleRange(0, 0, 12, H)).toEqual({ first: 0, last: 12 })
  })

  it('velký plán nahoře: viditelné řádky + rezerva pod nimi', () => {
    const r = visibleRange(0, 600, 2000, H) // 600 px ≈ 22 řádků
    expect(r.first).toBe(0)
    expect(r.last).toBeGreaterThanOrEqual(22 + OVERSCAN)
    expect(r.last).toBeLessThan(80)
  })

  it('velký plán uprostřed: rezerva nad i pod, viditelné řádky jsou vždy uvnitř', () => {
    const top = 1000 * H
    const r = visibleRange(top, 600, 2000, H)
    expect(r.first).toBeLessThanOrEqual(1000 - OVERSCAN)
    expect(r.last).toBeGreaterThanOrEqual(1000 + 22 + OVERSCAN)
    expect(r.last - r.first).toBeLessThan(120)
  })

  it('na konci plánu nepřeteče počet řádků', () => {
    expect(visibleRange(1990 * H, 600, 2000, H).last).toBe(2000)
  })

  it('hranice se mění po skupinách – malý posun nepřekresluje (stejný rozsah)', () => {
    expect(visibleRange(1000 * H, 600, 2000, H)).toEqual(visibleRange(1000 * H + 3 * H, 600, 2000, H))
  })

  it('výška okna ještě neznámá (0) → rozumný odhad, ne prázdno', () => {
    const r = visibleRange(0, 0, 2000, H)
    expect(r.first).toBe(0)
    expect(r.last).toBeGreaterThan(40)
  })

  it('pro každý posun obsahuje rozsah celé viditelné okno', () => {
    for (let top = 0; top < 2000 * H; top += 97) {
      const r = visibleRange(top, 600, 2000, H)
      expect(r.first * H).toBeLessThanOrEqual(top)
      expect(r.last * H).toBeGreaterThanOrEqual(Math.min(2000 * H, top + 600))
    }
  })
})
