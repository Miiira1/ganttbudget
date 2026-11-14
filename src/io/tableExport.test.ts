import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { createSampleProject } from '../samples/automatizace'
import { schedule } from '../engine/schedule'
import { buildExportTable, EXPORT_COLUMNS, protectText, toCsv } from './tableExport'
import { toXlsx } from './xlsxExport'

const sample = () => {
  const project = createSampleProject((key) => key, 'cs', '2026-11-16')
  project.tasks.find((t) => t.id === 'sample-t1a')!.constraintStart = '2026-11-18'
  project.tasks.find((t) => t.id === 'sample-t1a')!.notes = '=1+1'
  return project
}
const table = () => {
  const project = sample()
  return buildExportTable(project, schedule(project), (kind) => `[${kind}]`)
}
/** Řádek tabulky jako objekt „sloupec → hodnota“ (čitelnější porovnání). */
const asObject = (row: (string | number | null)[]) => Object.fromEntries(EXPORT_COLUMNS.map((c, i) => [c, row[i]]))

describe('export činností – data tabulky', () => {
  it('sloupce v pořadí a řádek za každou položku (v pořadí stromu)', () => {
    expect(EXPORT_COLUMNS).toEqual([
      'number',
      'wbs',
      'level',
      'name',
      'kind',
      'start',
      'finish',
      'duration',
      'predecessors',
      'constraint',
      'percent',
      'notes',
    ])
    expect(table().rows).toHaveLength(sample().tasks.length)
  })

  it('fáze: úroveň 1, spočítaná délka a termíny', () => {
    // Analýza začíná až 18. 11. (omezení) → fáze 18. 11. – 22. 12., 10 + 15 = 25 pracovních dnů
    expect(asObject(table().rows[0]!)).toEqual({
      number: 1,
      wbs: '1',
      level: 1,
      name: 'sample.tasks.p1',
      kind: '[phase]',
      start: '2026-11-18',
      finish: '2026-12-22',
      duration: 25,
      predecessors: '',
      constraint: null,
      percent: 0,
      notes: '',
    })
  })

  it('činnost: úroveň 2, předchůdci, omezení a poznámka (zatím bez ochrany – tu přidá CSV/XLSX)', () => {
    const t1b = asObject(table().rows[2]!)
    expect(t1b).toMatchObject({ number: 3, wbs: '1.2', level: 2, kind: '[task]', duration: 15, predecessors: '2' })
    const t1a = asObject(table().rows[1]!)
    expect(t1a).toMatchObject({ constraint: '2026-11-18', notes: '=1+1', start: '2026-11-18' })
  })
})

describe('ochrana proti CSV injection (N-11)', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+420 123', "'+420 123"],
    ['-5', "'-5"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tx', "'\tx"],
    ['\rx', "'\rx"],
  ])('„%s“ dostane apostrof', (value, expected) => {
    expect(protectText(value)).toBe(expected)
  })

  it('běžný text se nemění', () => {
    expect(protectText('Analýza 2 = hotovo')).toBe('Analýza 2 = hotovo')
    expect(protectText('')).toBe('')
    expect(protectText('3SS+2')).toBe('3SS+2')
  })
})

describe('CSV', () => {
  it('UTF-8 s BOM, oddělovač středník, řádky CRLF, uvozovky kde je potřeba, ochrana buněk', () => {
    const csv = toCsv(['A', 'B', 'C'], [
      [1, 'text; se středníkem', '=1+1'],
      [2, 'dva\nřádky', 'Říjen „uvozovky“ "a"'],
    ])
    expect(csv.startsWith('﻿A;B;C\r\n')).toBe(true)
    expect(csv).toContain('1;"text; se středníkem";\'=1+1\r\n')
    expect(csv).toContain('2;"dva\nřádky";"Říjen „uvozovky“ ""a"""')
  })
})

describe('XLSX (ExcelJS)', () => {
  it('čísla jako čísla, data jako data, text chráněný; soubor jde znovu otevřít', async () => {
    const t = table()
    const buffer = await toXlsx(['Č.', 'WBS', 'Úroveň', 'Název', 'Typ', 'Začátek', 'Konec', 'Délka', 'Předchůdci', 'Začít nejdříve', '% hotovo', 'Poznámka'], t, 'Plán: test/1')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]!
    expect(sheet.name).toBe('Plán test 1') // znaky, které Excel v názvu listu nepovolí, zmizí
    expect(sheet.getRow(1).getCell(4).value).toBe('Název')
    const row = sheet.getRow(3) // činnost t1a (řádek 2 tabulky)
    expect(row.getCell(1).value).toBe(2)
    expect(row.getCell(2).value).toBe('1.1') // WBS jako text, ne číslo
    expect(row.getCell(6).value).toEqual(new Date(Date.UTC(2026, 10, 18)))
    expect(row.getCell(10).value).toEqual(new Date(Date.UTC(2026, 10, 18)))
    expect(row.getCell(12).value).toBe("'=1+1")
  })
})
