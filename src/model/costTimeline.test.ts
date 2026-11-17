import { describe, expect, it } from 'vitest'
import { dayToIso, isoToDay } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import { computeCosts } from './costs'
import { budgetStatus, computeCostTimeline, cumulative, distribute, summarizeCosts, totalsByCategory } from './costTimeline'
import { splitPeriods } from './periods'
import { createEmptyProject, createTask, type Project, type Task, type TaskLine } from './schema'

/*
 * Kalendář: Po–Pá, české svátky. Listopad 2026: po 16., út 17. = svátek, st 18.–pá 20., so–ne 21.–22., po 23.
 * Činnost s délkou 5 dnů od 16. 11. pracuje 16., 18., 19., 20. a 23. 11. (kalendářně 16.–23. = 8 dní).
 */
function project(tasks: Task[], extra: (p: Project) => void = () => {}): Project {
  const p = createEmptyProject({ name: 'T', language: 'cs', startDate: '2026-11-16' })
  p.professions = [{ id: 'pr-plc', name: 'Programátor', categoryId: 'cat-labor', capacityPerDay: 8, manualRate: 50_000 }] // 500 Kč/h
  p.materials = [{ id: 'x-cable', name: 'Kabel', unit: 'm', unitPrice: 3_250, categoryId: 'cat-material' }]
  p.tasks = tasks
  extra(p)
  return p
}
const task = (id: string, durationDays: number, lines: TaskLine[], order = 0): Task => ({ ...createTask({ id, name: id, order, durationDays }), lines })
const labor = (id: string, sharePct: number, tags?: string[]): TaskLine => ({
  id,
  kind: 'labor',
  categoryId: 'cat-labor',
  professionId: 'pr-plc',
  sharePct,
  ...(tags ? { tags } : {}),
})
const material = (id: string, quantity: number): TaskLine => ({ id, kind: 'material', categoryId: 'cat-material', materialId: 'x-cable', quantity })
const oneTime = (id: string, amount: number, timing: 'start' | 'end' | 'date', date?: string, tags?: string[]): TaskLine => ({
  id,
  kind: 'oneTime',
  categoryId: 'cat-services',
  name: id,
  amount,
  timing,
  ...(date ? { date } : {}),
  ...(tags ? { tags } : {}),
})
const recurring = (id: string, amount: number, period: 'day' | 'week' | 'month'): TaskLine => ({ id, kind: 'recurring', categoryId: 'cat-overhead', name: id, amount, period })

function timeline(p: Project) {
  const s = schedule(p)
  return computeCostTimeline(p, s, computeCosts(p, s))
}
/** Rozpad jednoho řádku po dnech jako { 'YYYY-MM-DD': haléře } (jen nenulové dny). */
function byDay(p: Project, lineId: string): Record<string, number> {
  const line = timeline(p).lines.find((l) => l.lineId === lineId)!
  const out: Record<string, number> = {}
  line.amounts.forEach((a, i) => {
    if (a !== 0) out[dayToIso(line.startDay + i)] = a
  })
  return out
}

