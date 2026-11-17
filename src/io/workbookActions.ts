/**
 * Celý projekt v Excelu (doplněk po fázi 7) – akce z menu Soubor: export sešitu a jeho import.
 * Listy připraví workbookExport.ts, kontrolu importu workbookImport.ts (čisté funkce s testy);
 * ExcelJS se načte až při použití. Import nic nezmění, dokud ho uživatel v dialogu nepotvrdí.
 */
import type { TFunction } from 'i18next'
import { create } from 'zustand'
import type { Project } from '../model/schema'
import { getCostTimeline, getCosts, getSchedule, projectStore } from '../store/useProject'
import { showNotice } from '../ui/notice'
import { saveBlob } from './fileActions'
import { FILE_EXTENSION, fileNameFor, MAX_FILE_CHARS } from './projectFile'
import { UnsafeXlsxError } from './zipGuard'
import { buildWorkbook } from './workbookExport'
import { importWorkbook, type WorkbookImportResult } from './workbookImport'

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

export async function exportWorkbook(t: TFunction, language: string): Promise<void> {
  const project = projectStore.getState().project
  try {
    const sheets = buildWorkbook(project, getSchedule(project), getCosts(project), getCostTimeline(project), (key) => t(key), language)
    const { toXlsxSheets } = await import('./xlsxExport') // ExcelJS se stáhne až teď
    const buffer = await toXlsxSheets(
      sheets.map((s) => ({ ...s, computedColumns: s.computed, computedSuffix: t('workbook.computed') })),
      language === 'cs' ? 'd.m.yyyy' : 'yyyy-mm-dd',
    )
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const baseName = `${fileNameFor(project).slice(0, -FILE_EXTENSION.length)} – ${t('workbook.fileSuffix')}`
    await saveBlob(blob, `${baseName}.xlsx`, {
      description: t('export.xlsxType'),
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    })
  } catch (error) {
    if (!isAbort(error)) showNotice(t('export.failed'))
  }
}

// --- Import celého projektu z Excelu ---

interface PendingWorkbookImport {
  fileName: string
  result: WorkbookImportResult
}

/** Import čekající na potvrzení v dialogu (null = dialog zavřený). */
export const useWorkbookImportState = create<{ pending: PendingWorkbookImport | null }>(() => ({ pending: null }))

export async function prepareWorkbookImport(file: File, t: TFunction): Promise<void> {
  if (file.size > MAX_FILE_CHARS) return showNotice(t('import.error.tooLarge'))
  if (!file.name.toLowerCase().endsWith('.xlsx')) return showNotice(t('workbook.error.onlyXlsx'))
  let sheets: Map<string, unknown[][]>
  try {
    const { readXlsxSheets } = await import('./xlsxImport') // ExcelJS se stáhne až teď
    sheets = await readXlsxSheets(await file.arrayBuffer())
  } catch (error) {
    return showNotice(t(error instanceof UnsafeXlsxError ? 'import.error.unsafeXlsx' : 'import.error.unreadable'))
  }
  const result = importWorkbook(sheets, projectStore.getState().project, () => crypto.randomUUID())
  useWorkbookImportState.setState({ pending: { fileName: file.name, result } })
}

/** Importovat celý projekt z Excelu… – výběr souboru XLSX. */
export function startWorkbookImport(t: TFunction): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) void prepareWorkbookImport(file, t)
  }
  input.click()
}

/** Potvrzení: nahradit celý projekt (jeden krok Zpět). */
export function confirmWorkbookImport(project: Project): void {
  projectStore.getState().loadProject(project)
  useWorkbookImportState.setState({ pending: null })
}

export function cancelWorkbookImport(): void {
  useWorkbookImportState.setState({ pending: null })
}
