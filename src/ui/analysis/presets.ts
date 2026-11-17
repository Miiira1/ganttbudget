/**
 * Přednastavené pohledy analýzy pro začátečníky (fáze 8, A-06) a porovnání nastavení.
 * Názvy jsou v překladech (analysis.presets.<id>); testy v presets.test.ts.
 */
import type { PivotConfig } from '../../model/pivot'

export interface Preset {
  id: string
  config: PivotConfig
}

export const PRESETS: readonly Preset[] = [
  { id: 'costByCategoryMonth', config: { rows: ['category'], column: 'period', metric: 'cost', agg: 'sum', period: 'month', filters: {} } },
  { id: 'costByPhaseKind', config: { rows: ['phase', 'kind'], column: null, metric: 'cost', agg: 'sum', period: 'month', filters: {} } },
  { id: 'hoursByWorkerWeek', config: { rows: ['resource'], column: 'period', metric: 'hours', agg: 'sum', period: 'week', filters: { kind: ['labor'] } } },
  { id: 'costByDepartmentQuarter', config: { rows: ['department'], column: 'period', metric: 'cost', agg: 'sum', period: 'quarter', filters: { kind: ['labor'] } } },
  { id: 'tagsByCategory', config: { rows: ['tag'], column: 'category', metric: 'cost', agg: 'sum', period: 'month', filters: {} } },
]

/** Nastavení v jednotném tvaru (filtry seřazené, prázdné vynechané) – pro porovnání. */
function canonical(config: PivotConfig): string {
  const filters = Object.entries(config.filters)
    .filter(([, values]) => values && values.length > 0)
    .map(([dim, values]) => [dim, [...values!].sort()] as const)
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify([config.rows, config.column, config.metric, config.agg, config.period, filters])
}

export function sameConfig(a: PivotConfig, b: PivotConfig): boolean {
  return canonical(a) === canonical(b)
}
