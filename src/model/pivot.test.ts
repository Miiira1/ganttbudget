import { describe, expect, it } from 'vitest'
import { isoToDay } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import { computeCostTimeline } from './costTimeline'
import { computeCosts } from './costs'
import { buildFacts, type Facts } from './facts'
import { computeLoad } from './load'
import { NONE, pivot, type PivotConfig } from './pivot'
import { createEmptyProject, createTask, type Project, type Task, type TaskLine } from './schema'

/*
 * Kalendář: Po–Pá, české svátky. Činnost A: 5 dnů od po 16. 11. 2026 (16., 18., 19., 20., 23. 11.).
 * Činnost B: 1 den, začne nejdříve út 1. 12. 2026.
 * Programátor 8 h/den, 500 Kč/h; Eva (středisko Vývoj) a Jan (bez střediska) jsou programátoři.
 */
function project(): Project {
  const p = createEmptyProject({ name: 'T', language: 'cs', startDate: '2026-11-16' })
  p.departments = [{ id: 'd-dev', name: 'Vývoj' }]
  p.professions = [{ id: 'pr', name: 'Programátor', categoryId: 'cat-labor', capacityPerDay: 8, manualRate: 50_000 }]
  p.workers = [
    { id: 'w-eva', name: 'Eva', professionId: 'pr', departmentId: 'd-dev', capacityPerDay: 8 },
    { id: 'w-jan', name: 'Jan', professionId: 'pr', capacityPerDay: 8 },
  ]
  p.materials = [{ id: 'x', name: 'Kabel', unit: 'm', unitPrice: 3_250, categoryId: 'cat-material' }]
  const A: Task = {
    ...createTask({ id: 'A', name: 'Analýza', order: 0, durationDays: 5 }),
    lines: [
      { id: 'l-eva', kind: 'labor', categoryId: 'cat-labor', professionId: 'pr', workerId: 'w-eva', sharePct: 50, tags: ['dotace', 'IT'] },
      { id: 'l-mat', kind: 'material', categoryId: 'cat-material', materialId: 'x', quantity: 10 },
    ],
  }
  const B: Task = {
    ...createTask({ id: 'B', name: 'Nákup', order: 1, durationDays: 1 }),
    constraintStart: '2026-12-01',
    lines: [
      { id: 'l-zal', kind: 'oneTime', categoryId: 'cat-services', name: 'Záloha', amount: 100_000, timing: 'start', tags: ['Dotace'] },
      { id: 'l-jan', kind: 'labor', categoryId: 'cat-labor', professionId: 'pr', workerId: 'w-jan', sharePct: 25 },
    ] satisfies TaskLine[],
  }
  p.tasks = [A, B]
  return p
}
function facts(p: Project): Facts {
  const s = schedule(p)
  const costs = computeCosts(p, s)
  return buildFacts(p, s, computeCostTimeline(p, s, costs))
}
const base: PivotConfig = { rows: ['category'], column: null, metric: 'cost', agg: 'sum', period: 'month', filters: {} }
/** Hodnoty řádků jako { klíč: hodnota } (bez sloupců). */
function rowTotals(p: Project, config: Partial<PivotConfig>): Record<string, number | null> {
  const result = pivot(p, facts(p), { ...base, ...config })
  return Object.fromEntries(result.rows.map((r) => [r.path.join(' › '), result.value(r.path, null)]))
}

