/**
 * Export tabulky pohledu Sledování (fáze 9, A-05) do XLSX / CSV – čistá funkce, testy v trackingExport.test.ts.
 * Řádky ve stromovém pořadí (název odsazený podle úrovně), termíny baseline a plánu, posun konce,
 * % hotovo a částky Earned Value v celých jednotkách měny; poslední řádek = Celkem.
 * Ochranu proti vzorcům (CSV injection) přidá toCsv / toXlsxSheets.
 */
import type { EarnedValueResult, EvRow } from '../model/earnedValue'
import type { Cell } from './tableExport'

export interface TrackingExportLabels {
  headers: string[]
  wbs: ReadonlyMap<string, string>
  /** Stav položky: nová (není v baseline), jen v baseline (smazaná z plánu), jinak prázdné. */
  status: (row: EvRow) => string
  total: string
}

/** Sloupce s datem a s penězi (indexy) – pro formát v Excelu. */
export const TRACKING_DATE_COLUMNS = new Set([3, 4, 5, 6])
export const TRACKING_MONEY_COLUMNS = new Set([9, 10, 11, 12, 13, 14])

const units = (v: number) => Math.round(v) / 100

export function buildTrackingExport(ev: EarnedValueResult, labels: TrackingExportLabels): { headers: string[]; rows: Cell[][] } {
  const depthOf = (row: EvRow): number => {
    let depth = 0
    for (let parent = row.parentId; parent !== null && depth < 50; parent = ev.byId.get(parent)?.parentId ?? null) depth++
    return depth
  }
  const money = (r: { bac: number; pv: number; ev: number; ac: number }): Cell[] => [units(r.bac), units(r.pv), units(r.ev), units(r.ac), units(r.ev - r.ac), units(r.ev - r.pv)]
  const rows: Cell[][] = ev.rows.map((r) => [
    labels.wbs.get(r.taskId) ?? '',
    `${'   '.repeat(depthOf(r))}${r.name}`,
    labels.status(r),
    r.baselineStart,
    r.baselineFinish,
    r.start,
    r.finish,
    r.finishShift,
    r.percent,
    ...money(r),
  ])
  const t = ev.totals
  rows.push(['', labels.total, '', null, null, null, null, null, t.bac > 0 ? Math.round((t.ev / t.bac) * 100) : 0, ...money(t)])
  return { headers: labels.headers, rows }
}
