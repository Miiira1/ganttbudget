/**
 * Import činností z Excelu / CSV (I-03) a plánu z MS Project (XML) / GanttProject (.gan) (I-06, fáze 13b)
 * – akce z menu Soubor → Importovat.
 *
 * Postup: výběr souboru → přečtení (CSV: PapaParse, XLSX: ExcelJS načtené až teď) →
 * kontrola (tableImport.ts) → dialog s náhledem nebo seznamem chyb → po potvrzení se
 * činnosti nahradí jedním krokem, který jde vrátit Ctrl+Z. Dokud uživatel nepotvrdí,
 * projekt se nemění. Soubor se nikam neposílá.
 */
import type { TFunction } from 'i18next'
import { create } from 'zustand'
import type { Project } from '../model/schema'
import { projectStore } from '../store/useProject'
import { showNotice } from '../ui/notice'
import { MAX_FILE_CHARS } from './projectFile'
import { UnsafeXlsxError } from './zipGuard'
import { importTable, readCsv, type ImportResult } from './tableImport'
import { importMsProject } from './msProjectImport'
import { importGanttProject } from './ganttProjectImport'

/** Odkud import je: tabulka (Excel / CSV), MS Project, GanttProject. */
export type ImportSource = 'table' | 'msp' | 'gan'

interface PendingImport {
  fileName: string
  result: ImportResult
  source: ImportSource
}

/** Import čekající na potvrzení v dialogu (null = dialog zavřený). */
export const useImportState = create<{ pending: PendingImport | null }>(() => ({ pending: null }))

/** Přečte soubor na tabulku řádků; null = nepodporovaný typ souboru. */
async function readRows(file: File): Promise<unknown[][] | null> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return readCsv(await file.text())
  if (name.endsWith('.xlsx')) {
    const { readXlsx } = await import('./xlsxImport') // ExcelJS se stáhne až teď
    return readXlsx(await file.arrayBuffer())
  }
  return null
}

/** Načte a zkontroluje vybraný soubor a otevře dialog s náhledem. */
export async function prepareImport(file: File, t: TFunction): Promise<void> {
  if (file.size > MAX_FILE_CHARS) return showNotice(t('import.error.tooLarge'))
  let rows: unknown[][] | null
  try {
    rows = await readRows(file)
  } catch (error) {
    return showNotice(t(error instanceof UnsafeXlsxError ? 'import.error.unsafeXlsx' : 'import.error.unreadable'))
  }
  if (rows === null) return showNotice(t('import.error.unsupported'))
  const result = importTable(rows, projectStore.getState().project, () => crypto.randomUUID())
  useImportState.setState({ pending: { fileName: file.name, result, source: 'table' } })
}

/** Plán z MS Project (XML) nebo GanttProject (.gan): přečíst text, převést, otevřít náhled. */
export async function preparePlanImport(file: File, source: 'msp' | 'gan', t: TFunction): Promise<void> {
  if (file.size > MAX_FILE_CHARS) return showNotice(t('import.error.tooLarge'))
  let text: string
  try {
    text = await file.text()
  } catch {
    return showNotice(t('import.error.unreadable'))
  }
  const base = projectStore.getState().project
  const newId = () => crypto.randomUUID()
  const result = source === 'msp' ? importMsProject(text, base, newId) : importGanttProject(text, base, newId)
  useImportState.setState({ pending: { fileName: file.name, result, source } })
}

/** Importovat → Plán z MS Project / GanttProject – výběr souboru. */
export function startPlanImport(source: 'msp' | 'gan', t: TFunction): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = source === 'msp' ? '.xml,application/xml,text/xml' : '.gan'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) void preparePlanImport(file, source, t)
  }
  input.click()
}

/** Importovat… – výběr souboru CSV nebo XLSX. */
export function startImport(t: TFunction): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) void prepareImport(file, t)
  }
  input.click()
}

/** Potvrzení v dialogu: nahradit činnosti (jeden krok Zpět). */
export function confirmImport(project: Project): void {
  projectStore.getState().loadProject(project)
  useImportState.setState({ pending: null })
}

export function cancelImport(): void {
  useImportState.setState({ pending: null })
}
