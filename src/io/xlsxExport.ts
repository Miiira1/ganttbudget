/**
 * Zápis tabulky činností do XLSX pomocí knihovny ExcelJS (ne SheetJS – viz CLAUDE.md).
 * Aplikace tento soubor načítá až ve chvíli, kdy uživatel XLSX opravdu použije (ExcelJS je velká).
 *
 * Čísla se zapíšou jako čísla, data jako opravdová data, text s ochranou proti spuštění vzorce.
 */
import ExcelJS from 'exceljs'
import { DATE_COLUMNS, protectText, type ExportTable } from './tableExport'

/** Název listu: Excel nepovolí [ ] : * ? / \ a delší než 31 znaků. */
function sheetName(name: string): string {
  return (
    name
      .replace(/[[\]:*?/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 31) || 'Plan'
  )
}

/** "YYYY-MM-DD" → datum v UTC (Excel ho uloží bez posunu časovým pásmem). */
function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}

export async function toXlsx(headers: string[], table: ExportTable, name: string, dateFormat = 'd.m.yyyy'): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MiRo project'
  const sheet = workbook.addWorksheet(sheetName(name), { views: [{ state: 'frozen', ySplit: 1 }] })

  sheet.addRow(headers.map(protectText)).font = { bold: true }
  const dateIndexes = new Set(table.columns.map((c, i) => (DATE_COLUMNS.includes(c) ? i : -1)).filter((i) => i >= 0))
  for (const row of table.rows) {
    sheet.addRow(
      row.map((cell, i) => {
        if (cell === null) return null
        if (typeof cell === 'number') return cell
        if (dateIndexes.has(i) && cell !== '') return toDate(cell)
        return protectText(cell)
      }),
    )
  }
  // Formát dat a rozumné šířky sloupců.
  table.columns.forEach((column, i) => {
    const col = sheet.getColumn(i + 1)
    if (DATE_COLUMNS.includes(column)) col.numFmt = dateFormat
    col.width = column === 'name' ? 45 : column === 'notes' ? 40 : column === 'predecessors' ? 16 : 13
  })
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer
}
