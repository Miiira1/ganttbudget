import { describe, expect, it } from 'vitest'
import { clampWidth, COLUMNS, DEFAULT_WIDTHS, MAX_WIDTH, sanitizeWidths } from './columnWidths'

describe('šířky sloupců tabulky', () => {
  it('každý sloupec má výchozí šířku aspoň svoje minimum', () => {
    for (const column of COLUMNS) {
      expect(DEFAULT_WIDTHS[column.id]).toBeGreaterThanOrEqual(column.min)
    }
  })

  it('šířka se omezí na rozsah sloupce a zaokrouhlí na celé pixely', () => {
    expect(clampWidth('name', 10)).toBe(COLUMNS.find((c) => c.id === 'name')!.min)
    expect(clampWidth('name', 5000)).toBe(MAX_WIDTH)
    expect(clampWidth('name', 251.6)).toBe(252)
  })

  it('uložené šířky z prohlížeče se zkontrolují: neplatné a chybějící → výchozí', () => {
    const widths = sanitizeWidths({ name: 400, notes: 'široký', kind: -5, neznamy: 100, start: Number.NaN })
    expect(widths.name).toBe(400)
    expect(widths.notes).toBe(DEFAULT_WIDTHS.notes) // text místo čísla
    expect(widths.kind).toBe(COLUMNS.find((c) => c.id === 'kind')!.min) // záporné → minimum
    expect(widths.start).toBe(DEFAULT_WIDTHS.start) // NaN
    expect(widths.wbs).toBe(DEFAULT_WIDTHS.wbs) // chybí
    expect('neznamy' in widths).toBe(false)
  })

  it('úplně poškozená data → všechny výchozí', () => {
    expect(sanitizeWidths('nesmysl')).toEqual(DEFAULT_WIDTHS)
    expect(sanitizeWidths(null)).toEqual(DEFAULT_WIDTHS)
    expect(sanitizeWidths([1, 2, 3])).toEqual(DEFAULT_WIDTHS)
  })
})
