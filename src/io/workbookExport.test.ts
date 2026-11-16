import { describe, expect, it } from 'vitest'
import { schedule } from '../engine/schedule'
import cs from '../i18n/locales/cs.json'
import { computeCostTimeline } from '../model/costTimeline'
import { computeCosts } from '../model/costs'
import { effectiveWorkerRate, professionRate, workingDaysInYear } from '../model/rates'
import type { Project } from '../model/schema'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import { buildExportTable } from './tableExport'
import { buildWorkbook, WORKBOOK_SHEETS, type WorkbookSheet } from './workbookExport'

/** Překlad z cs.json podle klíče „a.b.c“ (stačí pro testy – bez interpolace). */
const t = (key: string): string => {
  const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], cs)
  if (typeof value !== 'string') throw new Error(`chybí překlad ${key}`)
  return value
}

function build(p: Project): WorkbookSheet[] {
  const s = schedule(p)
  const costs = computeCosts(p, s)
  return buildWorkbook(p, s, costs, computeCostTimeline(p, s, costs), t, 'cs')
}
const sample = () => {
  const p = createSampleProject(translateCs, 'cs', '2026-11-16')
  p.budget = { limit: 700_000_000, categoryLimits: [{ categoryId: 'cat-labor', limit: 120_000_000 }] }
  p.workers[0]!.absences = [{ start: '2027-01-04', end: '2027-01-08', note: 'Dovolená' }]
  return p
}
/** Řádky listu jako objekty podle nadpisů sloupců. */
function records(sheet: WorkbookSheet): Record<string, unknown>[] {
  return sheet.rows.map((row) => Object.fromEntries(sheet.headers.map((h, i) => [h, row[i]])))
}
const sheetOf = (sheets: WorkbookSheet[], key: WorkbookSheet['key']) => sheets.find((s) => s.key === key)!

describe('celý projekt v Excelu – export (doplněk po fázi 7)', () => {
  const p = sample()
  const sheets = build(p)

  it('všechny listy v daném pořadí', () => {
    expect(sheets.map((s) => s.key)).toEqual([...WORKBOOK_SHEETS])
    expect(sheets.map((s) => s.name)).toEqual(WORKBOOK_SHEETS.map((k) => t(`workbook.sheets.${k}`)))
  })

  it('list Projekt: název, začátek, měna, limit, pracovní dny, svátky', () => {
    const items = Object.fromEntries(sheetOf(sheets, 'project').rows.map((r) => [r[0], r[1]]))
    expect(items).toMatchObject({
      [t('workbook.project.name')]: p.name,
      [t('workbook.project.startDate')]: '2026-11-16',
      [t('workbook.project.currency')]: 'CZK',
      [t('workbook.project.limit')]: 7_000_000,
      [t('workbook.project.workingWeekdays')]: '1, 2, 3, 4, 5',
      [t('workbook.project.czechHolidays')]: t('workbook.yes'),
    })
  })

  it('list Činnosti = export činností; Začátek a Konec jsou vypočtené', () => {
    const tasks = sheetOf(sheets, 'tasks')
    expect(tasks.rows).toEqual(buildExportTable(p, schedule(p), (k) => t(`kind.${k}`)).rows)
    expect([...tasks.computed].map((i) => tasks.headers[i])).toEqual([t('export.columns.wbs'), t('export.columns.start'), t('export.columns.finish')])
  })

  it('list Profese: kalkulace i ruční sazba; sazba a její zdroj vypočtené', () => {
    const fund = workingDaysInYear(p.calendar, 2026)
    const sheet = sheetOf(sheets, 'professions')
    const recs = records(sheet)
    p.professions.forEach((prof, i) => {
      expect(recs[i]![t('workbook.columns.name')]).toBe(prof.name)
      expect(recs[i]![t('workbook.columns.rate')]).toBe(professionRate(prof, fund)! / 100)
      if (prof.rateCalc) expect(recs[i]![t('workbook.columns.monthlyWage')]).toBe(prof.rateCalc.monthlyWage / 100)
      if (prof.manualRate !== undefined) expect(recs[i]![t('workbook.columns.manualRate')]).toBe(prof.manualRate / 100)
    })
    expect(sheet.headers.filter((_, i) => sheet.computed.has(i))).toEqual([t('workbook.columns.rate'), t('workbook.columns.rateSource')])
  })

  it('list Pracovníci: profese a středisko názvem, sazba podle zdroje', () => {
    const fund = workingDaysInYear(p.calendar, 2026)
    const recs = records(sheetOf(sheets, 'workers'))
    p.workers.forEach((w, i) => {
      const prof = p.professions.find((x) => x.id === w.professionId)!
      expect(recs[i]![t('workbook.columns.profession')]).toBe(prof.name)
      expect(recs[i]![t('workbook.columns.department')]).toBe(p.departments.find((d) => d.id === w.departmentId)?.name ?? null)
      const eff = effectiveWorkerRate(w, prof, fund)
      expect(recs[i]![t('workbook.columns.rate')]).toBe(eff.rate === null ? null : eff.rate / 100)
      expect(recs[i]![t('workbook.columns.rateSource')]).toBe(t(`resources.rateSource.${eff.source}`))
    })
  })

  it('list Nepřítomnosti, Kategorie s limitem a plánem, Řádky s h/den a sazbou', () => {
    expect(records(sheetOf(sheets, 'absences'))).toEqual([
      { [t('workbook.columns.worker')]: p.workers[0]!.name, [t('workbook.columns.from')]: '2027-01-04', [t('workbook.columns.to')]: '2027-01-08', [t('workbook.columns.note')]: 'Dovolená' },
    ])
    const labor = records(sheetOf(sheets, 'categories')).find((r) => r[t('workbook.columns.name')] === 'Mzdy')!
    expect(labor[t('workbook.columns.limit')]).toBe(1_200_000)
    expect(typeof labor[t('workbook.columns.planned')]).toBe('number')
    const lines = sheetOf(sheets, 'lines')
    expect(lines.headers).toContain(t('budgetExport.columns.rate'))
    expect(lines.rows).toHaveLength(p.tasks.reduce((s, x) => s + x.lines.length, 0))
  })

  it('list Náběh je celý vypočtený; texty začínající = se v XLSX ochrání', async () => {
    const phasing = sheetOf(sheets, 'phasing')
    expect(phasing.computed.size).toBe(phasing.headers.length)
    const { toXlsxSheets } = await import('./xlsxExport')
    const ExcelJS = (await import('exceljs')).default
    const q = sample()
    q.materials[0]!.name = '=SUM(A1)'
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(await toXlsxSheets(build(q).map((s) => ({ ...s, computedColumns: s.computed }))))
    const materials = book.getWorksheet(t('workbook.sheets.materials'))!
    expect(materials.getRow(2).getCell(1).value).toBe("'=SUM(A1)")
    // Vypočtený sloupec má šedý nadpis.
    const professions = book.getWorksheet(t('workbook.sheets.professions'))!
    const rateCol = sheetOf(build(q), 'professions').headers.indexOf(t('workbook.columns.rate')) + 1
    expect(professions.getRow(1).getCell(rateCol).fill).toMatchObject({ type: 'pattern', fgColor: { argb: 'FFEBEAE4' } })
  })
})
