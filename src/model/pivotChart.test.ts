import { describe, expect, it } from 'vitest'
import { chartAvailability, chartSeries, OTHER } from './pivotChart'
import type { PivotConfig, PivotResult } from './pivot'

/** Výsledek tabulky z hodnot { 'řádek|sloupec': hodnota }. */
function result(rows: string[][], columns: string[], values: Record<string, number>): PivotResult {
  return {
    rows: rows.map((path) => ({ path })),
    columns: columns.map((key) => ({ key })),
    periods: [],
    value: (path, col) => values[`${(path ?? []).join('›')}|${col ?? ''}`] ?? null,
    tagDuplicates: false,
  }
}
const config: PivotConfig = { rows: ['category'], column: 'period', metric: 'cost', agg: 'sum', period: 'month', filters: {} }

describe('data pro grafy', () => {
  it('řady = řádky první úrovně (podřádky se nepočítají), hodnoty po sloupcích a celkem', () => {
    const r = result([['A'], ['A', 'x'], ['B']], ['m1', 'm2'], { 'A|m1': 10, 'A|m2': 5, 'A|': 15, 'B|m2': 7, 'B|': 7 })
    expect(chartSeries(r, 9)).toEqual({
      columns: ['m1', 'm2'],
      series: [
        { key: 'A', index: 0, values: [10, 5], total: 15 },
        { key: 'B', index: 1, values: [0, 7], total: 7 },
      ],
    })
  })

  it('víc skupin než barev: od 10. skupiny (podle pořadí, ne velikosti) se sloučí do „Ostatní“', () => {
    const keys = Array.from({ length: 12 }, (_, i) => `k${i}`)
    const values = Object.fromEntries(keys.flatMap((k, i) => [[`${k}|m1`, i + 1], [`${k}|`, i + 1]]))
    const { series } = chartSeries(result(keys.map((k) => [k]), ['m1'], values), 9)
    expect(series.map((s) => s.key)).toEqual([...keys.slice(0, 9), OTHER])
    expect(series.at(-1)).toEqual({ key: OTHER, index: -1, values: [10 + 11 + 12], total: 33 })
  })

  it('které grafy dávají smysl', () => {
    expect(chartAvailability(config)).toEqual({ bar: null, pie: null, line: null, stacked: null })
    expect(chartAvailability({ ...config, column: null })).toEqual({ bar: null, pie: null, line: 'needsColumns', stacked: 'needsColumns' })
    expect(chartAvailability({ ...config, agg: 'avg' })).toEqual({ bar: null, pie: 'notAdditive', line: null, stacked: 'notAdditive' })
    expect(chartAvailability({ ...config, rows: ['tag'] })).toEqual({ bar: null, pie: 'overlapping', line: null, stacked: 'overlapping' })
  })
})
