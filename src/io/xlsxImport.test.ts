import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { MAX_SHEET_CELLS, MAX_SHEET_ROWS, readXlsx, readXlsxSheets } from './xlsxImport'
import { UnsafeXlsxError } from './zipGuard'

async function workbook(fill: (sheet: ExcelJS.Worksheet) => void, name = 'Činnosti'): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook()
  fill(book.addWorksheet(name))
  const buffer = (await book.xlsx.writeBuffer()) as unknown as Uint8Array
  return new Uint8Array(buffer).buffer as ArrayBuffer
}

describe('čtení XLSX: ochrana proti obřím listům (audit B2)', () => {
  it('limity listu: 60 000 řádků a 5 milionů buněk (víc než kterýkoli import potřebuje)', () => {
    expect(MAX_SHEET_ROWS).toBe(60_000)
    expect(MAX_SHEET_CELLS).toBe(5_000_000)
  })

  it('běžný list se přečte celý, i s prázdnými řádky uprostřed', async () => {
    const buffer = await workbook((sheet) => {
      sheet.getCell('A1').value = 'Název'
      sheet.getCell('B1').value = 'Délka'
      sheet.getCell('A3').value = 'Činnost'
      sheet.getCell('B3').value = 5
    })
    expect(await readXlsx(buffer)).toEqual([
      ['Název', 'Délka'],
      [null, null],
      ['Činnost', 5],
    ])
  })

  it('„řídký“ list s buňkou v posledním řádku a sloupci se odmítne, místo aby zahltil prohlížeč', async () => {
    // Soubor má pár kB, ale list by měl 1 048 576 × 16 384 buněk.
    const buffer = await workbook((sheet) => {
      sheet.getCell('A1').value = 'x'
      sheet.getCell('XFD1048576').value = 'y'
    })
    await expect(readXlsx(buffer)).rejects.toMatchObject({ issue: 'sheetTooLarge', sheet: 'Činnosti' })
    await expect(readXlsxSheets(buffer)).rejects.toBeInstanceOf(UnsafeXlsxError)
  })

  it('moc řádků → odmítne se (i když je list úzký)', async () => {
    const buffer = await workbook((sheet) => {
      sheet.getCell('A1').value = 'x'
      sheet.getCell(`A${MAX_SHEET_ROWS + 1}`).value = 'y'
    })
    await expect(readXlsx(buffer)).rejects.toMatchObject({ issue: 'sheetTooLarge' })
  })

  it('moc buněk (široký list) → odmítne se', async () => {
    const buffer = await workbook((sheet) => {
      sheet.getCell('A1').value = 'x'
      sheet.getCell('XFD400').value = 'y' // 16 384 × 400 = 6,5 milionu buněk
    })
    await expect(readXlsx(buffer)).rejects.toMatchObject({ issue: 'sheetTooLarge' })
  })
})
