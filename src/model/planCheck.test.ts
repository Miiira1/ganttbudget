import { describe, expect, it } from 'vitest'
import { schedule } from '../engine/schedule'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import type { BudgetStatus } from './costTimeline'
import type { LoadResult, ResourceLoad } from './load'
import { checkPlan, type PlanIssue } from './planCheck'
import { createEmptyProject, createTask, type DependencyType, type Project, type Task, type TaskKind } from './schema'

/** Pomocník: položka s vazbami [předchůdce, prodleva, typ]. */
function task(id: string, durationDays: number, preds: [string, number, DependencyType?][] = [], kind: TaskKind = 'task', patch: Partial<Task> = {}): Task {
  return {
    ...createTask({ id, name: id, order: 0, kind, durationDays }),
    dependencies: preds.map(([predecessorId, lagDays, type = 'FS']) => ({ predecessorId, type, lagDays })),
    ...patch,
  }
}

/** Projekt od pondělí 16. 11. 2026 (17. 11. je svátek); pořadí = pořadí v seznamu. */
function project(tasks: Task[], patch: Partial<Project> = {}): Project {
  const p = createEmptyProject({ name: 'Test', language: 'cs', startDate: '2026-11-16' })
  return { ...p, ...patch, tasks: tasks.map((t, order) => ({ ...t, order })) }
}

const NO_LOAD: LoadResult = { range: null, resources: [], overloadedCount: 0 }
const NO_BUDGET: BudgetStatus = { project: null, categories: [] }
/** Dnešek před začátkem projektu – kontrola „mělo začít“ se neozve. */
const BEFORE = '2026-11-01'

function check(p: Project, options: { load?: LoadResult; budget?: BudgetStatus; today?: string } = {}): PlanIssue[] {
  return checkPlan({ project: p, scheduled: schedule(p), load: options.load ?? NO_LOAD, budget: options.budget ?? NO_BUDGET, today: options.today ?? BEFORE })
}
const kinds = (issues: PlanIssue[]) => issues.map((i) => `${i.kind}:${'taskId' in i ? i.taskId : ''}`)

describe('kontrola plánu – bez varování', () => {
  it('prázdný projekt nemá varování', () => {
    expect(check(project([]))).toEqual([])
  })

  it('řetěz A → B → C je v pořádku', () => {
    expect(check(project([task('A', 2), task('B', 3, [['A', 0]]), task('C', 1, [['B', 0]])]))).toEqual([])
  })

  it('vzorový projekt hlásí jen činnost bez následníka (náhradní ruční výroba) a nic dalšího', () => {
    const p = createSampleProject(translateCs, 'cs', '2027-01-04')
    expect(kinds(check(p))).toEqual(['noSuccessor:sample-t6c'])
  })
})

describe('chybějící vazby', () => {
  it('první položka bez předchůdce je začátek projektu – bez varování, další ano', () => {
    const issues = check(project([task('A', 2), task('B', 2), task('C', 1, [['A', 0], ['B', 0]])]))
    expect(kinds(issues)).toEqual(['noPredecessor:B'])
  })

  it('položka s pevným začátkem (📌) předchůdce mít nemusí', () => {
    const issues = check(project([task('A', 2), task('B', 2, [], 'task', { constraintStart: '2026-11-23' }), task('C', 1, [['A', 0], ['B', 0]])]))
    expect(issues).toEqual([])
  })

  it('položka bez následníka, která neskončí s koncem projektu, se ohlásí', () => {
    // A a C (5 dnů) začínají spolu a určí konec projektu; B (2 dny) skončí dřív a nic na něj nečeká.
    const issues = check(project([task('A', 5), task('B', 2, [['A', 0, 'SS']]), task('C', 5, [['A', 0, 'SS']])]))
    expect(kinds(issues)).toEqual(['noSuccessor:B'])
  })

  it('víc položek končících s koncem projektu je v pořádku', () => {
    expect(check(project([task('A', 2), task('B', 3, [['A', 0]]), task('C', 3, [['A', 0]])]))).toEqual([])
  })

  it('fáze se nepočítají (vazby zatím nemají), kontrolují se jen jejich položky', () => {
    const issues = check(
      project([task('P', 0, [], 'phase'), task('A', 2, [], 'task', { parentId: 'P' }), task('Q', 0, [], 'phase'), task('B', 2, [['A', 0]], 'task', { parentId: 'Q' })]),
    )
    expect(issues).toEqual([])
  })

  it('položky v kruhu (bez termínu) nehlásí chybějící následníky ani zpoždění', () => {
    const issues = check(project([task('A', 2, [['B', 0]]), task('B', 2, [['A', 0]])]), { today: '2027-06-01' })
    expect(issues).toEqual([])
  })
})

