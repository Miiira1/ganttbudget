import { describe, expect, it } from 'vitest'
import { schedule } from '../engine/schedule'
import cs from '../i18n/locales/cs.json'
import en from '../i18n/locales/en.json'
import { computeCosts } from '../model/costs'
import { createEmptyProject, createTask, ProjectSchema, type Project, type TaskLine } from '../model/schema'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import { BUDGET_COLUMNS, buildBudgetLines, type BudgetLabels } from './budgetExport'
import { importBudget, MAX_BUDGET_ROWS } from './budgetImport'
import type { Cell } from './tableExport'

const locale = (l: typeof cs | typeof en): BudgetLabels => ({
  kind: (k) => l.detail.kind[k],
  timing: (t) => l.budgetExport.timing[t],
  total: '',
  cumulative: '',
  period: () => '',
})
const header = (l: typeof cs | typeof en) => BUDGET_COLUMNS.map((c) => l.budgetExport.columns[c])
let seq = 0
const makeId = () => `new-${++seq}`
const withoutId = (lines: TaskLine[]) => lines.map(({ id: _id, ...rest }) => rest)

/** Export řádků jako tabulka s hlavičkou (stejně jako list Řádky v Excelu). */
function exported(p: Project, l: typeof cs | typeof en = cs): Cell[][] {
  return [header(l), ...buildBudgetLines(p, computeCosts(p, schedule(p)), locale(l)).rows]
}

describe('import rozpočtu: export → import vrátí stejné řádky', () => {
  it('vzorový projekt (česky): všechny řádky i náklady beze změny', () => {
    const p = createSampleProject(translateCs, 'cs', '2026-11-16')
    const result = importBudget(exported(p), p, makeId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const task of p.tasks) {
      expect(withoutId(result.project.tasks.find((t) => t.id === task.id)!.lines)).toEqual(withoutId(task.lines))
    }
    expect(computeCosts(result.project, schedule(result.project)).project.total).toBe(computeCosts(p, schedule(p)).project.total)
    expect(ProjectSchema.safeParse(result.project).success).toBe(true)
    expect(result.summary.lines).toBe(p.tasks.reduce((s, t) => s + t.lines.length, 0))
  })

  it('anglické hlavičky a typy se přijmou také', () => {
    const p = createSampleProject(translateCs, 'cs', '2026-11-16')
    const result = importBudget(exported(p, en), p, makeId)
    expect(result.ok).toBe(true)
  })
})

function base(): Project {
  const p = createEmptyProject({ name: 'T', language: 'cs', startDate: '2026-11-16' })
  p.professions = [
    { id: 'pr', name: 'Programátor', categoryId: 'cat-labor', capacityPerDay: 8 },
    { id: 'pr2', name: 'Montér', categoryId: 'cat-labor', capacityPerDay: 8 },
  ]
  p.workers = [{ id: 'w', name: 'Eva', professionId: 'pr', capacityPerDay: 8 }]
  p.machines = [{ id: 'm', name: 'Jeřáb', categoryId: 'cat-services', rate: 1, rateUnit: 'hour', capacityPerDay: 8 }]
  p.materials = [{ id: 'x', name: '=Kabel', unit: 'm', unitPrice: 100, categoryId: 'cat-material' }]
  p.tasks = [
    { ...createTask({ id: 'A', name: 'A', order: 0, durationDays: 5 }), lines: [{ id: 'old', kind: 'oneTime', categoryId: 'cat-services', name: 'Starý', amount: 1, timing: 'start' }] },
    { ...createTask({ id: 'B', name: 'B', order: 1, durationDays: 5 }), lines: [{ id: 'keep', kind: 'oneTime', categoryId: 'cat-services', name: 'Zůstane', amount: 2, timing: 'start' }] },
    createTask({ id: 'M', name: 'Milník', order: 2, kind: 'milestone' }),
  ]
  return p
}
const H = header(cs)
const row = (values: Partial<Record<(typeof BUDGET_COLUMNS)[number], Cell>>): Cell[] => BUDGET_COLUMNS.map((c) => values[c] ?? null)

