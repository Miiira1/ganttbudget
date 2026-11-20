/**
 * Náklady činností z jejich řádků (fáze 6b, R-01, R-02, R-05) – čisté funkce, testy v costs.test.ts.
 *
 * Dny = délka položky v pracovních dnech podle plánovacího jádra (u fáze spočítaná délka).
 *  - člověk:   hodiny = dny × h/den × %; náklad = hodiny × sazba (pracovníka, jinak profese)
 *  - stroj:    hodiny = dny × h/den × %; náklad = hodiny × sazba (za hodinu), nebo dny × % × sazba (za den)
 *  - materiál: množství × cena (z databáze, nebo přepsaná na řádku)
 *  - jednorázový: částka
 *  - průběžný: za pracovní den × dny; za týden × kalendářní dny ÷ 7; za měsíc – každý kalendářní
 *    den = částka ÷ počet dní jeho měsíce
 * Peníze v haléřích, zaokrouhluje se u každého řádku. Délka činnosti se zdroji nemění.
 */
import { dayToIso, isoToDay } from '../engine/calendar'
import type { ScheduleResult } from '../engine/schedule'
import { effectiveWorkerRate, professionRate, workingDaysInYear } from './rates'
import type { Project, Task, TaskLine } from './schema'

export interface LineCost {
  /** Náklad v haléřích. */
  amount: number
  /** Hodiny práce (člověk, stroj); jinak null. */
  hours: number | null
  /** Proč může být náklad neúplný: chybí sazba. */
  warning: 'noRate' | null
}

/** Rozpad nákladu podle druhu (haléře). */
export interface CostSummary {
  total: number
  labor: number
  machines: number
  material: number
  other: number
}

export interface CostsResult {
  lines: Map<string, LineCost>
  /** own = jen řádky položky; total = s podřízenými (u fáze). */
  byTask: Map<string, { own: CostSummary; total: CostSummary }>
  project: CostSummary
}

/** Číselníky pro výpočet hodin řádku (připravené jednou pro celý výpočet). */
export interface ResourceLookup {
  workers: Map<string, Project['workers'][number]>
  professions: Map<string, Project['professions'][number]>
  machines: Map<string, Project['machines'][number]>
}

export function createResourceLookup(project: Project): ResourceLookup {
  return {
    workers: new Map(project.workers.map((w) => [w.id, w])),
    professions: new Map(project.professions.map((p) => [p.id, p])),
    machines: new Map(project.machines.map((m) => [m.id, m])),
  }
}

/**
 * Hodiny práce řádku za jeden pracovní den = h/den zdroje × podíl %.
 * Člověk: kapacita konkrétního pracovníka, jinak profese. Společné pro náklady i vytížení,
 * aby se nikdy nerozešly. Jiné druhy řádků hodiny nemají (null).
 */
export function lineHoursPerDay(line: TaskLine, lookup: ResourceLookup): number | null {
  if (line.kind === 'labor') {
    const worker = line.workerId ? lookup.workers.get(line.workerId) : undefined
    const capacity = worker?.capacityPerDay ?? lookup.professions.get(line.professionId)?.capacityPerDay ?? 0
    return (capacity * line.sharePct) / 100
  }
  if (line.kind === 'machine') return ((lookup.machines.get(line.machineId)?.capacityPerDay ?? 0) * line.sharePct) / 100
  return null
}

const emptySummary = (): CostSummary => ({ total: 0, labor: 0, machines: 0, material: 0, other: 0 })

function add(target: CostSummary, source: CostSummary): void {
  target.total += source.total
  target.labor += source.labor
  target.machines += source.machines
  target.material += source.material
  target.other += source.other
}

const BUCKET: Record<TaskLine['kind'], keyof Omit<CostSummary, 'total'>> = {
  labor: 'labor',
  machine: 'machines',
  material: 'material',
  oneTime: 'other',
  recurring: 'other',
}

/** Měsíční částka rozpočítaná na kalendářní dny `startDay`–`finishDay` (každý den = částka ÷ dní jeho měsíce). */
export function monthlyAmount(amountPerMonth: number, startDay: number, finishDay: number): number {
  let sum = 0
  for (let day = startDay; day <= finishDay; day++) {
    const [y, m] = dayToIso(day).split('-').map(Number) as [number, number]
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    sum += amountPerMonth / daysInMonth
  }
  return Math.round(sum)
}

/** Údaje položky pro výpočet: pracovní dny a kalendářní rozsah (null = termín nejde spočítat). */
interface Span {
  days: number
  startDay: number | null
  finishDay: number | null
}