describe('prázdná fáze a nulová délka', () => {
  it('fáze bez položek se ohlásí', () => {
    const issues = check(project([task('A', 2), task('P', 0, [], 'phase')]))
    expect(kinds(issues)).toEqual(['emptyPhase:P'])
  })

  it('činnost s délkou 0 se ohlásí, milník ne', () => {
    const issues = check(project([task('A', 2), task('B', 0, [['A', 0]]), task('M', 0, [['B', 0]], 'milestone')]))
    expect(kinds(issues)).toEqual(['zeroDuration:B'])
  })
})

describe('vazba do minulosti – předstih delší než předchůdce', () => {
  it('FS s předstihem delším než předchůdce', () => {
    // A trvá 3 dny, B začne 4 dny před jeho koncem → dřív, než A začne.
    const issues = check(project([task('A', 3, [], 'task', { constraintStart: '2026-11-30' }), task('B', 2, [['A', -4]])]))
    expect(issues).toContainEqual({ kind: 'leadBeforePredecessor', taskId: 'B', predecessorId: 'A', lagDays: -4, type: 'FS' })
  })

  it('FS s předstihem kratším nebo rovným délce předchůdce je běžný překryv', () => {
    const issues = check(project([task('A', 3), task('B', 2, [['A', -3]])]))
    expect(issues.filter((i) => i.kind === 'leadBeforePredecessor')).toEqual([])
  })

  it('SS se záporným posunem začne před předchůdcem', () => {
    const issues = check(project([task('A', 3), task('B', 2, [['A', -1, 'SS']])]))
    expect(kinds(issues)).toContain('leadBeforePredecessor:B')
  })

  it('FF se záporným posunem jen když by následník začal před předchůdcem', () => {
    // A 3 dny; B 2 dny skončí 1 den před koncem A → začne 2. den A: v pořádku.
    expect(check(project([task('A', 3), task('B', 2, [['A', -1, 'FF']])])).filter((i) => i.kind === 'leadBeforePredecessor')).toEqual([])
    // B 3 dny skončí 1 den před koncem A → začne den před A.
    expect(kinds(check(project([task('A', 3), task('B', 3, [['A', -1, 'FF']])])))).toContain('leadBeforePredecessor:B')
  })

  it('FF a SF bez prodlevy jsou běžné vazby, ne varování', () => {
    const issues = check(project([task('A', 3), task('B', 5, [['A', 0, 'FF']]), task('C', 2, [['A', 0, 'SF']])]))
    expect(issues.filter((i) => i.kind === 'leadBeforePredecessor')).toEqual([])
  })

  it('SF se záporným posunem se ohlásí', () => {
    const issues = check(project([task('A', 3, [], 'task', { constraintStart: '2026-11-30' }), task('B', 2, [['A', -1, 'SF']])]))
    expect(kinds(issues)).toContain('leadBeforePredecessor:B')
  })
})

