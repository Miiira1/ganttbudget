/**
 * Kontrola kvality plánu (U-04, fáze 10): najde místa, kde plán nejspíš něco chybí nebo nesedí.
 * Jsou to jen VAROVÁNÍ – nic neblokují a nic nemění.
 *
 * ČISTÁ FUNKCE: projekt a už spočítané výsledky (termíny, vytížení, limity) dovnitř, seznam varování ven.
 * Texty a rady „Jak to opravit“ dodá rozhraní z překladů podle druhu varování.
 *
 * Pravidla:
 *  - noPredecessor: činnost nebo milník bez předchůdce. Nehlásí se první taková položka v pořadí plánu
 *    (začátek projektu) a položka s pevným začátkem 📌 (omezení „začít nejdříve“). Fáze vazby nemají.
 *  - noSuccessor: činnost nebo milník bez následníka, který neskončí s koncem projektu
 *    (položky končící s koncem projektu jsou jeho přirozený konec).
 *  - emptyPhase: fáze bez podřízených položek.
 *  - zeroDuration: činnost (ne milník) s délkou 0 pracovních dnů.
 *  - leadBeforePredecessor (vazba do minulosti a): záporná prodleva tak velká, že by následník podle
 *    samotné vazby začal dřív než sám předchůdce. Na ose pracovních dnů, předchůdce [Sp, Sp + dp),
 *    následník délky d: FS: dp + p < 0, SS: p < 0, FF: dp + p − d < 0, SF: p − d < 0 (jen pro p < 0).
 *  - notStarted (vazba do minulosti b): činnost nebo milník měly podle plánu začít před dneškem
 *    a mají 0 % hotovo. Fáze se nehlásí (% hotovo se jim počítá).
 *  - overload: zdroj s aspoň jedním přetíženým dnem (profese bez pracovníků se nehlásí).
 *  - budgetOver: překročený limit projektu (categoryId null) nebo kategorie.
 *
 * Pořadí: podle druhu (viz KIND_ORDER), uvnitř druhu v pořadí řádků plánu.
 */
import { dayToIso, isoToDay } from '../engine/calendar'
import type { ScheduleResult } from '../engine/schedule'
import type { BudgetStatus } from './costTimeline'
import { treeOrder } from './hierarchy'
import type { LoadResourceKind, LoadResult } from './load'
import type { DependencyType, Project, Task } from './schema'

export type PlanIssue =
  | { kind: 'budgetOver'; categoryId: string | null; over: number; exceedDate: string | null }
  | { kind: 'overload'; resourceKind: LoadResourceKind; resourceId: string; name: string; days: number; firstDate: string }
  | { kind: 'leadBeforePredecessor'; taskId: string; predecessorId: string; lagDays: number; type: DependencyType }
  | { kind: 'notStarted'; taskId: string; start: string }
  | { kind: 'zeroDuration'; taskId: string }
  | { kind: 'emptyPhase'; taskId: string }
  | { kind: 'noPredecessor'; taskId: string }
  | { kind: 'noSuccessor'; taskId: string }

export type PlanIssueKind = PlanIssue['kind']

/** Pořadí druhů varování v seznamu (od nejzávažnějších). */
export const KIND_ORDER: readonly PlanIssueKind[] = [
  'budgetOver',
  'overload',
  'leadBeforePredecessor',
  'notStarted',
  'zeroDuration',
  'emptyPhase',
  'noPredecessor',
  'noSuccessor',
]

export interface PlanCheckInput {
  project: Project
  scheduled: ScheduleResult
  load: LoadResult
  budget: BudgetStatus
  /** Dnešek "YYYY-MM-DD" (pro kontrolu „mělo začít“). */
  today: string
}

