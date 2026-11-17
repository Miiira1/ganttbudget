import { describe, expect, it } from 'vitest'
import { schedule } from '../engine/schedule'
import cs from '../i18n/locales/cs.json'
import en from '../i18n/locales/en.json'
import { computeCostTimeline } from '../model/costTimeline'
import { computeCosts } from '../model/costs'
import { treeOrder } from '../model/hierarchy'
import { ProjectSchema, type Project, type TaskLine } from '../model/schema'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import type { Cell } from './tableExport'
import { buildWorkbook, type WorkbookSheet } from './workbookExport'
import { importWorkbook } from './workbookImport'

const translator = (locale: object) => (key: string): string => {
  const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], locale)
  if (typeof value !== 'string') throw new Error(`chybí překlad ${key}`)
  return value
}

/** Projekt → listy jako v souboru: { název listu: [hlavička s dovětkem u vypočtených, ...řádky] }. */
function toSheets(p: Project, locale: object = cs): Map<string, Cell[][]> {
  const t = translator(locale)
  const s = schedule(p)
  const costs = computeCosts(p, s)
  const sheets: WorkbookSheet[] = buildWorkbook(p, s, costs, computeCostTimeline(p, s, costs), t, 'cs')
  return new Map(sheets.map((sh) => [sh.name, [sh.headers.map((h, i) => (sh.computed.has(i) ? `${h} (${t('workbook.computed')})` : h)), ...sh.rows]]))
}

const sample = () => {
  const p = createSampleProject(translateCs, 'cs', '2026-11-16')
  p.budget = { limit: 700_000_000, categoryLimits: [{ categoryId: 'cat-labor', limit: 120_000_000 }] }
  p.workers[0]!.absences = [{ start: '2027-01-04', end: '2027-01-08', note: 'Dovolená' }]
  p.calendar.customHolidays = [{ start: '2026-12-28', end: '2026-12-31', name: 'Odstávka' }]
  p.calendar.removedHolidays = ['2026-12-24']
  p.tasks[1]!.lines[0] = { ...p.tasks[1]!.lines[0]!, tags: ['dotace'] }
  return p
}
let seq = 0
const makeId = () => `n${++seq}`
const withoutId = (lines: TaskLine[]) => lines.map(({ id: _id, ...rest }) => rest)

/** Porovnání projektů bez ID činností a řádků (ty import vytvoří nové). */
function expectSameProject(actual: Project, expected: Project) {
  expect({ ...actual, tasks: [] }).toEqual({ ...expected, tasks: [] })
  const a = treeOrder(actual)
  const e = treeOrder(expected)
  // Délka fáze se vždy počítá z podřízených (uložená hodnota se nepoužívá) – neporovnává se.
  const shape = (t: Project['tasks'][number]) => [t.name, t.kind, t.kind === 'phase' ? null : t.durationDays, t.percentComplete, t.notes, t.constraintStart, t.dependencies.length]
  expect(a.map(shape)).toEqual(e.map(shape))
  a.forEach((task, i) => expect(withoutId(task.lines)).toEqual(withoutId(e[i]!.lines)))
  expect(computeCosts(actual, schedule(actual)).project.total).toBe(computeCosts(expected, schedule(expected)).project.total)
  expect(schedule(actual).projectFinish).toBe(schedule(expected).projectFinish)
}

