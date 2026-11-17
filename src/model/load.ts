/**
 * Vytížení zdrojů (fáze 6c, Z-03, K-05) – čistá funkce, testy v load.test.ts.
 *
 * Poptávka: hodiny řádku za den (h/den × %, stejný výpočet jako náklady) v každém pracovním dni
 * položky (u fáze v celé její spočítané délce). Nepracovní dny (víkend, svátek, odstávka) mají 0.
 * Kapacita za den:
 *  - pracovník: jeho h/den v pracovní dny, ve dnech nepřítomnosti 0,
 *  - profese: součet kapacit jejích pracovníků; poptávka = všechny řádky profese
 *    (i ty s konkrétním pracovníkem). Profese bez pracovníků přetížení nehlásí,
 *  - stroj: jeho h/den v pracovní dny.
 * Přetížený den = poptávka > kapacita. Termíny činností se vytížením nemění.
 */
import { createWorkCalendar, isoToDay } from '../engine/calendar'
import type { ScheduleResult } from '../engine/schedule'
import { createResourceLookup, lineHoursPerDay } from './costs'
import { splitPeriods, type DayRange } from './periods'
import type { Project, TaskLine } from './schema'

export type LoadResourceKind = 'worker' | 'profession' | 'machine'

/** Jeden řádek činnosti, který zdroj vytěžuje. Dny jsou čísla dnů (viz engine/calendar). */
export interface LoadContribution {
  taskId: string
  lineId: string
  hoursPerDay: number
  startDay: number
  finishDay: number
}

export interface ResourceLoad {
  /** `worker:id`, `profession:id`, `machine:id` */
  key: string
  kind: LoadResourceKind
  id: string
  name: string
  /** Hodiny po dnech rozsahu: index 0 = range.startDay. */
  demand: Float64Array
  capacity: Float64Array
  /** false = profese bez pracovníků (kapacita neznámá, přetížení se nehlásí). */
  hasCapacity: boolean
  /** Čísla přetížených dnů, vzestupně. */
  overloadedDays: number[]
  contributions: LoadContribution[]
}

export type LoadRange = DayRange

export interface LoadResult {
  /** Od nejdřívějšího začátku po nejpozdější konec položek plánu; null = nic spočítaného. */
  range: LoadRange | null
  /** Pořadí: pracovníci, profese, stroje (jako v databázi). */
  resources: ResourceLoad[]
  /** Počet zdrojů s aspoň jedním přetíženým dnem. */
  overloadedCount: number
}

/** Tolerance pro součty desetinných hodin (např. 3 × 0,1). */
const EPS = 1e-9

export function computeLoad(project: Project, scheduleResult: ScheduleResult): LoadResult {
  // Rozsah a dny položek, které jde spočítat.
  const spans = new Map<string, { startDay: number; finishDay: number }>()
  let startDay = Infinity
  let endDay = -Infinity
  for (const task of project.tasks) {
    const s = scheduleResult.tasks.get(task.id)
    if (!s?.start || !s.finish) continue
    const span = { startDay: isoToDay(s.start), finishDay: isoToDay(s.finish) }
    spans.set(task.id, span)
    startDay = Math.min(startDay, span.startDay)
    endDay = Math.max(endDay, span.finishDay)
  }
  const range = startDay <= endDay ? { startDay, endDay } : null
  const n = range ? endDay - startDay + 1 : 0

  const work = createWorkCalendar(project.calendar)
  const working = new Uint8Array(n)
  for (let i = 0; i < n; i++) working[i] = work.isWorkingDay(startDay + i) ? 1 : 0

  const make = (kind: LoadResourceKind, id: string, name: string): ResourceLoad => ({
    key: `${kind}:${id}`,
    kind,
    id,
    name,
    demand: new Float64Array(n),
    capacity: new Float64Array(n),
    hasCapacity: true,
    overloadedDays: [],
    contributions: [],
  })

  // Kapacity.
  const workers = project.workers.map((w) => {
    const r = make('worker', w.id, w.name)
    for (let i = 0; i < n; i++) if (working[i]) r.capacity[i] = w.capacityPerDay
    for (const a of w.absences ?? []) {
      const from = Math.max(isoToDay(a.start), startDay)
      const to = Math.min(isoToDay(a.end), endDay)
      for (let day = from; day <= to; day++) r.capacity[day - startDay] = 0
    }
    return r
  })
  const professions = project.professions.map((p) => {
    const r = make('profession', p.id, p.name)
    const members = workers.filter((_, i) => project.workers[i]!.professionId === p.id)
    r.hasCapacity = members.length > 0
    for (const m of members) for (let i = 0; i < n; i++) r.capacity[i]! += m.capacity[i]!
    return r
  })
  const machines = project.machines.map((m) => {
    const r = make('machine', m.id, m.name)
    for (let i = 0; i < n; i++) if (working[i]) r.capacity[i] = m.capacityPerDay
    return r
  })
  const resources = [...workers, ...professions, ...machines]
  const byKey = new Map(resources.map((r) => [r.key, r]))

  // Poptávka.
  const lookup = createResourceLookup(project)
  for (const task of project.tasks) {
    const span = spans.get(task.id)
    if (!span) continue
    for (const line of task.lines) {
      const hoursPerDay = lineHoursPerDay(line, lookup)
      if (hoursPerDay === null || hoursPerDay <= 0) continue
      const keys =
        line.kind === 'labor'
          ? [...(line.workerId ? [`worker:${line.workerId}`] : []), `profession:${line.professionId}`]
          : line.kind === 'machine'
            ? [`machine:${line.machineId}`]
            : []
      for (const key of keys) {
        const r = byKey.get(key)
        if (!r) continue
        r.contributions.push({ taskId: task.id, lineId: line.id, hoursPerDay, startDay: span.startDay, finishDay: span.finishDay })
        for (let day = span.startDay; day <= span.finishDay; day++) {
          const i = day - startDay
          if (working[i]) r.demand[i]! += hoursPerDay
        }
      }
    }
  }

  // Přetížené dny.
  let overloadedCount = 0
  for (const r of resources) {
    if (!r.hasCapacity) continue
    for (let i = 0; i < n; i++) if (r.demand[i]! > r.capacity[i]! + EPS) r.overloadedDays.push(startDay + i)
    if (r.overloadedDays.length > 0) overloadedCount++
  }
  return { range, resources, overloadedCount }
}

