/**
 * Export činností do tabulky (I-03) – čisté funkce, testy v tableExport.test.ts.
 *
 * Sloupce: Č., WBS, Úroveň, Název, Typ, Začátek, Konec, Délka, Předchůdci, Začít nejdříve,
 * % hotovo, Poznámka. Hierarchii při zpětném importu určuje sloupec Úroveň (1, 2, 3…) a pořadí
 * řádků – WBS je jen pro informaci (Excel v CSV někdy převede „1.2“ na datum).
 *
 * Ochrana proti CSV injection (N-11): textová buňka začínající =, +, -, @, tabulátorem nebo CR
 * dostane na začátek apostrof, aby ji Excel nespustil jako vzorec. Import ho zase odstraní.
 */
import Papa from 'papaparse'
import type { ScheduleResult } from '../engine/schedule'
import { depthMap, treeOrder, wbsNumbers } from '../model/hierarchy'
import { formatPredecessorsWith, rowNumbers } from '../model/predecessors'
import type { Project, TaskKind } from '../model/schema'

export type ExportColumn =
  | 'number'
  | 'wbs'
  | 'level'
  | 'name'
  | 'kind'
  | 'start'
  | 'finish'
  | 'duration'
  | 'predecessors'
  | 'constraint'
  | 'percent'
  | 'notes'

export const EXPORT_COLUMNS: ExportColumn[] = [
  'number',
  'wbs',
  'level',
  'name',
  'kind',
  'start',
  'finish',
  'duration',
  'predecessors',
  'constraint',
  'percent',
  'notes',
]

/** Sloupce s datem (v XLSX se zapíšou jako opravdová data). */
export const DATE_COLUMNS: ExportColumn[] = ['start', 'finish', 'constraint']

/** Hodnota buňky: text, číslo, nebo prázdná. Data jako "YYYY-MM-DD". */
export type Cell = string | number | null

export interface ExportTable {
  columns: ExportColumn[]
  rows: Cell[][]
}

/** Projekt + spočítané termíny → řádky tabulky (v pořadí stromu, jako v aplikaci). */
export function buildExportTable(project: Project, result: ScheduleResult, kindLabel: (kind: TaskKind) => string): ExportTable {
  const numbers = rowNumbers(project)
  const wbs = wbsNumbers(project)
  const depths = depthMap(project)
  const rows = treeOrder(project).map((task) => {
    const dates = result.tasks.get(task.id)
    const values: Record<ExportColumn, Cell> = {
      number: numbers.get(task.id) ?? null,
      wbs: wbs.get(task.id) ?? '',
      level: (depths.get(task.id) ?? 0) + 1,
      name: task.name,
      kind: kindLabel(task.kind),
      start: dates?.start ?? null,
      finish: dates?.finish ?? null,
      duration: task.kind === 'phase' ? (dates?.durationDays ?? null) : task.durationDays,
      predecessors: formatPredecessorsWith(numbers, task),
      constraint: task.constraintStart ?? null,
      percent: task.percentComplete,
      notes: task.notes,
    }
    return EXPORT_COLUMNS.map((c) => values[c])
  })
  return { columns: EXPORT_COLUMNS, rows }
}

/**
 * Začátek textu, který by Excel mohl spustit jako vzorec: = + - @ (i plnošířkové ＝＋－＠),
 * i po úvodních mezerách; nebo tabulátor / nový řádek na začátku (audit B6).
 */
export const FORMULA_START = /^(?:[\s　]*[=+\-@＝＋－＠]|[\t\r\n])/

/** Ochrana proti CSV injection: text, který by Excel spustil jako vzorec, dostane apostrof. */
export function protectText(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value
}

/** Tabulka → text CSV: UTF-8 s BOM (Excel pozná češtinu), oddělovač středník, řádky CRLF. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const data = rows.map((row) => row.map((cell) => (typeof cell === 'string' ? protectText(cell) : (cell ?? ''))))
  return `﻿${Papa.unparse({ fields: headers.map(protectText), data }, { delimiter: ';', newline: '\r\n' })}\r\n`
}
