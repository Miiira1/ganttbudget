/**
 * Export kontingenční tabulky (fáze 8) do XLSX / CSV – čistá funkce, testy v analysisExport.test.ts.
 * Řádky: popisky úrovní řádků, hodnoty sloupců, Celkem; poslední řádek = součty sloupců.
 * Náklady v celých jednotkách měny (Kč s haléři), hodiny a počty jako čísla.
 * Ochranu proti vzorcům přidá toCsv / toXlsxSheets.
 */
import type { PivotAgg, PivotMetric, PivotResult } from '../model/pivot'
import type { Cell } from './tableExport'

export interface PivotExportLabels {
  /** Nadpisy sloupců s popisky řádků (1 nebo 2 úrovně). */
  rowHeaders: string[]
  /** Popisek klíče řádku na dané úrovni. */
  label: (level: number, key: string) => string
  columnLabel: (key: string) => string
  total: string
  metric: PivotMetric
  agg: PivotAgg
}

export function buildPivotExport(result: PivotResult, labels: PivotExportLabels): { headers: string[]; rows: Cell[][] } {
  // Peníze (součet, průměr, min, max nákladů) v Kč; počet a hodiny beze změny.
  const convert = (v: number | null): Cell => {
    if (v === null) return null
    if (labels.metric === 'cost' && labels.agg !== 'count') return Math.round(v) / 100
    return Math.round(v * 100) / 100
  }
  const columns = result.columns.map((c) => c.key)
  const valuesFor = (path: string[] | null): Cell[] => [...columns.map((c) => convert(result.value(path, c))), convert(result.value(path, null))]
  const levels = labels.rowHeaders.length
  const rows: Cell[][] = result.rows.map((row) => [
    ...Array.from({ length: levels }, (_, level) => (row.path[level] !== undefined ? labels.label(level, row.path[level]!) : null)),
    ...valuesFor(row.path),
  ])
  rows.push([labels.total, ...Array.from({ length: levels - 1 }, () => null), ...valuesFor(null)])
  return { headers: [...labels.rowHeaders, ...columns.map(labels.columnLabel), labels.total], rows }
}
