/**
 * Export tabulky Sledování do Excelu nebo CSV (fáze 9). Data připraví buildTrackingExport
 * (čistá funkce s testy); ExcelJS se načte až při exportu do XLSX.
 */
import type { TFunction } from 'i18next'
import { saveBlob } from '../../io/fileActions'
import { FILE_EXTENSION, fileNameFor } from '../../io/projectFile'
import { toCsv } from '../../io/tableExport'
import { buildTrackingExport, TRACKING_DATE_COLUMNS, TRACKING_MONEY_COLUMNS } from '../../io/trackingExport'
import type { EarnedValueResult } from '../../model/earnedValue'
import { projectStore } from '../../store/useProject'
import { showNotice } from '../notice'

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
const COLUMNS = ['wbs', 'name', 'status', 'baselineStart', 'baselineFinish', 'start', 'finish', 'shift', 'percent', 'bac', 'pv', 'ev', 'ac', 'cv', 'sv'] as const

export async function exportTracking(format: 'xlsx' | 'csv', ev: EarnedValueResult, wbs: ReadonlyMap<string, string>, t: TFunction, language: string): Promise<void> {
  const project = projectStore.getState().project
  const table = buildTrackingExport(ev, {
    headers: COLUMNS.map((c) => t(`tracking.export.columns.${c}`, { currency: project.currency })),
    wbs,
    status: (r) => (!r.inPlan ? t('tracking.table.notInPlan') : !r.inBaseline ? t('tracking.table.new') : ''),
    total: t('costs.total'),
  })
  const baseName = `${fileNameFor(project).slice(0, -FILE_EXTENSION.length)} – ${t('tracking.export.fileSuffix')}`
  try {
    if (format === 'csv') {
      const blob = new Blob([toCsv(table.headers, table.rows)], { type: 'text/csv;charset=utf-8' })
      await saveBlob(blob, `${baseName}.csv`, { description: t('export.csvType'), accept: { 'text/csv': ['.csv'] } })
      return
    }
    const { toXlsxSheets } = await import('../../io/xlsxExport') // ExcelJS se stáhne až teď
    const buffer = await toXlsxSheets(
      [
        {
          name: t('tracking.export.sheetName'),
          headers: table.headers,
          rows: table.rows,
          dateColumns: TRACKING_DATE_COLUMNS,
          moneyColumns: TRACKING_MONEY_COLUMNS,
          widths: [8, 40, 14, 12, 12, 12, 12, 8, 9, 14, 14, 14, 14, 14, 14],
          frozenColumns: 2,
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
