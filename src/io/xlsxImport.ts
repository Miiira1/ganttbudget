/**
 * Čtení tabulky činností z XLSX pomocí ExcelJS (ne SheetJS). Načítá se až při použití.
 *
 * Bere se první list. Hodnoty buněk se převedou na text, číslo nebo datum; vzorce se
 * NIKDY nespouštějí – použije se jen výsledek, který v souboru uložil Excel.
 * Kontrolu obsahu dělá tableImport.ts. Před otevřením se archiv zkontroluje (zipGuard.ts),
 * aby „nafouknutý“ soubor nezahltil prohlížeč.
 */
import ExcelJS from 'exceljs'
import { checkZip, UnsafeXlsxError } from './zipGuard'

/** Otevře sešit až po kontrole archivu; podezřelý soubor → UnsafeXlsxError. */
async function loadWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const issue = await checkZip(buffer)
  if (issue === 'tooLarge' || issue === 'tooManyEntries' || issue === 'ratio') throw new UnsafeXlsxError(issue)
  if (issue) throw new Error(`xlsx: ${issue}`) // není to platný sešit → „soubor se nedá přečíst“
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  return workbook
}

/** Hodnota buňky ExcelJS → text / číslo / datum / prázdné. */
function plain(value: ExcelJS.CellValue): string | number | Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) return value
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((part) => part.text).join('')
    if ('formula' in value || 'sharedFormula' in value) {
      const result = (value as { result?: ExcelJS.CellValue }).result
      return result === undefined ? null : plain(result) // jen uložený výsledek, vzorec se nespouští
    }
    if ('text' in value && typeof value.text === 'string') return value.text // odkaz
  }
  return null // chyba (#N/A…) nebo neznámý typ
}

/**
 * Největší list, který se přečte (audit B2). Největší import potřebuje 50 000 řádků (skutečné
 * náklady v sešitu celého projektu) + záhlaví. Malý soubor může mít buňku v posledním řádku
 * a sloupci (1 048 576 × 16 384) – procházení všech buněk by zahltilo prohlížeč.
 */
export const MAX_SHEET_ROWS = 60_000
export const MAX_SHEET_CELLS = 5_000_000

/** List → tabulka hodnot; obří list se odmítne dřív, než se začne procházet. */
function readSheet(sheet: ExcelJS.Worksheet): unknown[][] {
  const height = sheet.rowCount
  const width = sheet.columnCount
  if (height > MAX_SHEET_ROWS || height * width > MAX_SHEET_CELLS) throw new UnsafeXlsxError('sheetTooLarge', sheet.name)
  const rows: unknown[][] = []
  for (let r = 1; r <= height; r++) {
    const row = sheet.getRow(r)
    rows.push(Array.from({ length: width }, (_, c) => plain(row.getCell(c + 1).value)))
  }
  return rows
}

/**
 * Přečte list sešitu jako tabulku. `preferredSheets` = názvy listů, které se vezmou přednostně
 * (např. „Řádky“ z exportu rozpočtu); jinak první list.
 */
export async function readXlsx(buffer: ArrayBuffer, preferredSheets: readonly string[] = []): Promise<unknown[][]> {
  const workbook = await loadWorkbook(buffer)
  const wanted = new Set(preferredSheets.map((n) => n.trim().toLowerCase()))
  const sheet = workbook.worksheets.find((w) => wanted.has(w.name.trim().toLowerCase())) ?? workbook.worksheets[0]
  return sheet ? readSheet(sheet) : []
}

/** Všechny listy sešitu: název listu → tabulka (pro import celého projektu). */
export async function readXlsxSheets(buffer: ArrayBuffer): Promise<Map<string, unknown[][]>> {
  const workbook = await loadWorkbook(buffer)
  const sheets = new Map<string, unknown[][]>()
  for (const sheet of workbook.worksheets) sheets.set(sheet.name, readSheet(sheet))
  return sheets
}
