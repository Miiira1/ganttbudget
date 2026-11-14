/**
 * Plánovací jádro: z délek, vazeb a kalendáře spočítá termíny činností (ZADANI.md, kap. 7).
 *
 * Je to ČISTÁ FUNKCE: projekt dovnitř, spočítané termíny ven. Nic nemění, nic neukládá,
 * nezávisí na obrazovce. Díky tomu se dá spolehlivě otestovat (schedule.test.ts).
 *
 * Pravidla (stejná zvyklost jako v MS Projectu):
 *  - délka je v pracovních dnech, konec = poslední pracovní den činnosti,
 *  - vazba FS: následník začne další pracovní den po konci předchůdce (+ prodleva),
 *  - milník leží na dni konce předchůdce; bez předchůdců na začátku projektu,
 *  - fáze trvá od nejdřívějšího začátku do nejpozdějšího konce svých podřízených položek.
 *
 * Ve fázi 2 se počítají jen vazby FS. Typy SS, FF, SF přidá fáze 4c.
 */
import type { Project, Task } from '../model/schema'
import { createWorkCalendar, dayToIso, isoToDay, NoWorkingDaysError, type WorkCalendar } from './calendar'

export interface ScheduledTask {
  /** Začátek "YYYY-MM-DD", nebo null, když termín nejde spočítat. */
  start: string | null
  finish: string | null
  /** Délka v pracovních dnech; u fáze spočítaná z jejího začátku a konce, null = nejde spočítat. */
  durationDays: number | null
}

export interface ScheduleResult {
  tasks: Map<string, ScheduledTask>
  /** Konec projektu = nejpozdější konec ze všech položek. */
  projectFinish: string | null
  /** Položky, které nejde spočítat, protože vazby tvoří kruh (nebo na kruh čekají). */
  cycleTaskIds: Set<string>
  /** Chyba, kvůli které nejde spočítat nic. */
  error?: 'noWorkingDays'
}

/** Vnitřní výsledek pro jednu položku (čísla dnů). */
interface Computed {
  startDay: number
  finishDay: number
  /** Kdy nejdřív může začít následník vazby FS (bez prodlevy). */
  successorStartDay: number
}

const EMPTY: ScheduledTask = { start: null, finish: null, durationDays: null }