export type LoadPeriodUnit = 'day' | 'week' | 'month'

/** Rozdělí rozsah na dny, týdny (po–ne) nebo kalendářní měsíce (společné s pohledem Náklady). */
export function loadPeriods(range: LoadRange, unit: LoadPeriodUnit): LoadRange[] {
  return splitPeriods(range, unit)
}

export interface PeriodLoad {
  /** Součet hodin poptávky a kapacity v období. */
  demand: number
  capacity: number
  overloadedDays: number
  /** Nejvyšší denní vytížení v % (dny s kapacitou); null = v období žádná poptávka. */
  peakPct: number | null
}

const round2 = (x: number) => Math.round(x * 100) / 100

/** Shrnutí jednoho období (oříznutého na rozsah výpočtu). */
export function summarizePeriod(load: ResourceLoad, range: LoadRange, period: LoadRange): PeriodLoad {
  const from = Math.max(period.startDay, range.startDay) - range.startDay
  const to = Math.min(period.endDay, range.endDay) - range.startDay
  let demand = 0
  let capacity = 0
  let overloadedDays = 0
  let peak: number | null = null
  for (let i = from; i <= to; i++) {
    const d = load.demand[i]!
    const c = load.capacity[i]!
    demand += d
    capacity += c
    if (load.hasCapacity && d > c + EPS) overloadedDays++
    if (d > EPS && c > 0) peak = Math.max(peak ?? 0, (d / c) * 100)
  }
  return { demand: round2(demand), capacity: round2(capacity), overloadedDays, peakPct: peak === null ? null : Math.round(peak) }
}

/** Varování k řádku činnosti v panelu Detail činnosti (počty pracovních dnů v termínu činnosti). */
export interface LineLoadWarnings {
  /** Kolik pracovních dnů činnosti je přiřazený pracovník nepřítomný. */
  absenceDays: number
  /** Kolik dnů činnosti je zdroj řádku přetížený (pracovník; bez pracovníka profese; stroj). */
  overloadedDays: number
}

const NO_WARNINGS: LineLoadWarnings = { absenceDays: 0, overloadedDays: 0 }

export function lineLoadWarnings(project: Project, scheduleResult: ScheduleResult, load: LoadResult, taskId: string, line: TaskLine): LineLoadWarnings {
  const s = scheduleResult.tasks.get(taskId)
  if (!s?.start || !s.finish) return NO_WARNINGS
  const startDay = isoToDay(s.start)
  const finishDay = isoToDay(s.finish)
  const key =
    line.kind === 'labor' ? (line.workerId ? `worker:${line.workerId}` : `profession:${line.professionId}`) : line.kind === 'machine' ? `machine:${line.machineId}` : null
  if (key === null) return NO_WARNINGS
  const resource = load.resources.find((r) => r.key === key)
  const overloadedDays = resource ? resource.overloadedDays.filter((d) => d >= startDay && d <= finishDay).length : 0

  let absenceDays = 0
  const worker = line.kind === 'labor' && line.workerId ? project.workers.find((w) => w.id === line.workerId) : undefined
  if (worker?.absences?.length) {
    const work = createWorkCalendar(project.calendar)
    for (let day = startDay; day <= finishDay; day++) {
      if (work.isWorkingDay(day) && worker.absences.some((a) => day >= isoToDay(a.start) && day <= isoToDay(a.end))) absenceDays++
    }
  }
  return { absenceDays, overloadedDays }
}

