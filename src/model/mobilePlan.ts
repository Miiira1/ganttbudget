/**
 * Mobilní verze – data pro seznam karet plánu (jen prohlížení). ČISTÉ FUNKCE s testy.
 * Karta = jedna viditelná položka plánu s úrovní ve stromu, WBS, číslem řádku a termíny.
 */
import type { ScheduleResult } from '../engine/schedule'
import { depthMap, visibleRows, wbsNumbers } from './hierarchy'
import { rowNumbers } from './predecessors'
import type { Project, Task, TaskLine } from './schema'

export interface MobilePlanRow {
  task: Task
  depth: number
  wbs: string
  /** Číslo řádku jako v tabulce (pro text předchůdců). */
  number: number
  hasChildren: boolean
  start: string | null
  finish: string | null
  /** Pracovní dny (u fáze spočítané z podřízených). */
  durationDays: number
}

/** Viditelné řádky plánu (sbalené fáze skryjí podřízené) jako karty pro telefon. */
export function mobilePlanRows(project: Project, scheduled: ScheduleResult, collapsed: ReadonlySet<string>): MobilePlanRow[] {
  const depths = depthMap(project)
  const wbs = wbsNumbers(project)
  const numbers = rowNumbers(project)
  const parents = new Set(project.tasks.map((t) => t.parentId).filter((id): id is string => id !== null))
  return visibleRows(project, collapsed).map((task) => {
    const s = scheduled.tasks.get(task.id)
    return {
      task,
      depth: depths.get(task.id) ?? 0,
      wbs: wbs.get(task.id) ?? '',
      number: numbers.get(task.id) ?? 0,
      hasChildren: parents.has(task.id),
      start: s?.start ?? null,
      finish: s?.finish ?? null,
      durationDays: task.kind === 'phase' ? (s?.durationDays ?? 0) : task.durationDays,
    }
  })
}

/** Čitelný název řádku nákladu: pracovník (jinak profese), stroj, materiál, nebo vlastní název. */
export function lineDisplayName(project: Project, line: TaskLine): string {
  switch (line.kind) {
    case 'labor': {
      const worker = line.workerId ? project.workers.find((w) => w.id === line.workerId) : undefined
      return worker?.name ?? project.professions.find((p) => p.id === line.professionId)?.name ?? ''
    }
    case 'machine':
      return project.machines.find((m) => m.id === line.machineId)?.name ?? ''
    case 'material':
      return project.materials.find((m) => m.id === line.materialId)?.name ?? ''
    default:
      return line.name
  }
}
