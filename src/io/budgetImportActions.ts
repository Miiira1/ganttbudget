/**
 * Import řádků rozpočtu z Excelu / CSV (fáze 7, I-04) – akce z menu Soubor.
 *
 * Postup jako u importu činností: výběr souboru → přečtení (z XLSX přednostně list Řádky / Lines)
 * → kontrola (budgetImport.ts) → dialog s náhledem nebo seznamem chyb → po potvrzení jedním
 * krokem Zpět. Dokud uživatel nepotvrdí, projekt se nemění. Soubor se nikam neposílá.
 */
import type { TFunction } from 'i18next'
import { create } from 'zustand'
import cs from '../i18n/locales/cs.json'
import en from '../i18n/locales/en.json'
import type { Project } from '../model/schema'
import { projectStore } from '../store/useProject'
import { showNotice } from '../ui/notice'
import { importBudget, type BudgetImportResult } from './budgetImport'
import { MAX_FILE_CHARS } from './projectFile'
import { readCsv } from './tableImport'

interface PendingBudgetImport {
  fileName: string
  result: BudgetImportResult
}

export const useBudgetImportState = create<{ pending: PendingBudgetImport | null }>(() => ({ pending: null }))

async function readRows(file: File): Promise<unknown[][] | null> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return readCsv(await file.text())
  if (name.endsWith('.xlsx')) {
    const { readXlsx } = await import('./xlsxImport') // ExcelJS se stáhne až teď
    return readXlsx(await file.arrayBuffer(), [cs.budgetExport.sheetLines, en.budgetExport.sheetLines])
  }
  return null
}

export async function prepareBudgetImport(file: File, t: TFunction): Promise<void> {
  if (file.size > MAX_FILE_CHARS) return showNotice(t('import.error.tooLarge'))
  let rows: unknown[][] | null
  try {
    rows = await readRows(file)
  } catch {
    return showNotice(t('import.error.unreadable'))
  }
  if (rows === null) return showNotice(t('import.error.unsupported'))
  const result = importBudget(rows, projectStore.getState().project, () => crypto.randomUUID())
  useBudgetImportState.setState({ pending: { fileName: file.name, result } })
}

/** Importovat rozpočet… – výběr souboru CSV nebo XLSX. */
export function startBudgetImport(t: TFunction): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) void prepareBudgetImport(file, t)
  }
  input.click()
}

/** Potvrzení: nahradit řádky činností ze souboru (jeden krok Zpět). */
export function confirmBudgetImport(project: Project): void {
  projectStore.getState().loadProject(project)
  useBudgetImportState.setState({ pending: null })
}

export function cancelBudgetImport(): void {
  useBudgetImportState.setState({ pending: null })
}