export function computeCosts(project: Project, scheduleResult: ScheduleResult): CostsResult {
  const fundDays = workingDaysInYear(project.calendar, Number(project.startDate.slice(0, 4)))
  const lookup = createResourceLookup(project)
  const { professions, workers, machines } = lookup
  const materials = new Map(project.materials.map((m) => [m.id, m]))
  // Sazby se počítají jednou (kalkulace je stejná pro všechny řádky).
  const professionRates = new Map(project.professions.map((p) => [p.id, professionRate(p, fundDays)]))
  const workerRates = new Map(project.workers.map((w) => [w.id, effectiveWorkerRate(w, professions.get(w.professionId) ?? {}, fundDays).rate]))

  function lineCost(line: TaskLine, span: Span): LineCost {
    switch (line.kind) {
      case 'labor': {
        const worker = line.workerId ? workers.get(line.workerId) : undefined
        const rate = worker ? (workerRates.get(worker.id) ?? null) : (professionRates.get(line.professionId) ?? null)
        const hours = span.days * (lineHoursPerDay(line, lookup) ?? 0)
        return rate === null ? { amount: 0, hours, warning: 'noRate' } : { amount: Math.round(hours * rate), hours, warning: null }
      }
      case 'machine': {
        const machine = machines.get(line.machineId)
        if (!machine) return { amount: 0, hours: 0, warning: 'noRate' }
        const hours = span.days * (lineHoursPerDay(line, lookup) ?? 0)
        const amount = machine.rateUnit === 'hour' ? hours * machine.rate : (span.days * line.sharePct * machine.rate) / 100
        return { amount: Math.round(amount), hours, warning: null }
      }
      case 'material': {
        const price = line.unitPriceOverride ?? materials.get(line.materialId)?.unitPrice ?? 0
        // Množství má nejvýš 3 desetinná místa (schéma) → počítat v tisícinách jako celé číslo,
        // ať 1,005 × 100 hal nevyjde 100,4999… (audit V-N4). Poloviny jsou pak přesné.
        return { amount: Math.round((Math.round(line.quantity * 1000) * price) / 1000), hours: null, warning: null }
      }
      case 'oneTime':
        return { amount: line.amount, hours: null, warning: null }
      case 'recurring': {
        if (span.startDay === null || span.finishDay === null) return { amount: 0, hours: null, warning: null }
        const calendarDays = span.finishDay - span.startDay + 1
        const amount =
          line.period === 'day'
            ? span.days * line.amount
            : line.period === 'week'
              ? Math.round((calendarDays * line.amount) / 7)
              : monthlyAmount(line.amount, span.startDay, span.finishDay)
        return { amount, hours: null, warning: null }
      }
    }
  }

  const lines = new Map<string, LineCost>()
  const own = new Map<string, CostSummary>()
  for (const task of project.tasks) {
    const scheduled = scheduleResult.tasks.get(task.id)
    const span: Span = {
      days: scheduled?.durationDays ?? 0,
      startDay: scheduled?.start ? isoToDay(scheduled.start) : null,
      finishDay: scheduled?.finish ? isoToDay(scheduled.finish) : null,
    }
    const summary = emptySummary()
    for (const line of task.lines) {
      const cost = lineCost(line, span)
      lines.set(line.id, cost)
      summary.total += cost.amount
      summary[BUCKET[line.kind]] += cost.amount
    }
    own.set(task.id, summary)
  }

  // Součty fází: vlastní řádky + podřízené (do libovolné hloubky).
  const children = new Map<string | null, Task[]>()
  const ids = new Set(project.tasks.map((t) => t.id))
  for (const task of project.tasks) {
    const key = task.parentId !== null && ids.has(task.parentId) ? task.parentId : null
    children.set(key, [...(children.get(key) ?? []), task])
  }
  const byTask = new Map<string, { own: CostSummary; total: CostSummary }>()
  const visiting = new Set<string>()
  function total(task: Task): CostSummary {
    const known = byTask.get(task.id)
    if (known) return known.total
    const sum = { ...(own.get(task.id) ?? emptySummary()) }
    visiting.add(task.id) // ochrana proti kruhu v poškozených datech
    for (const child of children.get(task.id) ?? []) if (!visiting.has(child.id)) add(sum, total(child))
    visiting.delete(task.id)
    byTask.set(task.id, { own: own.get(task.id) ?? emptySummary(), total: sum })
    return sum
  }
  const projectSummary = emptySummary()
  for (const task of children.get(null) ?? []) add(projectSummary, total(task))
  for (const task of project.tasks) total(task) // i položky mimo strom (poškozená data)
  return { lines, byTask, project: projectSummary }
}
