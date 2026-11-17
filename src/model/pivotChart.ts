/**
 * Data pro grafy kontingenční tabulky (fáze 8, A-02) – čisté funkce, testy v pivotChart.test.ts.
 *
 * Řady grafu = řádky první úrovně tabulky (u dvou úrovní jen skupiny). Barva patří skupině
 * podle jejího pořadí, ne podle velikosti (při filtrování se nemění). Barev je omezený počet –
 * skupiny navíc se v grafu sloučí do „Ostatní“ (v tabulce zůstanou všechny), barvy se neopakují.
 */
import type { PivotConfig, PivotResult } from './pivot'

/** Klíč sloučené řady „Ostatní“. */
export const OTHER = '…'

export interface ChartSeriesData {
  key: string
  /** Pořadí skupiny (určuje barvu); -1 = Ostatní. */
  index: number
  /** Hodnoty po sloupcích tabulky (bez sloupců: prázdné). */
  values: number[]
  total: number
}

export function chartSeries(result: PivotResult, maxSeries: number): { columns: string[]; series: ChartSeriesData[] } {
  const columns = result.columns.map((c) => c.key)
  const groups = result.rows.filter((r) => r.path.length === 1).map((r) => r.path[0]!)
  const series: ChartSeriesData[] = groups.map((key, index) => ({
    key,
    index,
    values: columns.map((c) => result.value([key], c) ?? 0),
    total: result.value([key], null) ?? 0,
  }))
  if (series.length <= maxSeries) return { columns, series }
  const rest = series.slice(maxSeries)
  return {
    columns,
    series: [
      ...series.slice(0, maxSeries),
      {
        key: OTHER,
        index: -1,
        values: columns.map((_, i) => rest.reduce((sum, s) => sum + s.values[i]!, 0)),
        total: rest.reduce((sum, s) => sum + s.total, 0),
      },
    ],
  }
}

export type ChartType = 'bar' | 'pie' | 'line' | 'stacked'
/** Proč graf nejde: bez sloupců (čárový, skládaný), hodnoty nejdou sčítat (průměr, min, max), skupiny se překrývají (štítky). */
export type ChartBlocker = 'needsColumns' | 'notAdditive' | 'overlapping'

/** Které typy grafu dávají při daném nastavení smysl (null = lze). */
export function chartAvailability(config: PivotConfig): Record<ChartType, ChartBlocker | null> {
  const additive = config.agg === 'sum' || config.agg === 'count'
  // Štítky v řádcích: řádek činnosti může být ve dvou skupinách – podíly a skládání by klamaly.
  const overlapping = config.rows[0] === 'tag'
  const partOfWhole: ChartBlocker | null = !additive ? 'notAdditive' : overlapping ? 'overlapping' : null
  return {
    bar: null,
    pie: partOfWhole,
    line: config.column ? null : 'needsColumns',
    stacked: !config.column ? 'needsColumns' : partOfWhole,
  }
}