describe('faktová vrstva', () => {
  it('řádek činnosti s rozpadem nákladu a hodin po dnech; zdroj, profese, středisko', () => {
    const f = facts(project())
    const eva = f.lines.find((l) => l.lineId === 'l-eva')!
    expect(eva).toMatchObject({ taskId: 'A', rootId: 'A', kind: 'labor', categoryId: 'cat-labor', resource: 'worker:w-eva', professionId: 'pr', departmentId: 'd-dev', totalCost: 1_000_000, totalHours: 20 })
    expect(eva.hours.filter((h) => h > 0)).toEqual([4, 4, 4, 4, 4])
    expect(f.lines.find((l) => l.lineId === 'l-zal')).toMatchObject({ resource: 'name:Záloha', professionId: null, departmentId: null, totalHours: 0 })
    expect(f.range).toEqual({ startDay: isoToDay('2026-11-16'), endDay: isoToDay('2026-12-01') })
  })

  it('vzorový projekt: součet nákladů = náklady projektu, hodiny pracovníků = vytížení', () => {
    const p = createSampleProject(translateCs, 'cs', '2026-11-16')
    const s = schedule(p)
    const costs = computeCosts(p, s)
    const f = buildFacts(p, s, computeCostTimeline(p, s, costs))
    expect(f.lines.reduce((sum, l) => sum + l.totalCost, 0)).toBe(costs.project.total)
    const load = computeLoad(p, s)
    for (const worker of p.workers) {
      const demand = load.resources.find((r) => r.key === `worker:${worker.id}`)!.demand.reduce((a, b) => a + b, 0)
      const hours = f.lines.filter((l) => l.resource === `worker:${worker.id}`).reduce((sum, l) => sum + l.totalHours, 0)
      expect(hours).toBeCloseTo(demand, 6)
    }
  })
})

describe('kontingenční tabulka: součty a dimenze', () => {
  const p = project()

  it('náklady podle kategorií (pořadí databáze) a celkem', () => {
    expect(rowTotals(p, {})).toEqual({ 'cat-material': 32_500, 'cat-labor': 1_100_000, 'cat-services': 100_000 })
    const result = pivot(p, facts(p), base)
    expect(result.value(null, null)).toBe(1_232_500)
  })

  it('sloupce po měsících: listopad / prosinec; součty sloupců i řádků', () => {
    const result = pivot(p, facts(p), { ...base, column: 'period' })
    // Klíč období = jeho první den v rozsahu projektu (listopad začíná až 16. 11.).
    expect(result.columns.map((c) => c.key)).toEqual([String(isoToDay('2026-11-16')), String(isoToDay('2026-12-01'))])
    const [nov, dec] = result.columns.map((c) => c.key)
    expect(result.value(['cat-labor'], nov!)).toBe(1_000_000)
    expect(result.value(['cat-labor'], dec!)).toBe(100_000)
    expect(result.value(['cat-labor'], null)).toBe(1_100_000)
    expect(result.value(null, dec!)).toBe(200_000)
  })

  it('štítky: řádek se dvěma štítky je v obou, Celkem ho počítá jednou; bez štítku = (neuvedeno)', () => {
    const result = pivot(p, facts(p), { ...base, rows: ['tag'] })
    expect(Object.fromEntries(result.rows.map((r) => [r.path[0], result.value(r.path, null)]))).toEqual({ dotace: 1_100_000, it: 1_000_000, [NONE]: 132_500 })
    expect(result.value(null, null)).toBe(1_232_500)
    expect(result.tagDuplicates).toBe(true)
  })

  it('dvě úrovně řádků (fáze › druh) s mezisoučty', () => {
    const result = pivot(p, facts(p), { ...base, rows: ['phase', 'kind'] })
    expect(result.rows.map((r) => r.path.join(' › '))).toEqual(['A', 'A › labor', 'A › material', 'B', 'B › labor', 'B › other'])
    expect(result.value(['A'], null)).toBe(1_032_500)
    expect(result.value(['B', 'other'], null)).toBe(100_000)
  })

  it('hodiny podle zdroje a podle střediska', () => {
    expect(rowTotals(p, { rows: ['resource'], metric: 'hours' })).toEqual({ 'worker:w-eva': 20, 'worker:w-jan': 2, 'material:x': 0, 'name:Záloha': 0 })
    expect(rowTotals(p, { rows: ['department'], metric: 'hours' })).toEqual({ 'd-dev': 20, [NONE]: 2 })
  })
})

