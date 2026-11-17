/**
 * Export kontingenční tabulky do Excelu nebo CSV (fáze 8). Data připraví buildPivotExport
 * (čistá funkce s testy); ExcelJS se načte až při exportu do XLSX.
 */
import type { TFunction } from 'i18next'
import { buildPivotExport } from '../../io/analysisExport'
import { saveBlob } from '../../io/fileActions'
import { FILE_EXTENSION, fileNameFor } from '../../io/projectFile'
import { toCsv } from '../../io/tableExport'
import type { PivotConfig, PivotDim, PivotResult } from '../../model/pivot'
import { projectStore } from '../../store/useProject'
import { showNotice } from '../notice'

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

export async function exportPivot(
  format: 'xlsx' | 'csv',
  result: PivotResult,
  config: PivotConfig,
  label: (dim: PivotDim, key: string) => string,
  t: TFunction,
  language: string,
): Promise<void> {
  const project = projectStore.getState().project
  const table = buildPivotExport(result, {
    rowHeaders: config.rows.map((d) => t(`analysis.dims.${d}`)),
    label: (level, key) => label(config.rows[level]!, key),
    columnLabel: (key) => (config.column ? label(config.column, key) : key),
    total: t('costs.total'),
    metric: config.metric,
    agg: config.agg,
  })
  const baseName = `${fileNameFor(project).slice(0, -FILE_EXTENSION.length)} – ${t('analysis.fileSuffix')}`
  try {
    if (format === 'csv') {
      const blob = new Blob([toCsv(table.headers, table.rows)], { type: 'text/csv;charset=utf-8' })
      await saveBlob(blob, `${baseName}.csv`, { description: t('export.csvType'), accept: { 'text/csv': ['.csv'] } })
      return
    }
    const { toXlsxSheets } = await import('../../io/xlsxExport') // ExcelJS se stáhne až teď
    const valueColumns = new Set(table.headers.map((_, i) => i).filter((i) => i >= config.rows.length))
    const buffer = await toXlsxSheets(
      [
        {
          name: t('analysis.sheetName'),
          headers: table.headers,
          rows: table.rows,
          moneyColumns: config.metric === 'cost' && config.agg !== 'count' ? valueColumns : new Set(),
          widths: table.headers.map((_, i) => (i < config.rows.length ? 32 : 14)),
          frozenColumns: config.rows.length,
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