export function schedule(project: Project): ScheduleResult {
  const byId = new Map(project.tasks.map((t) => [t.id, t]))
  const emptyResult = (extra: Partial<ScheduleResult> = {}): ScheduleResult => ({
    tasks: new Map(project.tasks.map((t) => [t.id, EMPTY])),
    projectFinish: null,
    cycleTaskIds: new Set(),
    ...extra,
  })

  let calendar: WorkCalendar
  let projectStartDay: number
  try {
    calendar = createWorkCalendar(project.calendar)
    projectStartDay = calendar.nextWorkingDay(isoToDay(project.startDate))
  } catch (error) {
    if (error instanceof NoWorkingDaysError) return emptyResult({ error: 'noWorkingDays' })
    throw error
  }

  // --- 1. Graf závislostí: kdo musí být spočítán dřív než kdo ---
  // Hrana X → Y znamená „Y potřebuje výsledek X“.
  const children = new Map<string, Task[]>()
  for (const t of project.tasks) {
    if (t.parentId !== null && byId.has(t.parentId)) {
      const list = children.get(t.parentId) ?? []
      list.push(t)
      children.set(t.parentId, list)
    }
  }
  /** Platné vazby FS (předchůdce existuje; fáze jako následník se zatím nepodporuje). */
  const dependenciesOf = (t: Task) =>
    t.kind === 'phase' ? [] : t.dependencies.filter((d) => d.type === 'FS' && byId.has(d.predecessorId) && d.predecessorId !== t.id)

  const successors = new Map<string, string[]>()
  const waitingFor = new Map<string, number>()
  const addEdge = (from: string, to: string) => {
    const list = successors.get(from) ?? []
    list.push(to)
    successors.set(from, list)
    waitingFor.set(to, (waitingFor.get(to) ?? 0) + 1)
  }
  for (const t of project.tasks) {
    waitingFor.set(t.id, waitingFor.get(t.id) ?? 0)
    for (const d of dependenciesOf(t)) addEdge(d.predecessorId, t.id)
    for (const child of children.get(t.id) ?? []) addEdge(child.id, t.id)
  }

  // --- 2. Topologické řazení (Kahnův algoritmus) ---
  // Postupně bereme položky, které už na nic nečekají. Co zbyde, je v kruhu nebo na kruh čeká.
  const queue = project.tasks.filter((t) => waitingFor.get(t.id) === 0).map((t) => t.id)
  const order: string[] = []
  while (queue.length > 0) {
    const id = queue.shift() as string
    order.push(id)
    for (const next of successors.get(id) ?? []) {
      const remaining = (waitingFor.get(next) ?? 0) - 1
      waitingFor.set(next, remaining)
      if (remaining === 0) queue.push(next)
    }
  }
  const resolved = new Set(order)
  const cycleTaskIds = new Set(project.tasks.map((t) => t.id).filter((id) => !resolved.has(id)))

  // --- 3. Výpočet termínů v tomto pořadí (forward pass) ---
  const computed = new Map<string, Computed>()
  try {
    for (const id of order) {
      const t = byId.get(id) as Task
      const result = t.kind === 'phase' ? computePhase(t) : computeTask(t)
      if (result) computed.set(id, result)
    }
  } catch (error) {
    if (error instanceof NoWorkingDaysError) return emptyResult({ error: 'noWorkingDays' })
    throw error
  }

  function computeTask(t: Task): Computed {
    let earliestStart = projectStartDay
    let drivenByDependency = false
    for (const d of dependenciesOf(t)) {
      const pred = computed.get(d.predecessorId)
      if (!pred) continue // předchůdce bez termínu (prázdná fáze) neomezuje
      const candidate = calendar.addWorkingDays(pred.successorStartDay, d.lagDays)
      if (candidate >= earliestStart) {
        earliestStart = candidate
        drivenByDependency = true
      }
    }
    if (t.kind === 'milestone' || t.durationDays === 0) {
      // Milník „leží“ na konci dne předchůdce, ale nikdy před začátkem projektu.
      const day = drivenByDependency
        ? Math.max(calendar.previousWorkingDay(earliestStart - 1), projectStartDay)
        : earliestStart
      return { startDay: day, finishDay: day, successorStartDay: earliestStart }
    }
    return {
      startDay: earliestStart,
      finishDay: calendar.addWorkingDays(earliestStart, t.durationDays - 1),
      successorStartDay: calendar.addWorkingDays(earliestStart, t.durationDays),
    }
  }

  function computePhase(t: Task): Computed | null {
    const parts = (children.get(t.id) ?? []).map((c) => computed.get(c.id)).filter((c) => c !== undefined)
    if (parts.length === 0) return null
    const finishDay = Math.max(...parts.map((p) => p.finishDay))
    return {
      startDay: Math.min(...parts.map((p) => p.startDay)),
      finishDay,
      successorStartDay: Math.max(...parts.map((p) => p.successorStartDay)),
    }
  }

  // --- 4. Výsledek v ISO dnech ---
  const tasks = new Map<string, ScheduledTask>()
  let lastFinish: number | null = null
  for (const t of project.tasks) {
    const c = computed.get(t.id)
    if (!c) {
      tasks.set(t.id, EMPTY)
      continue
    }
    const durationDays = t.kind === 'phase' ? calendar.countWorkingDays(c.startDay, c.finishDay) : t.durationDays
    tasks.set(t.id, { start: dayToIso(c.startDay), finish: dayToIso(c.finishDay), durationDays })
    if (lastFinish === null || c.finishDay > lastFinish) lastFinish = c.finishDay
  }

  return { tasks, projectFinish: lastFinish === null ? null : dayToIso(lastFinish), cycleTaskIds }
}
