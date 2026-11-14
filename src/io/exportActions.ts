/**
 * Export činností do Excelu (XLSX) a do CSV (I-03) – akce z menu Soubor.
 * Data tabulky připraví tableExport.ts (čisté funkce s testy), XLSX zapíše xlsxExport.ts,
 * který se načte až teď (knihovna ExcelJS je velká a většina uživatelů ji nepotřebuje).
 */
import type { TFunction } from 'i18next'
import { projectStore, getSchedule } from '../store/useProject'
import { showNotice } from '../ui/notice'
import { saveBlob } from './fileActions'
import { FILE_EXTENSION, fileNameFor } from './projectFile'
import { buildExportTable, EXPORT_COLUMNS, toCsv } from './tableExport'

function prepare(t: TFunction) {
  const project = projectStore.getState().project
  const table = buildExportTable(project, getSchedule(project), (kind) => t(`kind.${kind}`))
  const headers = EXPORT_COLUMNS.map((c) => t(`export.columns.${c}`))
  const baseName = fileNameFor(project).slice(0, -FILE_EXTENSION.length)
  return { project, table, headers, baseName }
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

export async function exportCsv(t: TFunction): Promise<void> {
  const { table, headers, baseName } = prepare(t)
  const blob = new Blob([toCsv(headers, table.rows)], { type: 'text/csv;charset=utf-8' })
  try {
    await saveBlob(blob, `${baseName}.csv`, { description: t('export.csvType'), accept: { 'text/csv': ['.csv'] } })
  } catch (error) {
    if (!isAbort(error)) showNotice(t('export.failed'))
  }
}

export async function exportXlsx(t: TFunction, language: string): Promise<void> {
  const { project, table, headers, baseName } = prepare(t)
  try {
    const { toXlsx } = await import('./xlsxExport') // ExcelJS se stáhne až teď
    const buffer = await toXlsx(headers, table, project.name, language === 'cs' ? 'd.m.yyyy' : 'yyyy-mm-dd')
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    await saveBlob(blob, `${baseName}.xlsx`, {
      description: t('export.xlsxType'),
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    })
  } catch (error) {
    if (!isAbort(error)) showNotice(t('export.failed'))
  }
}
