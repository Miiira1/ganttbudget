/**
 * Čtení tabulky činností z XLSX pomocí ExcelJS (ne SheetJS). Načítá se až při použití.
 *
 * Bere se první list. Hodnoty buněk se převedou na text, číslo nebo datum; vzorce se
 * NIKDY nespouštějí – použije se jen výsledek, který v souboru uložil Excel.
 * Kontrolu obsahu dělá tableImport.ts.
 */
import ExcelJS from 'exceljs'

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
 * Přečte list sešitu jako tabulku. `preferredSheets` = názvy listů, které se vezmou přednostně
 * (např. „Řádky“ z exportu rozpočtu); jinak první list.
 */
export async function readXlsx(buffer: ArrayBuffer, preferredSheets: readonly string[] = []): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const wanted = new Set(preferredSheets.map((n) => n.trim().toLowerCase()))
  const sheet = workbook.worksheets.find((w) => wanted.has(w.name.trim().toLowerCase())) ?? workbook.worksheets[0]
  if (!sheet) return []
  const width = sheet.columnCount
  const rows: unknown[][] = []
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    rows.push(Array.from({ length: width }, (_, c) => plain(row.getCell(c + 1).value)))
  }
  return rows
}

/** Všechny listy sešitu: název listu → tabulka (pro import celého projektu). */
export async function readXlsxSheets(buffer: ArrayBuffer): Promise<Map<string, unknown[][]>> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheets = new Map<string, unknown[][]>()
  for (const sheet of workbook.worksheets) {
    const width = sheet.columnCount
    const rows: unknown[][] = []
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      rows.push(Array.from({ length: width }, (_, c) => plain(row.getCell(c + 1).value)))
    }
    sheets.set(sheet.name, rows)
  }
  return sheets
}
