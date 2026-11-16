/**
 * Časový náběh nákladů (fáze 7, R-04, R-06) – čisté funkce, testy v costTimeline.test.ts.
 *
 * Každý řádek se rozloží do dnů; součet dnů se vždy rovná nákladu řádku na haléř
 * (zbytky po dělení dostanou dny s největším zbytkem):
 *  - člověk, stroj, průběžný za den: rovnoměrně do pracovních dnů položky,
 *  - materiál: celý v den začátku položky,
 *  - jednorázový: na začátku / na konci položky / k zadanému datu,
 *  - průběžný za týden: do kalendářních dnů rovným dílem,
 *  - průběžný za měsíc: do kalendářních dnů, den = částka ÷ počet dní jeho měsíce.
 * Řádky fáze se rozloží do její spočítané délky. Položka bez termínu (kruh vazeb) se nezapočítá.
 */
import { createWorkCalendar, dayToIso, isoToDay } from '../engine/calendar'
import type { ScheduleResult } from '../engine/schedule'
import type { CostsResult, CostSummary } from './costs'
import type { DayRange } from './periods'
import { nameKey, type Project, type TaskLine } from './schema'

export interface LineTimeline {
  taskId: string
  lineId: string
  kind: TaskLine['kind']
  categoryId: string
  tags: readonly string[]
  /** První den rozpadu; amounts[i] = haléře v den startDay + i. */
  startDay: number
  amounts: number[]
  /** Náklad řádku (= součet amounts). */
  total: number
}

export interface CostTimeline {
  /** Od prvního do posledního dne s nákladem; null = žádný náklad v čase. */
  range: DayRange | null
  /** Jen řádky s nenulovým nákladem a spočítaným termínem. */
  lines: LineTimeline[]
  /** Řádky s nákladem, jejichž položka nemá termín (nezapočtené v čase). */
  skippedLines: number
  skippedAmount: number
  /** Náklady kategorií, které se nedaly umístit v čase (pro limity). */
  skippedByCategory: Map<string, number>
  /** Celkový náklad projektu = umístěné + neumístěné (= náklady projektu z costs.ts). */
  total: number
}

/**
 * Rozdělí celou částku (haléře) podle vah. Celé haléře podle podílu dolů, zbylé haléře
 * dostanou položky s největším zbytkem (při shodě dřívější). Bez vah vše do první položky.
 */
export function distribute(total: number, weights: readonly number[]): number[] {
  const result = weights.map(() => 0)
  if (weights.length === 0 || total === 0) return result
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) {
    result[0] = total
    return result
  }
  const remainders: { index: number; rest: number }[] = []
  let assigned = 0
  weights.forEach((w, index) => {
    const exact = (total * w) / sum
    const whole = Math.floor(exact + 1e-9)
    result[index] = whole
    assigned += whole
    remainders.push({ index, rest: exact - whole })
  })
  remainders.sort((a, b) => b.rest - a.rest || a.index - b.index)
  for (let k = 0; assigned < total; k++, assigned++) result[remainders[k % remainders.length]!.index]! += 1
  return result
}