/** Leží následník podle samotné vazby před začátkem předchůdce? (jen záporná prodleva) */
function leadsBeforePredecessor(type: DependencyType, lag: number, predecessorDays: number, successorDays: number): boolean {
  if (lag >= 0) return false
  switch (type) {
    case 'FS':
      return predecessorDays + lag < 0
    case 'SS':
      return lag < 0
    case 'FF':
      return predecessorDays + lag - successorDays < 0
    case 'SF':
      return lag - successorDays < 0
  }
}

export function checkPlan({ project, scheduled, load, budget, today }: PlanCheckInput): PlanIssue[] {
  const issues: PlanIssue[] = []

  // Rozpočet: limit projektu, pak limity kategorií v pořadí, jak jsou zadané.
  const exceedDate = (day: number | null) => (day === null ? null : dayToIso(day))
  if (budget.project && budget.project.over > 0) {
    issues.push({ kind: 'budgetOver', categoryId: null, over: budget.project.over, exceedDate: exceedDate(budget.project.exceedDay) })
  }
  for (const c of budget.categories) {
    if (c.over > 0) issues.push({ kind: 'budgetOver', categoryId: c.categoryId, over: c.over, exceedDate: exceedDate(c.exceedDay) })
  }

  // Přetížené zdroje (v pořadí pohledu Vytížení).
  for (const r of load.resources) {
    if (!r.hasCapacity || r.overloadedDays.length === 0) continue
    issues.push({ kind: 'overload', resourceKind: r.kind, resourceId: r.id, name: r.name, days: r.overloadedDays.length, firstDate: dayToIso(r.overloadedDays[0]!) })
  }

  // Položky plánu v pořadí řádků.
  const rows = treeOrder(project)
  const byId = new Map(project.tasks.map((t) => [t.id, t]))
  const hasChildren = new Set(project.tasks.map((t) => t.parentId).filter((id): id is string => id !== null))
  const hasSuccessor = new Set(project.tasks.flatMap((t) => t.dependencies.map((d) => d.predecessorId)))
  const todayDay = isoToDay(today)
  const isItem = (t: Task) => t.kind !== 'phase'

  const perTask: PlanIssue[] = []
  let firstWithoutPredecessor = true
  for (const task of rows) {
    const s = scheduled.tasks.get(task.id)

    if (task.kind === 'phase' && !hasChildren.has(task.id)) perTask.push({ kind: 'emptyPhase', taskId: task.id })
    if (task.kind === 'task' && task.durationDays === 0) perTask.push({ kind: 'zeroDuration', taskId: task.id })
    if (!isItem(task)) continue

    for (const d of task.dependencies) {
      const predecessor = byId.get(d.predecessorId)
      if (predecessor && leadsBeforePredecessor(d.type, d.lagDays, predecessor.durationDays, task.durationDays)) {
        perTask.push({ kind: 'leadBeforePredecessor', taskId: task.id, predecessorId: d.predecessorId, lagDays: d.lagDays, type: d.type })
      }
    }

    if (s?.start && isoToDay(s.start) < todayDay && task.percentComplete === 0) perTask.push({ kind: 'notStarted', taskId: task.id, start: s.start })

    if (task.dependencies.length === 0) {
      // První položka bez předchůdce je začátek projektu; pevný začátek 📌 je záměr.
      if (!firstWithoutPredecessor && !task.constraintStart) perTask.push({ kind: 'noPredecessor', taskId: task.id })
      firstWithoutPredecessor = false
    }

    // Bez termínu (kruh ve vazbách) se konec projektu porovnat nedá – to už hlásí plánovač.
    if (!hasSuccessor.has(task.id) && s?.finish && s.finish !== scheduled.projectFinish) perTask.push({ kind: 'noSuccessor', taskId: task.id })
  }

  // Seřadit podle druhu; stabilní řazení zachová pořadí řádků uvnitř druhu.
  const rank = (i: PlanIssue) => KIND_ORDER.indexOf(i.kind)
  return [...issues, ...perTask.sort((a, b) => rank(a) - rank(b))]
}