describe('import rozpočtu: co se nahradí a výchozí hodnoty', () => {
  it('řádky činností ze souboru se nahradí, ostatní činnosti zůstanou; prázdné buňky = výchozí hodnoty', () => {
    const result = importBudget(
      [
        H,
        row({ wbs: '1', kind: 'Člověk', resource: 'Programátor', worker: 'Eva', tags: 'dotace; IT' }),
        row({ wbs: 1, kind: 'materiál', resource: "'=Kabel", quantity: '2,5', amount: '120,50' }),
        [],
        row({ wbs: '1', kind: 'Průběžný', resource: 'Nájem', amount: 1500, timing: 'měsíc', category: 'režie' }),
      ],
      base(),
      makeId,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [a, b] = result.project.tasks
    expect(withoutId(a!.lines)).toEqual([
      { kind: 'labor', categoryId: 'cat-labor', professionId: 'pr', workerId: 'w', sharePct: 100, tags: ['dotace', 'IT'] },
      { kind: 'material', categoryId: 'cat-material', materialId: 'x', quantity: 2.5, unitPriceOverride: 12_050 },
      { kind: 'recurring', categoryId: 'cat-overhead', name: 'Nájem', amount: 150_000, period: 'month' },
    ])
    expect(b!.lines.map((l) => l.id)).toEqual(['keep'])
    expect(result.summary).toEqual({ lines: 3, tasks: 1, replaced: 1 })
  })
})

describe('import rozpočtu: chyby s čísly řádků, nic se nepoužije částečně', () => {
  const errors = (rows: Cell[][]) => {
    const result = importBudget([H, ...rows], base(), makeId)
    return result.ok ? [] : result.errors.map((e) => `${e.row}:${e.code}`)
  }

  it('neznámá činnost, typ, zdroj, kategorie; špatný pracovník; nesmyslná čísla', () => {
    expect(
      errors([
        row({ wbs: '9', kind: 'Člověk', resource: 'Programátor' }),
        row({ wbs: '1', kind: 'Kouzlo', resource: 'X' }),
        row({ wbs: '1', kind: 'Člověk', resource: 'Kuchař' }),
        row({ wbs: '1', kind: 'Člověk', resource: 'Montér', worker: 'Eva' }),
        row({ wbs: '1', kind: 'Člověk', resource: 'Programátor', quantity: 150 }),
        row({ wbs: '1', kind: 'Stroj', resource: 'Bagr' }),
        row({ wbs: '1', kind: 'Materiál', resource: '=Kabel', quantity: 0 }),
        row({ wbs: '1', kind: 'Jednorázový', resource: 'Záloha', amount: 'hodně' }),
        row({ wbs: '1', kind: 'Jednorázový', resource: 'Záloha', amount: 10, timing: 'datum' }),
        row({ wbs: '1', kind: 'Průběžný', resource: 'Nájem', amount: 10, timing: 'rok' }),
        row({ wbs: '1', kind: 'Jednorázový', resource: '', amount: 10 }),
        row({ wbs: '1', kind: 'Jednorázový', resource: 'Záloha', amount: 10, category: 'Neznámá' }),
        row({ wbs: '3', kind: 'Člověk', resource: 'Programátor' }),
        row({ wbs: '1', kind: 'Jednorázový', resource: 'Záloha', amount: 10, tags: 'x'.repeat(31) }),
      ]),
    ).toEqual([
      '2:unknownTask',
      '3:badKind',
      '4:unknownProfession',
      '5:workerProfessionMismatch',
      '6:badShare',
      '7:unknownMachine',
      '8:badQuantity',
      '9:badAmount',
      '10:missingDate',
      '11:badTiming',
      '12:missingName',
      '13:unknownCategory',
      '14:lineNotAllowed',
      '15:badTags',
    ])
  })

  it('chybějící sloupce, prázdná tabulka, příliš mnoho řádků', () => {
    const missing = importBudget([['WBS', 'Poznámka'], ['1', 'x']], base(), makeId)
    expect(missing.ok === false && missing.errors).toEqual([{ row: 1, code: 'missingColumns' }])
    const empty = importBudget([H], base(), makeId)
    expect(empty.ok === false && empty.errors).toEqual([{ row: 1, code: 'empty' }])
    const many = importBudget([H, ...Array.from({ length: MAX_BUDGET_ROWS + 1 }, () => row({ wbs: '1', kind: 'Jednorázový', resource: 'a', amount: 1 }))], base(), makeId)
    expect(many.ok === false && many.errors).toEqual([{ row: 1, code: 'tooManyRows' }])
  })
})
