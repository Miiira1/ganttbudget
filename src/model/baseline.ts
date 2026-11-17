/**
 * Snímek baseline (fáze 9, G-08, A-05) – čistá funkce, testy v earnedValue.test.ts.
 *
 * Baseline = uložený plán ke srovnání: u každé položky s termínem začátek, konec, délka
 * a plánovaný náklad po dnech (stejný rozpad jako náběh nákladů – PV se tak dá spočítat
 * k libovolnému dni). Fáze má jen náklady svých vlastních řádků; podřízené se sčítají.
 * Položka bez termínu (kruh vazeb) se do snímku nedostane.
 */
import { dayToIso } from '../engine/calendar'
import type { ScheduleResult } from '../engine/schedule'
import type { CostTimeline } from './costTimeline'
import { treeOrder } from './hierarchy'
import type { Baseline, BaselineTask, Project } from './schema'

export function createBaseline(project: Project, scheduleResult: ScheduleResult, timeline: CostTimeline, savedAt: string): Pick<Baseline, 'savedAt' | 'tasks'> {
  // Řádky náběhu podle položky.
  const linesByTask = new Map<string, CostTimeline['lines']>()
  for (const line of timeline.lines) {
    const list = linesByTask.get(line.taskId)
    if (list) list.push(line)
    else linesByTask.set(line.taskId, [line])
  }

  const tasks: BaselineTask[] = []
  for (const task of treeOrder(project)) {
    const s = scheduleResult.tasks.get(task.id)
    if (!s?.start || !s.finish) continue
    const entry: BaselineTask = {
      taskId: task.id,
      parentId: task.parentId,
      name: task.name,
      kind: task.kind,
      start: s.start,
      finish: s.finish,
      durationDays: s.durationDays ?? task.durationDays,
      costs: [],
    }
    const lines = linesByTask.get(task.id)
    if (lines && lines.length > 0) {
      const from = Math.min(...lines.map((l) => l.startDay))
      const to = Math.max(...lines.map((l) => l.startDay + l.amounts.length - 1))
      const costs = new Array<number>(to - from + 1).fill(0)
      for (const line of lines) line.amounts.forEach((a, i) => (costs[line.startDay - from + i]! += a))
      entry.costStart = dayToIso(from)
      entry.costs = costs
    }
    tasks.push(entry)
  }
  return { savedAt, tasks }
}

/** Plánovaný náklad (BAC) vlastních řádků každé položky v baseline (haléře). */
export function baselineBac(baseline: Baseline): Map<string, number> {
  return new Map(baseline.tasks.map((t) => [t.taskId, t.costs.reduce((sum, c) => sum + c, 0)]))
}

/** Baseline vybraná ke srovnání, nebo null. */
export function activeBaseline(project: Project): Baseline | null {
  return project.baselines.find((b) => b.id === project.activeBaselineId) ?? null
}
