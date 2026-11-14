/**
 * Plánovací jádro: z délek, vazeb a kalendáře spočítá termíny činností (ZADANI.md, kap. 7).
 *
 * Je to ČISTÁ FUNKCE: projekt dovnitř, spočítané termíny ven. Nic nemění, nic neukládá,
 * nezávisí na obrazovce. Díky tomu se dá spolehlivě otestovat (schedule.test.ts).
 *
 * Pravidla (stejná zvyklost jako v MS Projectu):
 *  - délka je v pracovních dnech, konec = poslední pracovní den činnosti,
 *  - vazby (prodleva + / − posouvá hranici o pracovní dny):
 *      FS: následník začne další pracovní den po konci předchůdce,
 *      SS: následník začne nejdřív v den začátku předchůdce,
 *      FF: následník skončí nejdřív v den konce předchůdce,
 *      SF: následník skončí nejdřív pracovní den před začátkem předchůdce,
 *  - milník leží na konci dne (FS, FF, SF) nebo na začátku dne (SS, omezení, začátek projektu),
 *  - fáze trvá od nejdřívějšího začátku do nejpozdějšího konce svých podřízených položek,
 *  - omezení „začít nejdříve k datu“ (fáze 4b): začátek = nejpozdější z (začátek projektu,
 *    vazby, omezení přichycené na pracovní den).
 */
import type { Dependency, Project, Task } from '../model/schema'
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
  /** Činnosti, jejichž omezení „začít nejdříve“ je dřív, než dovolí vazby – platí vazba (UI to vysvětlí). */
  constraintOverridden: Set<string>
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
    constraintOverridden: new Set(),
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
  /** Platné vazby všech typů (předchůdce existuje; fáze jako následník se zatím nepodporuje). */
  const dependenciesOf = (t: Task) =>
    t.kind === 'phase' ? [] : t.dependencies.filter((d) => byId.has(d.predecessorId) && d.predecessorId !== t.id)

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
  const constraintOverridden = new Set<string>()
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

  /**
   * Hranice, kterou vazba klade na následníka (podle typu, s prodlevou v pracovních dnech):
   *  - 'start':  následník začne nejdřív v tento den (FS, SS),
   *  - 'finish': následník skončí nejdřív v tento den (FF, SF).
   * U FS je to další pracovní den po konci předchůdce, u SF pracovní den před jeho začátkem.
   */
  function boundOf(pred: Computed, type: Dependency['type'], lag: number): { kind: 'start' | 'finish'; day: number; type: Dependency['type'] } {
    switch (type) {
      case 'FS':
        return { kind: 'start', day: calendar.addWorkingDays(pred.successorStartDay, lag), type }
      case 'SS':
        return { kind: 'start', day: calendar.addWorkingDays(pred.startDay, lag), type }
      case 'FF':
        return { kind: 'finish', day: calendar.addWorkingDays(pred.finishDay, lag), type }
      case 'SF':
        return { kind: 'finish', day: calendar.addWorkingDays(calendar.previousWorkingDay(pred.startDay - 1), lag), type }
    }
  }

  function computeTask(t: Task): Computed {
    const bounds = dependenciesOf(t)
      .map((d) => {
        const pred = computed.get(d.predecessorId)
        return pred ? boundOf(pred, d.type, d.lagDays) : null // předchůdce bez termínu neomezuje
      })
      .filter((b) => b !== null)
    // Omezení „začít nejdříve k datu“ (fáze 4b), přichycené na pracovní den.
    const constraintDay = t.constraintStart ? calendar.nextWorkingDay(isoToDay(t.constraintStart)) : null
    if (t.kind === 'milestone' || t.durationDays === 0) return computeMilestone(t, bounds, constraintDay)

    // Hranice konce (FF, SF) převedeme na hranici začátku podle délky činnosti.
    const startFor = (b: { kind: 'start' | 'finish'; day: number }) =>
      b.kind === 'start' ? b.day : calendar.addWorkingDays(b.day, -(t.durationDays - 1))
    const dependencyStart = bounds.length > 0 ? Math.max(...bounds.map(startFor)) : null

    // Skutečný začátek = nejpozdější z: začátek projektu, vazby, omezení.
    const start = Math.max(projectStartDay, dependencyStart ?? projectStartDay, constraintDay ?? projectStartDay)
    if (constraintDay !== null && dependencyStart !== null && dependencyStart >= projectStartDay && constraintDay < dependencyStart) {
      constraintOverridden.add(t.id) // omezení je dřív, než dovolí vazba – platí vazba
    }
    return {
      startDay: start,
      finishDay: calendar.addWorkingDays(start, t.durationDays - 1),
      successorStartDay: calendar.addWorkingDays(start, t.durationDays),
    }
  }

  /**
   * Milník leží buď na KONCI dne (určuje ho konec předchůdce – FS, FF, SF), nebo na ZAČÁTKU dne
   * (SS, omezení, začátek projektu). Podle toho jeho následník přes FS začne další pracovní den,
   * nebo týž den. Kandidáti: [den milníku, kdy může začít jeho následník].
   */
  function computeMilestone(
    t: Task,
    bounds: { kind: 'start' | 'finish'; day: number; type: Dependency['type'] }[],
    constraintDay: number | null,
  ): Computed {
    const fromDependencies: [number, number][] = bounds.map((b) => {
      if (b.type === 'FS') return [calendar.previousWorkingDay(b.day - 1), b.day] // konec dne předchůdce
      if (b.type === 'SS') return [b.day, b.day]
      return [b.day, calendar.nextWorkingDay(b.day + 1)] // FF, SF: konec dne
    })
    const others: [number, number][] = [[projectStartDay, projectStartDay]]
    if (constraintDay !== null) others.push([constraintDay, constraintDay])
    // Vyhraje nejpozdější den milníku; při shodě pozdější začátek následníka.
    const later = (a: [number, number], b: [number, number]) => (b[0] > a[0] || (b[0] === a[0] && b[1] > a[1]) ? b : a)
    const winner = [...fromDependencies, ...others].reduce(later)
    // Milník nikdy před začátkem projektu.
    const day = Math.max(winner[0], projectStartDay)
    const next = Math.max(winner[1], projectStartDay)

    if (constraintDay !== null && fromDependencies.length > 0) {
      const dependencyDay = fromDependencies.reduce(later)[0]
      if (dependencyDay >= projectStartDay && constraintDay < dependencyDay) constraintOverridden.add(t.id)
    }
    return { startDay: day, finishDay: day, successorStartDay: next }
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

  return { tasks, projectFinish: lastFinish === null ? null : dayToIso(lastFinish), cycleTaskIds, constraintOverridden }
}