describe('rozdělení částky beze ztráty haléře', () => {
  it('zbytky dostanou dny s největším zbytkem, součet sedí přesně', () => {
    expect(distribute(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(distribute(7, [1, 2])).toEqual([2, 5])
    expect(distribute(10, [0, 1, 0, 1])).toEqual([0, 5, 0, 5])
    expect(distribute(0, [1, 1])).toEqual([0, 0])
  })

  it('bez vah (žádný pracovní den) padne celá částka do prvního dne', () => {
    expect(distribute(9, [0, 0, 0])).toEqual([9, 0, 0])
  })
})

describe('kdy padne který náklad (R-04)', () => {
  it('člověk: 5 dnů × 8 h × 50 % × 500 Kč = 10 000 Kč, po 2 000 Kč v pracovní dny', () => {
    const p = project([task('A', 5, [labor('l', 50)])])
    expect(byDay(p, 'l')).toEqual({ '2026-11-16': 200_000, '2026-11-18': 200_000, '2026-11-19': 200_000, '2026-11-20': 200_000, '2026-11-23': 200_000 })
  })

  it('materiál celý v den začátku činnosti', () => {
    const p = project([task('A', 5, [material('m', 10)])])
    expect(byDay(p, 'm')).toEqual({ '2026-11-16': 32_500 })
  })

  it('jednorázový: na začátku, na konci, k datu (i mimo termín činnosti)', () => {
    const p = project([task('A', 5, [oneTime('s', 100, 'start'), oneTime('e', 200, 'end'), oneTime('d', 300, 'date', '2026-12-01')])])
    expect(byDay(p, 's')).toEqual({ '2026-11-16': 100 })
    expect(byDay(p, 'e')).toEqual({ '2026-11-23': 200 })
    expect(byDay(p, 'd')).toEqual({ '2026-12-01': 300 })
    expect(timeline(p).range).toEqual({ startDay: isoToDay('2026-11-16'), endDay: isoToDay('2026-12-01') })
  })

  it('průběžný za den do pracovních dnů, za týden a za měsíc do kalendářních dnů', () => {
    const p = project([task('A', 5, [recurring('d', 1_000, 'day'), recurring('w', 7_000, 'week'), recurring('m', 30_000, 'month')])])
    expect(Object.values(byDay(p, 'd'))).toEqual([1_000, 1_000, 1_000, 1_000, 1_000])
    // Týden: 8 kalendářních dnů × 7 000 ÷ 7 = 8 000, po 1 000 každý den (i víkend a svátek).
    expect(byDay(p, 'w')['2026-11-21']).toBe(1_000)
    expect(Object.values(byDay(p, 'w')).reduce((a, b) => a + b)).toBe(8_000)
    // Měsíc: listopad má 30 dní → 1 000 za den.
    expect(Object.values(byDay(p, 'm'))).toEqual(Array(8).fill(1_000))
  })

  it('řádek fáze se rozloží do celé spočítané délky fáze', () => {
    const phase: Task = { ...createTask({ id: 'P', name: 'P', order: 0, durationDays: 1 }), kind: 'phase', lines: [labor('l', 50)] }
    const child: Task = { ...task('A', 5, []), parentId: 'P', order: 1 }
    const p = project([phase, child])
    expect(Object.keys(byDay(p, 'l'))).toEqual(['2026-11-16', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23'])
  })

  it('položka bez termínu (kruh vazeb) se nezapočítá – a víme kolik', () => {
    const a = { ...task('A', 5, [oneTime('x', 500, 'start')]), dependencies: [{ predecessorId: 'B', type: 'FS' as const, lagDays: 0 }] }
    const b = { ...task('B', 5, [], 1), dependencies: [{ predecessorId: 'A', type: 'FS' as const, lagDays: 0 }] }
    const result = timeline(project([a, b, task('C', 1, [oneTime('y', 100, 'start')], 2)]))
    expect(result.lines.map((l) => l.lineId)).toEqual(['y'])
    expect(result).toMatchObject({ skippedLines: 1, skippedAmount: 500, total: 600 })
  })
})

describe('vzorový projekt', () => {
  it('součet náběhu = náklady projektu i každé kategorie na haléř', () => {
    const p = createSampleProject(translateCs, 'cs', '2026-11-16')
    const s = schedule(p)
    const costs = computeCosts(p, s)
    const result = computeCostTimeline(p, s, costs)
    expect(result.total).toBe(costs.project.total)
    expect(result.lines.reduce((sum, l) => sum + l.amounts.reduce((a, b) => a + b, 0), 0)).toBe(costs.project.total)
    const periods = splitPeriods(result.range!, 'month')
    const summary = summarizeCosts(p, result, periods, { groupBy: 'kind' })
    expect(summary.grandTotal).toBe(costs.project.total)
    expect(Object.fromEntries(summary.rows.map((r) => [r.key, r.total]))).toEqual({
      labor: costs.project.labor,
      machines: costs.project.machines,
      material: costs.project.material,
      other: costs.project.other,
    })
  })
})

describe('shrnutí po obdobích', () => {
  // A (5 dnů, listopad): práce 10 000 Kč (štítek dotace) + materiál 325 Kč; B (od 1. 12.): jednorázový 1 000 Kč (štítek dotace).
  const p = project([
    task('A', 5, [labor('l', 50, ['dotace']), material('m', 10)]),
    { ...task('B', 1, [oneTime('o', 100_000, 'start', undefined, ['Dotace'])], 1), constraintStart: '2026-12-01' },
  ])
  const s = schedule(p)
  const result = computeCostTimeline(p, s, computeCosts(p, s))
  const months = splitPeriods(result.range!, 'month')

  it('podle kategorií (v pořadí databáze), součty období a celkem', () => {
    const summary = summarizeCosts(p, result, months, { groupBy: 'category' })
    const rows = Object.fromEntries(summary.rows.filter((r) => r.total > 0).map((r) => [r.key, r.values]))
    expect(rows).toEqual({ 'cat-material': [32_500, 0], 'cat-labor': [1_000_000, 0], 'cat-services': [0, 100_000] })
    expect(summary.totals).toEqual([1_032_500, 100_000])
    expect(summary.grandTotal).toBe(1_132_500)
    expect(cumulative(summary.totals)).toEqual([1_032_500, 1_132_500])
  })

  it('podle fází (položek nejvyšší úrovně) a filtr štítku bez ohledu na velikost písmen', () => {
    const byPhase = summarizeCosts(p, result, months, { groupBy: 'phase' })
    expect(byPhase.rows.map((r) => [r.key, r.total])).toEqual([
      ['A', 1_032_500],
      ['B', 100_000],
    ])
    const tagged = summarizeCosts(p, result, months, { groupBy: 'phase', tag: 'DOTACE' })
    expect(tagged.rows.map((r) => [r.key, r.total])).toEqual([
      ['A', 1_000_000],
      ['B', 100_000],
    ])
  })

  it('filtry s více volbami: kategorie, fáze a druh (kombinují se, prázdný výběr = vše)', () => {
    const total = (filter: Parameters<typeof summarizeCosts>[3]['filter']) => summarizeCosts(p, result, months, { groupBy: 'category', filter }).grandTotal
    expect(total({ categories: new Set(['cat-labor', 'cat-services']) })).toBe(1_100_000)
    expect(total({ phases: new Set(['B']) })).toBe(100_000)
    expect(total({ kinds: new Set(['material', 'other']) })).toBe(132_500)
    expect(total({ phases: new Set(['A']), kinds: new Set(['material']) })).toBe(32_500)
    expect(total({ categories: new Set() })).toBe(1_132_500)
    expect(total({ phases: new Set(['nic']) })).toBe(0)
  })

  it('čtvrtletí: leden–březen, duben–červen…; krajní oříznutá', () => {
    const q = splitPeriods({ startDay: isoToDay('2026-11-16'), endDay: isoToDay('2027-05-10') }, 'quarter')
    expect(q.map((x) => [dayToIso(x.startDay), dayToIso(x.endDay)])).toEqual([
      ['2026-11-16', '2026-12-31'],
      ['2027-01-01', '2027-03-31'],
      ['2027-04-01', '2027-05-10'],
    ])
  })
})

describe('limity rozpočtu (R-06)', () => {
  const base = [task('A', 5, [labor('l', 50), material('m', 10)]), { ...task('B', 1, [oneTime('o', 100_000, 'start')], 1), constraintStart: '2026-12-01' }]

  it('plánované náklady po kategoriích (i řádky bez termínu)', () => {
    const p = project(base)
    expect(Object.fromEntries(totalsByCategory(timeline(p)))).toEqual({ 'cat-labor': 1_000_000, 'cat-material': 32_500, 'cat-services': 100_000 })
  })

  it('bez limitů: nic se nehlídá', () => {
    const p = project(base)
    expect(budgetStatus(p, timeline(p))).toEqual({ project: null, categories: [] })
  })

  it('limit projektu: utraceno, překročení a den, kdy kumulativní náklady limit přesáhnou', () => {
    const p = project(base, (x) => {
      x.budget = { limit: 700_000, categoryLimits: [] }
    })
    // 16. 11.: 2 000 + 325 Kč; 18. 11.: 4 325; 19. 11.: 6 325 > 7 000? ne; 20. 11.: 8 325 > 7 000 → přesáhne 20. 11.
    expect(budgetStatus(p, timeline(p)).project).toEqual({ limit: 700_000, spent: 1_132_500, over: 432_500, exceedDay: isoToDay('2026-11-20') })
  })

  it('limit kategorie; v limitu = over 0 a žádný den překročení', () => {
    const p = project(base, (x) => {
      x.budget = {
        limit: 2_000_000,
        categoryLimits: [
          { categoryId: 'cat-services', limit: 50_000 },
          { categoryId: 'cat-labor', limit: 1_000_000 },
        ],
      }
    })
    const status = budgetStatus(p, timeline(p))
    expect(status.project).toEqual({ limit: 2_000_000, spent: 1_132_500, over: 0, exceedDay: null })
    expect(status.categories).toEqual([
      { categoryId: 'cat-services', limit: 50_000, spent: 100_000, over: 50_000, exceedDay: isoToDay('2026-12-01') },
      { categoryId: 'cat-labor', limit: 1_000_000, spent: 1_000_000, over: 0, exceedDay: null },
    ])
  })
})

describe('výkon', () => {
  it('300 činností × 3 řádky, rok – náběh a měsíční shrnutí pod 100 ms', () => {
    const p = project([], (x) => {
      x.tasks = Array.from({ length: 300 }, (_, i) => ({
        ...createTask({ id: `t${i}`, name: `t${i}`, order: i, durationDays: 5 + (i % 40) }),
        dependencies: i > 0 && i % 5 !== 0 ? [{ predecessorId: `t${i - 1}`, type: 'SS' as const, lagDays: 2 }] : [],
        lines: [labor(`a${i}`, 50, i % 3 === 0 ? ['dotace'] : undefined), recurring(`r${i}`, 30_000, 'month'), material(`m${i}`, 3)],
      }))
    })
    const s = schedule(p)
    const costs = computeCosts(p, s)
    computeCostTimeline(p, s, costs) // zahřátí
    const t0 = performance.now()
    const result = computeCostTimeline(p, s, costs)
    const months = splitPeriods(result.range!, 'month')
    summarizeCosts(p, result, months, { groupBy: 'category' })
    summarizeCosts(p, result, months, { groupBy: 'phase', tag: 'dotace' })
    budgetStatus(p, result)
    expect(performance.now() - t0).toBeLessThan(100)
  })
})

describe('ukazatele dashboardu Náklady v čase (A-03)', () => {
  it('celkem, do dneška, zbývá, nejdražší období a průměr za období', async () => {
    const { costKpis } = await import('./costTimeline')
    expect(costKpis([100, 0, 400, 300], 250)).toEqual({ total: 800, toDate: 250, remaining: 550, peakIndex: 2, peak: 400, average: 200 })
    expect(costKpis([], 0)).toEqual({ total: 0, toDate: 0, remaining: 0, peakIndex: null, peak: 0, average: 0 })
  })
})