/* ---------- Dashboard Vytížení (fáze 8, A-04) ---------- */

/** Hodnota filtru střediska „bez střediska“ (profese, stroje a pracovníci bez střediska). */
export const NO_DEPARTMENT = '∅'

export interface LoadFilter {
  /** Druhy zdrojů; prázdné / chybí = všechny. */
  kinds?: ReadonlySet<string>
  /** Střediska (ID nebo NO_DEPARTMENT); prázdné / chybí = všechna. Středisko mají jen pracovníci. */
  departments?: ReadonlySet<string>
  /** Jen zdroje s aspoň jedním přetíženým dnem. */
  onlyOverloaded?: boolean
}

/** Zdroje podle filtru dashboardu (pořadí zůstává). */
export function filterLoad(project: Project, resources: readonly ResourceLoad[], filter: LoadFilter): ResourceLoad[] {
  const kinds = filter.kinds && filter.kinds.size > 0 ? filter.kinds : null
  const departments = filter.departments && filter.departments.size > 0 ? filter.departments : null
  const departmentOf = new Map(project.workers.map((w) => [w.id, w.departmentId ?? NO_DEPARTMENT]))
  return resources.filter(
    (r) =>
      (!kinds || kinds.has(r.kind)) &&
      (!departments || departments.has(r.kind === 'worker' ? (departmentOf.get(r.id) ?? NO_DEPARTMENT) : NO_DEPARTMENT)) &&
      (!filter.onlyOverloaded || r.overloadedDays.length > 0),
  )
}

export interface LoadKpis {
  resources: number
  /** Zdroje s aspoň jedním přetíženým dnem. */
  overloadedResources: number
  /** Součet přetížených dnů všech zdrojů. */
  overloadedDays: number
  /** Nejvyšší denní vytížení v % (dny s kapacitou); null = žádná poptávka. */
  peakPct: number | null
  /** Průměrné vytížení = poptávka / kapacita za celý rozsah (zdroje s kapacitou); null = bez kapacity. */
  averagePct: number | null
}

/** Ukazatele dashboardu Vytížení za celý rozsah plánu. */
export function loadKpis(resources: readonly ResourceLoad[]): LoadKpis {
  let overloadedResources = 0
  let overloadedDays = 0
  let peak: number | null = null
  let demand = 0
  let capacity = 0
  for (const r of resources) {
    if (r.overloadedDays.length > 0) overloadedResources++
    overloadedDays += r.overloadedDays.length
    if (!r.hasCapacity) continue
    for (let i = 0; i < r.demand.length; i++) {
      const d = r.demand[i]!
      const c = r.capacity[i]!
      demand += d
      capacity += c
      if (d > EPS && c > 0) peak = Math.max(peak ?? 0, (d / c) * 100)
    }
  }
  return {
    resources: resources.length,
    overloadedResources,
    overloadedDays,
    peakPct: peak === null ? null : Math.round(peak),
    averagePct: capacity > 0 ? Math.round((demand / capacity) * 100) : null,
  }
}

/**
 * Souhrn skupiny zdrojů jako jeden „zdroj“ (pro histogram): součet poptávky a kapacity po dnech,
 * přetížený den = poptávka skupiny > kapacita skupiny. Zdroje bez kapacity (profese bez lidí)
 * se do poptávky nezapočtou, pokud ve skupině je aspoň jeden zdroj s kapacitou – jinak by
 * vzniklo falešné přetížení. null = prázdná skupina.
 */
export function groupLoad(resources: readonly ResourceLoad[], range: LoadRange, name: string): ResourceLoad | null {
  if (resources.length === 0) return null
  const withCapacity = resources.filter((r) => r.hasCapacity)
  const members = withCapacity.length > 0 ? withCapacity : resources
  const n = range.endDay - range.startDay + 1
  const group: ResourceLoad = {
    key: 'group',
    kind: resources[0]!.kind,
    id: 'group',
    name,
    demand: new Float64Array(n),
    capacity: new Float64Array(n),
    hasCapacity: withCapacity.length > 0,
    overloadedDays: [],
    contributions: members.flatMap((r) => r.contributions),
  }
  for (const r of members) {
    for (let i = 0; i < n; i++) {
      group.demand[i]! += r.demand[i]!
      group.capacity[i]! += r.capacity[i]!
    }
  }
  if (group.hasCapacity) for (let i = 0; i < n; i++) if (group.demand[i]! > group.capacity[i]! + EPS) group.overloadedDays.push(range.startDay + i)
  return group
}
