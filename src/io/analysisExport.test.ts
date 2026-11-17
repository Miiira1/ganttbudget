import { describe, expect, it } from 'vitest'
import { buildPivotExport } from './analysisExport'
import type { PivotResult } from '../model/pivot'

describe('export kontingenční tabulky', () => {
  it('dvě úrovně řádků, sloupce a součty; náklady v Kč, prázdné buňky prázdné', () => {
    const values: Record<string, number> = { 'A|': 1_000, 'A|x': 1_000, 'A›k|': 1_000, 'A›k|x': 1_000, '|': 1_000, '|x': 1_000 }
    const result: PivotResult = {
      rows: [{ path: ['A'] }, { path: ['A', 'k'] }],
      columns: [{ key: 'x' }, { key: 'y' }],
      periods: [],
      value: (path, col) => values[`${(path ?? []).join('›')}|${col ?? ''}`] ?? null,
      tagDuplicates: false,
    }
    const table = buildPivotExport(result, {
      rowHeaders: ['Fáze', 'Druh'],
      label: (level, key) => `${level}:${key}`,
      columnLabel: (key) => `C:${key}`,
      total: 'Celkem',
      metric: 'cost',
      agg: 'sum',
    })
    expect(table.headers).toEqual(['Fáze', 'Druh', 'C:x', 'C:y', 'Celkem'])
    expect(table.rows).toEqual([
      ['0:A', null, 10, null, 10],
      ['0:A', '1:k', 10, null, 10],
      ['Celkem', null, 10, null, 10],
    ])
  })
})
