import { describe, expect, it } from 'vitest'
import { isoToDay } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import { computeCostTimeline } from '../model/costTimeline'
import { computeCosts } from '../model/costs'
import { splitPeriods } from '../model/periods'
import { createEmptyProject, createTask, type Project } from '../model/schema'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import { BUDGET_COLUMNS, buildBudgetLines, buildBudgetPhasing, type BudgetLabels } from './budgetExport'
import { toCsv } from './tableExport'

const labels: BudgetLabels = {
  kind: (k) => `K:${k}`,
  timing: (t) => `T:${t}`,
  total: 'Celkem',
  cumulative: 'Kumulativně',
  period: (p) => `${p.startDay}`,
}

function project(): Project {
  const p = createEmptyProject({ name: 'T', language: 'cs', startDate: '2026-11-16' })
  p.professions = [{ id: 'pr', name: 'Programátor', categoryId: 'cat-labor', capacityPerDay: 8, manualRate: 50_000 }]
  p.workers = [{ id: 'w', name: 'Eva', professionId: 'pr', capacityPerDay: 8 }]
  p.machines = [{ id: 'm', name: 'Jeřáb', categoryId: 'cat-services', rate: 150_000, rateUnit: 'hour', capacityPerDay: 8 }]
  p.materials = [{ id: 'x', name: '=Kabel', unit: 'm', unitPrice: 3_250, categoryId: 'cat-material' }]
  p.tasks = [
    {
      ...createTask({ id: 'A', name: 'Analýza', order: 0, durationDays: 5 }),
      lines: [
        { id: 'l1', kind: 'labor', categoryId: 'cat-labor', professionId: 'pr', workerId: 'w', sharePct: 50, tags: ['dotace', 'IT'], note: 'pozn.' },
        { id: 'l2', kind: 'machine', categoryId: 'cat-services', machineId: 'm', sharePct: 25 },
        { id: 'l3', kind: 'material', categoryId: 'cat-material', materialId: 'x', quantity: 10.5, unitPriceOverride: 3_000 },
        { id: 'l4', kind: 'oneTime', categoryId: 'cat-services', name: 'Záloha', amount: 1_234_550, timing: 'date', date: '2026-12-01' },
        { id: 'l5', kind: 'recurring', categoryId: 'cat-overhead', name: 'Nájem', amount: 700_000, period: 'week' },
      ],
    },
  ]
  return p
}

describe('export řádků rozpočtu (I-04)', () => {
  const p = project()
  const s = schedule(p)
  const table = buildBudgetLines(p, computeCosts(p, s), labels)
  const row = (lineIndex: number) => Object.fromEntries(BUDGET_COLUMNS.map((c, i) => [c, table.rows[lineIndex]![i]]))

  it('člověk: profese, pracovník, podíl %, štítky, poznámka, hodiny a náklad v Kč', () => {
    expect(row(0)).toEqual({
      wbs: '1',
      task: 'Analýza',
      kind: 'K:labor',
      resource: 'Programátor',
      worker: 'Eva',
      quantity: 50,
      amount: null,
      timing: null,
      date: null,
      category: 'Mzdy',
      tags: 'dotace, IT',
      note: 'pozn.',
      hoursPerDay: 4,
      rate: 500,
      hours: 20,
      cost: 10_000,
    })
  })

  it('stroj, materiál s vlastní cenou, jednorázový k datu, průběžný za týden', () => {
    expect(row(1)).toMatchObject({ kind: 'K:machine', resource: 'Jeřáb', quantity: 25, amount: null, hoursPerDay: 2, rate: 1_500, hours: 10, cost: 15_000 })
    expect(row(2)).toMatchObject({ kind: 'K:material', resource: '=Kabel', quantity: 10.5, amount: 30, cost: 315 })
    expect(row(3)).toMatchObject({ kind: 'K:oneTime', resource: 'Záloha', amount: 12_345.5, timing: 'T:date', date: '2026-12-01', cost: 12_345.5 })
    expect(row(4)).toMatchObject({ kind: 'K:recurring', resource: 'Nájem', amount: 7_000, timing: 'T:week', date: null, hoursPerDay: null, rate: null, hours: null })
  })

  it('CSV: název začínající = dostane apostrof (ochrana proti vzorcům)', () => {
    const csv = toCsv([...BUDGET_COLUMNS], table.rows)
    expect(csv).toContain("'=Kabel")
    expect(csv).not.toMatch(/;=Kabel/)
  })
})

describe('export náběhu po měsících', () => {
  it('kategorie × měsíce, součty řádků, celkem a kumulativně; součet = náklady projektu', () => {
    const p = createSampleProject(translateCs, 'cs', '2026-11-16')
    const s = schedule(p)
    const costs = computeCosts(p, s)
    const timeline = computeCostTimeline(p, s, costs)
    const months = splitPeriods(timeline.range!, 'month')
    const sheet = buildBudgetPhasing(p, timeline, months, labels)
    expect(sheet.headers[0]).toBe('')
    expect(sheet.headers.at(-1)).toBe('Celkem')
    expect(sheet.headers).toHaveLength(months.length + 2)
    const totalRow = sheet.rows.find((r) => r[0] === 'Celkem')!
    const cumulativeRow = sheet.rows.find((r) => r[0] === 'Kumulativně')!
    expect(totalRow.at(-1)).toBeCloseTo(costs.project.total / 100, 2)
    expect(cumulativeRow.at(-2)).toBeCloseTo(costs.project.total / 100, 2)
    // Jen kategorie s nákladem, v pořadí databáze.
    expect(sheet.rows.filter((r) => r[0] !== 'Celkem' && r[0] !== 'Kumulativně').map((r) => r[0])).toEqual(['Materiál', 'Mzdy', 'Služby', 'Investice'])
    expect(months[0]!.startDay).toBe(isoToDay('2026-11-16'))
  })
})

describe('soubor XLSX se dvěma listy', () => {
  it('listy Řádky a Náběh, datum jako datum, peníze jako čísla, text začínající = s apostrofem', async () => {
    const { toXlsxSheets } = await import('./xlsxExport')
    const ExcelJS = (await import('exceljs')).default
    const p = project()
    const lines = buildBudgetLines(p, computeCosts(p, schedule(p)), labels)
    const buffer = await toXlsxSheets([
      { name: 'Řádky', headers: [...BUDGET_COLUMNS], rows: lines.rows, dateColumns: new Set([BUDGET_COLUMNS.indexOf('date')]) },
      { name: 'Náběh', headers: ['', 'Celkem'], rows: [['Mzdy', 10_000]] },
    ])
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(buffer)
    expect(book.worksheets.map((w) => w.name)).toEqual(['Řádky', 'Náběh'])
    const sheet = book.getWorksheet('Řádky')!
    const col = (c: (typeof BUDGET_COLUMNS)[number]) => BUDGET_COLUMNS.indexOf(c) + 1
    expect(sheet.getRow(4).getCell(col('resource')).value).toBe("'=Kabel")
    expect(sheet.getRow(5).getCell(col('date')).value).toEqual(new Date(Date.UTC(2026, 11, 1)))
    expect(sheet.getRow(5).getCell(col('amount')).value).toBe(12_345.5)
    expect(book.getWorksheet('Náběh')!.getRow(2).getCell(2).value).toBe(10_000)
  })
})