describe('vazba do minulosti – mělo začít, a nezačalo', () => {
  const p = () => project([task('A', 3), task('B', 2, [['A', 0]]), task('M', 0, [['B', 0]], 'milestone')])

  it('činnost se začátkem před dneškem a 0 % hotovo se ohlásí (dnešek sám ještě ne)', () => {
    // A: 16., 18., 19. 11.; B: 20., 23. 11.; M: 23. 11.
    const issues = check(p(), { today: '2026-11-20' })
    expect(issues).toEqual([{ kind: 'notStarted', taskId: 'A', start: '2026-11-16' }])
  })

  it('rozpracovaná činnost (% hotovo > 0) se neohlásí', () => {
    const q = p()
    q.tasks[0]!.percentComplete = 10
    expect(check(q, { today: '2026-11-20' })).toEqual([])
  })

  it('nesplněný milník po svém termínu se ohlásí', () => {
    const issues = check(p(), { today: '2026-11-24' })
    expect(kinds(issues)).toEqual(['notStarted:A', 'notStarted:B', 'notStarted:M'])
  })

  it('fáze se neohlásí (% hotovo se jí počítá)', () => {
    const q = project([task('P', 0, [], 'phase'), task('A', 3, [], 'task', { parentId: 'P', percentComplete: 50 })])
    expect(check(q, { today: '2026-12-01' })).toEqual([])
  })
})

describe('přetížení a rozpočet', () => {
  const resource = (patch: Partial<ResourceLoad>): ResourceLoad => ({
    key: 'worker:w1',
    kind: 'worker',
    id: 'w1',
    name: 'Novák',
    demand: new Float64Array(0),
    capacity: new Float64Array(0),
    hasCapacity: true,
    overloadedDays: [],
    contributions: [],
    ...patch,
  })

  it('přetížený zdroj se ohlásí s počtem dnů a prvním dnem', () => {
    const first = Math.round(Date.UTC(2026, 10, 18) / 86_400_000)
    const load: LoadResult = {
      range: null,
      resources: [resource({ overloadedDays: [first, first + 1] }), resource({ key: 'machine:m1', kind: 'machine', id: 'm1', name: 'Jeřáb' })],
      overloadedCount: 1,
    }
    expect(check(project([task('A', 3)]), { load })).toEqual([
      { kind: 'overload', resourceKind: 'worker', resourceId: 'w1', name: 'Novák', days: 2, firstDate: '2026-11-18' },
    ])
  })

  it('profese bez pracovníků (kapacita neznámá) se neohlásí', () => {
    const load: LoadResult = { range: null, resources: [resource({ kind: 'profession', hasCapacity: false, overloadedDays: [1] })], overloadedCount: 0 }
    expect(check(project([task('A', 3)]), { load })).toEqual([])
  })

  it('překročený limit projektu a kategorie se ohlásí, dodržený ne', () => {
    const day = Math.round(Date.UTC(2026, 11, 1) / 86_400_000)
    const budget: BudgetStatus = {
      project: { limit: 1000, spent: 1500, over: 500, exceedDay: day },
      categories: [
        { categoryId: 'c1', limit: 100, spent: 50, over: 0, exceedDay: null },
        { categoryId: 'c2', limit: 100, spent: 300, over: 200, exceedDay: day },
      ],
    }
    expect(check(project([task('A', 3)]), { budget })).toEqual([
      { kind: 'budgetOver', categoryId: null, over: 500, exceedDate: '2026-12-01' },
      { kind: 'budgetOver', categoryId: 'c2', over: 200, exceedDate: '2026-12-01' },
    ])
  })
})

describe('pořadí varování', () => {
  it('podle druhu (rozpočet, přetížení, vazby…), uvnitř druhu v pořadí plánu', () => {
    const budget: BudgetStatus = { project: { limit: 1, spent: 2, over: 1, exceedDay: null }, categories: [] }
    const issues = check(project([task('A', 2), task('P', 0, [], 'phase'), task('B', 0, [['A', 0]]), task('C', 1, [['B', 0]])]), { budget })
    expect(kinds(issues)).toEqual(['budgetOver:', 'zeroDuration:B', 'emptyPhase:P'])
  })
})