describe('kontingenční tabulka: agregace a filtry', () => {
  const p = project()

  it('počet řádků, průměr, minimum a maximum na řádek činnosti', () => {
    expect(rowTotals(p, { rows: ['task'], agg: 'count' })).toEqual({ A: 2, B: 2 })
    expect(rowTotals(p, { rows: ['task'], agg: 'avg' })).toEqual({ A: 516_250, B: 100_000 })
    expect(rowTotals(p, { rows: ['task'], agg: 'min' })).toEqual({ A: 32_500, B: 100_000 })
    expect(rowTotals(p, { rows: ['task'], agg: 'max' })).toEqual({ A: 1_000_000, B: 100_000 })
  })

  it('s obdobím se počítají jen řádky, které v něm mají hodnotu', () => {
    const result = pivot(p, facts(p), { ...base, rows: ['kind'], column: 'period', agg: 'count' })
    const dec = result.columns[1]!.key
    expect(result.value(['labor'], dec)).toBe(1)
    expect(result.value(['material'], dec)).toBeNull()
  })

  it('filtry s více volbami se kombinují; štítek (neuvedeno) jde vybrat', () => {
    const grand = (filters: PivotConfig['filters']) => pivot(p, facts(p), { ...base, filters }).value(null, null)
    expect(grand({ kind: ['labor'] })).toBe(1_100_000)
    expect(grand({ kind: ['labor'], department: [NONE] })).toBe(100_000)
    expect(grand({ tag: [NONE] })).toBe(132_500)
    expect(grand({ tag: ['it'], category: ['cat-material'] })).toBeNull()
    expect(grand({ category: [] })).toBe(1_232_500)
    // „Odebrat vše“ ve filtru = hodnota, která neodpovídá žádné položce → nic.
    expect(grand({ category: [' nic'] })).toBeNull()
  })
})

describe('výkon', () => {
  it('300 činností × 3 řádky, rok: fakta + tabulka po týdnech pod 100 ms', () => {
    const p = project()
    p.tasks = Array.from({ length: 300 }, (_, i) => ({
      ...createTask({ id: `t${i}`, name: `t${i}`, order: i, durationDays: 5 + (i % 40) }),
      dependencies: i > 0 && i % 5 !== 0 ? [{ predecessorId: `t${i - 1}`, type: 'SS' as const, lagDays: 2 }] : [],
      lines: [
        { id: `a${i}`, kind: 'labor' as const, categoryId: 'cat-labor', professionId: 'pr', workerId: i % 2 ? 'w-eva' : 'w-jan', sharePct: 50, ...(i % 3 === 0 ? { tags: ['dotace'] } : {}) },
        { id: `r${i}`, kind: 'recurring' as const, categoryId: 'cat-overhead', name: 'Nájem', amount: 30_000, period: 'month' as const },
        { id: `m${i}`, kind: 'material' as const, categoryId: 'cat-material', materialId: 'x', quantity: 3 },
      ],
    }))
    const s = schedule(p)
    const costs = computeCosts(p, s)
    const timeline = computeCostTimeline(p, s, costs)
    // Nejrychlejší ze tří běhů: měří se rychlost výpočtu, ne momentální vytížení počítače.
    let best = Infinity
    for (let run = 0; run < 3; run++) {
      const t0 = performance.now()
      const f = buildFacts(p, s, timeline)
      pivot(p, f, { ...base, rows: ['phase', 'category'], column: 'period', period: 'week' })
      pivot(p, f, { ...base, rows: ['tag'], column: 'kind', metric: 'hours', agg: 'avg' })
      best = Math.min(best, performance.now() - t0)
    }
    expect(best).toBeLessThan(100)
  })
})

describe('dimenze ve schématu pohledů', () => {
  it('schéma uložených pohledů zná stejné dimenze jako kontingenční tabulka', async () => {
    const { VIEW_DIMS, VIEW_FACT_DIMS } = await import('./schema')
    const { FACT_DIMS, PIVOT_DIMS } = await import('./pivot')
    expect([...VIEW_DIMS]).toEqual([...PIVOT_DIMS])
    expect([...VIEW_FACT_DIMS]).toEqual([...FACT_DIMS])
  })
})

describe('hodnoty dimenzí pro filtry', () => {
  it('všechny klíče dimenze v pořadí projektu, (neuvedeno) na konci', async () => {
    const { dimensionKeys } = await import('./pivot')
    const p = project()
    const f = facts(p)
    expect(dimensionKeys(p, f, 'category')).toEqual(['cat-material', 'cat-labor', 'cat-services'])
    expect(dimensionKeys(p, f, 'tag')).toEqual(['dotace', 'it', NONE])
    expect(dimensionKeys(p, f, 'resource')).toEqual(['worker:w-eva', 'worker:w-jan', 'material:x', 'name:Záloha'])
  })
})
