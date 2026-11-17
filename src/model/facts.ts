/**
 * Faktová vrstva pro analýzu (fáze 8, A-01) – čistá funkce, testy v pivot.test.ts.
 *
 * Jeden „fakt“ = jeden řádek činnosti s rozpadem po dnech:
 *  - náklad (haléře) přesně podle náběhu nákladů (costTimeline.ts),
 *  - hodiny (člověk, stroj) = h/den v každém pracovním dni položky – stejně jako vytížení (load.ts).
 * K tomu dimenze: fáze (položka nejvyšší úrovně), činnost, kategorie, štítky, druh nákladu,
 * zdroj, profese a středisko. Kontingenční tabulka (pivot.ts) z faktů jen sčítá.
 * Řádky položek bez termínu (kruh vazeb) se nezapočítají – stejně jako v pohledech Náklady a Vytížení.
 */
import { createWorkCalendar, isoToDay } from '../engine/calendar'
import type { ScheduleResult } from '../engine/schedule'
import { KIND_ORDER, rootsOf, type CostTimeline } from './costTimeline'
import { createResourceLookup, lineHoursPerDay } from './costs'
import type { DayRange } from './periods'
import { nameKey, type Project, type TaskLine } from './schema'

export type CostKind = (typeof KIND_ORDER)[number]

export interface LineFact {
  lineId: string
  taskId: string
  /** Položka nejvyšší úrovně (fáze nebo samostatná činnost). */
  rootId: string
  lineKind: TaskLine['kind']
  /** Druh nákladu: práce, stroje, materiál, ostatní. */
  kind: CostKind
  categoryId: string
  /** Štítky jako klíče (malá písmena) – popisky jsou ve Facts.tagLabels. */
  tags: string[]
  /** Zdroj: `worker:id`, `profession:id` (člověk bez pracovníka), `machine:id`, `material:id`, `name:<název nákladu>`. */
  resource: string
  professionId: string | null
  departmentId: string | null
  /** Náklad po dnech (haléře): cost[i] = den costStart + i. */
  costStart: number
  cost: number[]
  /** Hodiny po dnech: hours[i] = den hoursStart + i. */
  hoursStart: number
  hours: number[]
  totalCost: number
  totalHours: number
}

export interface Facts {
  lines: LineFact[]
  /** Od prvního do posledního dne s nákladem nebo hodinami; null = nic. */
  range: DayRange | null
  /** Klíč štítku → jeho text (první výskyt). */
  tagLabels: Map<string, string>
  /** Řádky položek bez termínu (nezapočtené). */
  skippedLines: number
}

const KIND_OF: Record<TaskLine['kind'], CostKind> = { labor: 'labor', machine: 'machines', material: 'material', oneTime: 'other', recurring: 'other' }

export function buildFacts(project: Project, scheduleResult: ScheduleResult, timeline: CostTimeline): Facts {
  const { rootOf } = rootsOf(project)
  const lookup = createResourceLookup(project)
  const calendar = createWorkCalendar(project.calendar)
  const working = new Map<number, boolean>()
  const isWorking = (day: number) => {
    let value = working.get(day)
    if (value === undefined) working.set(day, (value = calendar.isWorkingDay(day)))
    return value
  }
  const costByLine = new Map(timeline.lines.map((l) => [l.lineId, l]))
  const tagLabels = new Map<string, string>()
  const lines: LineFact[] = []
  let skippedLines = 0
  let rangeStart = Infinity
  let rangeEnd = -Infinity

  for (const task of project.tasks) {
    const s = scheduleResult.tasks.get(task.id)
    if (!s?.start || !s.finish) {
      skippedLines += task.lines.length
      continue
    }
    const startDay = isoToDay(s.start)
    const finishDay = isoToDay(s.finish)
    for (const line of task.lines) {
      const timed = costByLine.get(line.id)
      const cost = timed?.amounts ?? []
      const costStart = timed?.startDay ?? startDay
      const perDay = lineHoursPerDay(line, lookup) ?? 0
      const hours = perDay > 0 ? Array.from({ length: finishDay - startDay + 1 }, (_, i) => (isWorking(startDay + i) ? perDay : 0)) : []
      const totalHours = hours.reduce((a, b) => a + b, 0)
      for (const tag of line.tags ?? []) if (!tagLabels.has(nameKey(tag))) tagLabels.set(nameKey(tag), tag)

      const worker = line.kind === 'labor' && line.workerId ? lookup.workers.get(line.workerId) : undefined
      const resource =
        line.kind === 'labor'
          ? worker
            ? `worker:${worker.id}`
            : `profession:${line.professionId}`
          : line.kind === 'machine'
            ? `machine:${line.machineId}`
            : line.kind === 'material'
              ? `material:${line.materialId}`
              : `name:${line.name}`

      lines.push({
        lineId: line.id,
        taskId: task.id,
        rootId: rootOf.get(task.id) ?? task.id,
        lineKind: line.kind,
        kind: KIND_OF[line.kind],
        categoryId: line.categoryId,
        tags: [...new Set((line.tags ?? []).map(nameKey))],
        resource,
        professionId: line.kind === 'labor' ? line.professionId : null,
        departmentId: worker?.departmentId ?? null,
        costStart,
        cost,
        hoursStart: startDay,
        hours,
        totalCost: timed?.total ?? 0,
        totalHours,
      })
      if (cost.length > 0) {
        rangeStart = Math.min(rangeStart, costStart)
        rangeEnd = Math.max(rangeEnd, costStart + cost.length - 1)
      }
      if (totalHours > 0) {
        rangeStart = Math.min(rangeStart, startDay)
        rangeEnd = Math.max(rangeEnd, finishDay)
      }
    }
  }
  return { lines, range: rangeStart <= rangeEnd ? { startDay: rangeStart, endDay: rangeEnd } : null, tagLabels, skippedLines }
}