/** Počet dní měsíce, do kterého den patří (bez převodu na text – volá se pro každý den). */
const daysInMonthOf = (day: number) => {
  const date = new Date(day * 86_400_000)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

export function computeCostTimeline(project: Project, scheduleResult: ScheduleResult, costs: CostsResult): CostTimeline {
  const calendar = createWorkCalendar(project.calendar)
  // Řádky se ve dnech hodně překrývají – pracovní dny a délky měsíců se zjistí jen jednou.
  const workingCache = new Map<number, boolean>()
  const monthCache = new Map<number, number>()
  const work = {
    isWorkingDay: (day: number) => {
      let value = workingCache.get(day)
      if (value === undefined) workingCache.set(day, (value = calendar.isWorkingDay(day)))
      return value
    },
  }
  const monthDays = (day: number) => {
    let value = monthCache.get(day)
    if (value === undefined) monthCache.set(day, (value = daysInMonthOf(day)))
    return value
  }
  const lines: LineTimeline[] = []
  const skippedByCategory = new Map<string, number>()
  let skippedLines = 0
  let skippedAmount = 0
  let placed = 0
  let rangeStart = Infinity
  let rangeEnd = -Infinity

  for (const task of project.tasks) {
    const s = scheduleResult.tasks.get(task.id)
    const startDay = s?.start ? isoToDay(s.start) : null
    const finishDay = s?.finish ? isoToDay(s.finish) : null
    for (const line of task.lines) {
      const amount = costs.lines.get(line.id)?.amount ?? 0
      if (amount === 0) continue
      if (startDay === null || finishDay === null) {
        skippedLines++
        skippedAmount += amount
        skippedByCategory.set(line.categoryId, (skippedByCategory.get(line.categoryId) ?? 0) + amount)
        continue
      }
      let first = startDay
      let weights: number[]
      const spanDays = () => Array.from({ length: finishDay - startDay + 1 }, (_, i) => startDay + i)
      switch (line.kind) {
        case 'material':
          weights = [1]
          break
        case 'oneTime':
          first = line.timing === 'start' ? startDay : line.timing === 'end' ? finishDay : isoToDay(line.date ?? dayToIso(startDay))
          weights = [1]
          break
        case 'recurring':
          weights =
            line.period === 'day'
              ? spanDays().map((d) => (work.isWorkingDay(d) ? 1 : 0))
              : line.period === 'week'
                ? spanDays().map(() => 1)
                : spanDays().map((d) => 1 / monthDays(d))
          break
        default: // člověk, stroj
          weights = spanDays().map((d) => (work.isWorkingDay(d) ? 1 : 0))
      }
      const amounts = distribute(amount, weights)
      lines.push({ taskId: task.id, lineId: line.id, kind: line.kind, categoryId: line.categoryId, tags: line.tags ?? [], startDay: first, amounts, total: amount })
      placed += amount
      rangeStart = Math.min(rangeStart, first)
      rangeEnd = Math.max(rangeEnd, first + amounts.length - 1)
    }
  }
  return {
    range: rangeStart <= rangeEnd ? { startDay: rangeStart, endDay: rangeEnd } : null,
    lines,
    skippedLines,
    skippedAmount,
    skippedByCategory,
    total: placed + skippedAmount,
  }
}

/** Kumulativní součet (od začátku). */
export function cumulative(values: readonly number[]): number[] {
  let sum = 0
  return values.map((v) => (sum += v))
}

export type CostGroupBy = 'category' | 'phase' | 'kind'
export type CostKind = (typeof KIND_ORDER)[number]

/** Filtry s více volbami (prázdná nebo chybějící množina = bez omezení). Kombinují se (a zároveň). */
export interface CostFilter {
  categories?: ReadonlySet<string>
  /** ID položek nejvyšší úrovně (fáze nebo samostatné činnosti). */
  phases?: ReadonlySet<string>
  kinds?: ReadonlySet<string>
}

export interface CostRow {
  /** ID kategorie / ID položky nejvyšší úrovně / druh (labor, machines, material, other). */
  key: string
  values: number[]
  total: number
}

export interface CostSummaryTable {
  rows: CostRow[]
  /** Součet všech řádků po obdobích. */
  totals: number[]
  grandTotal: number
}

/** Druh nákladu podle typu řádku (stejné skupiny jako bublina sloupce Náklady). */
const KIND_GROUP: Record<TaskLine['kind'], keyof Omit<CostSummary, 'total'>> = {
  labor: 'labor',
  machine: 'machines',
  material: 'material',
  oneTime: 'other',
  recurring: 'other',
}
export const KIND_ORDER = ['labor', 'machines', 'material', 'other'] as const

/** Položka nejvyšší úrovně pro každou položku (fáze, nebo samostatná činnost). */
export function rootsOf(project: Project): { order: string[]; rootOf: Map<string, string> } {
  const byId = new Map(project.tasks.map((t) => [t.id, t]))
  const rootOf = new Map<string, string>()
  for (const task of project.tasks) {
    let current = task
    for (let guard = 0; current.parentId !== null && byId.has(current.parentId) && guard < 1000; guard++) current = byId.get(current.parentId)!
    rootOf.set(task.id, current.id)
  }
  const order = project.tasks
    .filter((t) => rootOf.get(t.id) === t.id)
    .sort((a, b) => a.order - b.order)
    .map((t) => t.id)
  return { order, rootOf }
}

/**
 * Shrnutí náběhu po obdobích: řádky podle kategorie (v pořadí databáze), položky nejvyšší úrovně
 * (v pořadí plánu), nebo druhu nákladu. Volitelně jen řádky se štítkem (velikost písmen se nerozlišuje).
 */
export function summarizeCosts(
  project: Project,
  timeline: CostTimeline,
  periods: readonly DayRange[],
  options: { groupBy: CostGroupBy; tag?: string | null; filter?: CostFilter },
): CostSummaryTable {
  const range = timeline.range
  // Pro každý den rozsahu index období (-1 = mimo zobrazená období).
  const periodOfDay = new Int32Array(range ? range.endDay - range.startDay + 1 : 0).fill(-1)
  if (range) {
    periods.forEach((p, index) => {
      for (let day = Math.max(p.startDay, range.startDay); day <= Math.min(p.endDay, range.endDay); day++) periodOfDay[day - range.startDay] = index
    })
  }

  const filter = options.filter ?? {}
  const active = (set?: ReadonlySet<string>) => (set && set.size > 0 ? set : null)
  const categories = active(filter.categories)
  const phases = active(filter.phases)
  const kinds = active(filter.kinds)
  const { order: rootOrder, rootOf } = options.groupBy === 'phase' || phases ? rootsOf(project) : { order: [], rootOf: new Map<string, string>() }
  const keys: readonly string[] =
    options.groupBy === 'category' ? project.costCategories.map((c) => c.id) : options.groupBy === 'phase' ? rootOrder : KIND_ORDER
  const rows = new Map<string, CostRow>(keys.map((key) => [key, { key, values: periods.map(() => 0), total: 0 }]))
  const tag = options.tag ? nameKey(options.tag) : null

  for (const line of timeline.lines) {
    if (tag !== null && !line.tags.some((t) => nameKey(t) === tag)) continue
    if (categories && !categories.has(line.categoryId)) continue
    if (kinds && !kinds.has(KIND_GROUP[line.kind])) continue
    if (phases && !phases.has(rootOf.get(line.taskId) ?? line.taskId)) continue
    const key = options.groupBy === 'category' ? line.categoryId : options.groupBy === 'phase' ? (rootOf.get(line.taskId) ?? line.taskId) : KIND_GROUP[line.kind]
    let row = rows.get(key)
    if (!row) {
      row = { key, values: periods.map(() => 0), total: 0 }
      rows.set(key, row)
    }
    line.amounts.forEach((amount, i) => {
      if (amount === 0 || !range) return
      const index = periodOfDay[line.startDay + i - range.startDay]!
      if (index >= 0) {
        row.values[index]! += amount
        row.total += amount
      }
    })
  }
  const list = [...rows.values()]
  const totals = periods.map((_, i) => list.reduce((sum, r) => sum + r.values[i]!, 0))
  return { rows: list, totals, grandTotal: totals.reduce((a, b) => a + b, 0) }
}

export interface LimitStatus {
  limit: number
  /** Plánované náklady (haléře). */
  spent: number
  /** O kolik je limit překročen (0 = v limitu). */
  over: number
  /** První den, kdy kumulativní náklady přesáhnou limit; null = nepřesáhnou. */
  exceedDay: number | null
}

export interface BudgetStatus {
  project: LimitStatus | null
  categories: ({ categoryId: string } & LimitStatus)[]
}

/** Stav limitů rozpočtu: kolik se plánuje utratit, o kolik je limit překročen a od kdy. */
export function budgetStatus(project: Project, timeline: CostTimeline): BudgetStatus {
  const budget = project.budget
  if (!budget) return { project: null, categories: [] }
  const range = timeline.range
  const n = range ? range.endDay - range.startDay + 1 : 0

  function status(limit: number, filter: (line: LineTimeline) => boolean, skipped: number): LimitStatus {
    const daily = new Float64Array(n)
    let spent = skipped
    for (const line of timeline.lines) {
      if (!filter(line) || !range) continue
      spent += line.total
      line.amounts.forEach((a, i) => (daily[line.startDay + i - range.startDay]! += a))
    }
    let sum = 0
    let exceedDay: number | null = null
    for (let i = 0; i < n && exceedDay === null; i++) {
      sum += daily[i]!
      if (sum > limit) exceedDay = range!.startDay + i
    }
    return { limit, spent, over: Math.max(0, spent - limit), exceedDay }
  }

  return {
    project: budget.limit !== undefined ? status(budget.limit, () => true, timeline.skippedAmount) : null,
    categories: budget.categoryLimits.map((c) => ({
      categoryId: c.categoryId,
      ...status(c.limit, (line) => line.categoryId === c.categoryId, timeline.skippedByCategory.get(c.categoryId) ?? 0),
    })),
  }
}

/** Plánované náklady každé kategorie (haléře), včetně řádků bez termínu. */
export function totalsByCategory(timeline: CostTimeline): Map<string, number> {
  const totals = new Map(timeline.skippedByCategory)
  for (const line of timeline.lines) totals.set(line.categoryId, (totals.get(line.categoryId) ?? 0) + line.total)
  return totals
}