describe('celý projekt z Excelu – export → import vrátí stejný projekt', () => {
  it('do stejného projektu: databáze se stejnými ID, činnosti a řádky, kalendář, limity', () => {
    const p = sample()
    const result = importWorkbook(toSheets(p), p, makeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expectSameProject(result.project, p)
    expect(ProjectSchema.safeParse(result.project).success).toBe(true)
    expect(result.summary).toMatchObject({ tasks: p.tasks.length, lines: p.tasks.reduce((s, t) => s + t.lines.length, 0), workers: p.workers.length })
  })

  it('do prázdného projektu (nová ID) a s anglickými listy: stejné náklady a termíny', () => {
    const p = sample()
    const empty = { ...p, costCategories: [], departments: [], professions: [], workers: [], machines: [], materials: [], tasks: [], budget: undefined }
    const result = importWorkbook(toSheets(p, en), empty, makeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(computeCosts(result.project, schedule(result.project)).project.total).toBe(computeCosts(p, schedule(p)).project.total)
    expect(result.project.workers.map((w) => w.name)).toEqual(p.workers.map((w) => w.name))
    expect(result.project.budget).toEqual({ limit: 700_000_000, categoryLimits: [{ categoryId: expect.any(String), limit: 120_000_000 }] })
  })

  it('skutečný soubor XLSX: zápis → čtení → import', async () => {
    const p = sample()
    const t = translator(cs)
    const s = schedule(p)
    const costs = computeCosts(p, s)
    const { toXlsxSheets } = await import('./xlsxExport')
    const { readXlsxSheets } = await import('./xlsxImport')
    const buffer = await toXlsxSheets(
      buildWorkbook(p, s, costs, computeCostTimeline(p, s, costs), t, 'cs').map((sh) => ({ ...sh, computedColumns: sh.computed, computedSuffix: t('workbook.computed') })),
    )
    const result = importWorkbook(await readXlsxSheets(buffer), p, makeId)
    expect(result.ok).toBe(true)
    if (result.ok) expectSameProject(result.project, p)
  })
})

describe('celý projekt z Excelu – chyby s názvem listu a číslem řádku', () => {
  const t = translator(cs)
  const errors = (edit: (sheets: Map<string, Cell[][]>) => void) => {
    const p = sample()
    const sheets = toSheets(p)
    edit(sheets)
    const result = importWorkbook(sheets, p, makeId)
    return result.ok ? [] : result.errors.map((e) => `${e.sheet}:${e.row}:${e.code}`)
  }
  const sheet = (sheets: Map<string, Cell[][]>, key: string) => sheets.get(t(`workbook.sheets.${key}`))!
  const col = (sheets: Map<string, Cell[][]>, key: string, column: string) => sheet(sheets, key)[0]!.findIndex((h) => String(h).startsWith(t(column)))

  it('chybějící list', () => {
    expect(errors((s) => s.delete(t('workbook.sheets.workers')))).toEqual(['workers:1:missingSheet'])
  })

  it('list Projekt: chybný začátek, pracovní dny a svátky', () => {
    expect(
      errors((s) => {
        const rows = sheet(s, 'project')
        rows.find((r) => r[0] === t('workbook.project.startDate'))![1] = '31.2.2026'
        rows.find((r) => r[0] === t('workbook.project.workingWeekdays'))![1] = '1, 2, 9'
        rows.find((r) => r[0] === t('workbook.project.czechHolidays'))![1] = 'možná'
      }),
    ).toEqual(['project:4:badDate', 'project:8:badWeekdays', 'project:9:badYesNo'])
  })

  it('databáze: neznámá kategorie, profese, pracovník; duplicitní název; chybná kapacita', () => {
    expect(
      errors((s) => {
        sheet(s, 'professions')[1]![col(s, 'professions', 'workbook.columns.category')] = 'Neznámá'
        sheet(s, 'workers')[1]![col(s, 'workers', 'workbook.columns.profession')] = 'Kuchař'
        sheet(s, 'workers')[2]![col(s, 'workers', 'workbook.columns.capacity')] = 30
        sheet(s, 'absences')[1]![col(s, 'absences', 'workbook.columns.worker')] = 'Nikdo'
        sheet(s, 'machines')[2]![0] = sheet(s, 'machines')[1]![0]!
      }),
    ).toEqual(['professions:2:unknownCategory', 'workers:2:unknownProfession', 'workers:3:badCapacity', 'absences:2:unknownWorker', 'machines:3:duplicateName'])
  })

  it('chyby z listů Činnosti a Řádky nesou název listu', () => {
    expect(
      errors((s) => {
        sheet(s, 'tasks')[2]![col(s, 'tasks', 'export.columns.duration')] = 'dlouho'
      }),
    ).toEqual(['tasks:3:badDuration'])
    expect(
      errors((s) => {
        sheet(s, 'lines')[1]![col(s, 'lines', 'budgetExport.columns.resource')] = 'Kuchař'
      }),
    ).toEqual(['lines:2:unknownProfession'])
  })
})

describe('celý projekt z Excelu – uložené pohledy analýzy', () => {
  it('sešit pohledy neobsahuje, import ponechá současné pohledy projektu', () => {
    const p = sample()
    p.views = [{ id: 'v1', name: 'Mzdy po měsících', config: { rows: ['category'], column: 'period', metric: 'cost', agg: 'sum', period: 'month', filters: {} } }]
    const result = importWorkbook(toSheets(p), p, makeId)
    expect(result.ok && result.project.views).toEqual(p.views)
  })
})
