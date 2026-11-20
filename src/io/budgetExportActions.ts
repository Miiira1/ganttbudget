/**
 * Export rozpočtu do Excelu (listy Řádky a Náběh) a do CSV (Řádky) – akce z menu Soubor (fáze 7, I-04).
 * Data připraví budgetExport.ts (čisté funkce s testy); ExcelJS se načte až při exportu do XLSX.
 */
import type { TFunction } from 'i18next'
import { currencyLabel, formatMonth } from '../i18n/format'
import { splitPeriods } from '../model/periods'
import { getCostTimeline, getCosts, projectStore } from '../store/useProject'
import { showNotice } from '../ui/notice'
import { dayToIso } from '../engine/calendar'
import { BUDGET_COLUMNS, BUDGET_DATE_COLUMNS, buildBudgetLines, buildBudgetPhasing, type BudgetLabels } from './budgetExport'
import { saveBlob } from './fileActions'
import { FILE_EXTENSION, fileNameFor } from './projectFile'
import { toCsv } from './tableExport'

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

function prepare(t: TFunction, language: string) {
  const project = projectStore.getState().project
  const labels: BudgetLabels = {
    kind: (kind) => t(`detail.kind.${kind}`),
    timing: (timing) => t(`budgetExport.timing.${timing}`),
    total: t('costs.total'),
    cumulative: t('costs.totalCumulative'),
    period: (p) => {
      const [y, m] = dayToIso(p.startDay).split('-').map(Number) as [number, number]
      return formatMonth(y, m, language, 'withYear')
    },
  }
  const lines = buildBudgetLines(project, getCosts(project), labels)
  // Měna projektu v hlavičce („Sazba EUR/h“), ne pevné „Kč“ (audit U3).
  const headers = BUDGET_COLUMNS.map((c) => t(`budgetExport.columns.${c}`, { currency: currencyLabel(project.currency) }))
  const baseName = `${fileNameFor(project).slice(0, -FILE_EXTENSION.length)} – ${t('budgetExport.fileSuffix')}`
  return { project, labels, lines, headers, baseName }
}

export async function exportBudgetCsv(t: TFunction, language: string): Promise<void> {
  const { lines, headers, baseName } = prepare(t, language)
  const blob = new Blob([toCsv(headers, lines.rows)], { type: 'text/csv;charset=utf-8' })
  try {
    await saveBlob(blob, `${baseName}.csv`, { description: t('export.csvType'), accept: { 'text/csv': ['.csv'] } })
  } catch (error) {
    if (!isAbort(error)) showNotice(t('export.failed'))
  }
}

export async function exportBudgetXlsx(t: TFunction, language: string): Promise<void> {
  const { project, labels, lines, headers, baseName } = prepare(t, language)
  try {
    const timeline = getCostTimeline(project)
    const phasing = timeline.range ? buildBudgetPhasing(project, timeline, splitPeriods(timeline.range, 'month'), labels) : { headers: [''], rows: [] }
    const { toXlsxSheets } = await import('./xlsxExport') // ExcelJS se stáhne až teď
    const column = (c: (typeof BUDGET_COLUMNS)[number]) => BUDGET_COLUMNS.indexOf(c)
    const buffer = await toXlsxSheets(
      [
        {
          name: t('budgetExport.sheetLines'),
          headers,
          rows: lines.rows,
          dateColumns: new Set(BUDGET_DATE_COLUMNS.map(column)),
          moneyColumns: new Set([column('amount'), column('cost')]),
          widths: BUDGET_COLUMNS.map((c) => ({ task: 36, resource: 28, worker: 18, category: 16, tags: 20, note: 30, kind: 14, timing: 12 })[c as string] ?? 11),
          frozenColumns: 2,
        },
        {
          name: t('budgetExport.sheetPhasing'),
          headers: phasing.headers,
          rows: phasing.rows,
          moneyColumns: new Set(phasing.headers.map((_, i) => i).filter((i) => i > 0)),
          widths: phasing.headers.map((_, i) => (i === 0 ? 22 : 15)),
          frozenColumns: 1,
        },
      ],
      language === 'cs' ? 'd.m.yyyy' : 'yyyy-mm-dd',
    )
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await saveBlob(blob, `${baseName}.xlsx`, {
      description: t('export.xlsxType'),
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    })
  } catch (error) {
    if (!isAbort(error)) showNotice(t('export.failed'))
  }
}
