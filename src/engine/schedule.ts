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
 *
 * Kritická cesta (fáze 6c, F-09): po dopředném výpočtu následuje zpětný průchod. Počítá se na ose
 * „pracovních dnů“: činnost zabírá úsek [začátek, konec) a milník je bod (začátek nebo konec dne).
 * Na té ose jsou všechny vazby prosté sčítání: FS: S ≥ E + prodleva, SS: S ≥ S + p, FF: E ≥ E + p,
 * SF: E ≥ S + p. Nejpozdější termíny se počítají odzadu od konce projektu; omezení „začít nejdříve“
 * je neomezuje. Celková rezerva = nejpozdější − nejdřívější začátek; volná rezerva = o kolik se
 * položka zpozdí, aniž posune následníka; kritická = celková rezerva 0.
 */
import type { Dependency, Project, Task } from '../model/schema'
import { createWorkCalendar, dayToIso, isoToDay, NoWorkingDaysError, type WorkCalendar } from './calendar'

export interface ScheduledTask {
  /** Začátek "YYYY-MM-DD", nebo null, když termín nejde spočítat. */
  start: string | null
  finish: string | null
  /** Délka v pracovních dnech; u fáze spočítaná z jejího začátku a konce, null = nejde spočítat. */
  durationDays: number | null
  /** Nejpozdější začátek a konec, aby se neposunul konec projektu (fáze 6c). */
  lateStart: string | null
  lateFinish: string | null
  /** Celková rezerva v pracovních dnech (o kolik se smí zpozdit, aniž se posune konec projektu). */
  totalSlack: number | null
  /** Volná rezerva v pracovních dnech (o kolik se smí zpozdit, aniž posune následníka). */
  freeSlack: number | null
  /** Leží na kritické cestě (celková rezerva 0). */
  critical: boolean
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
  /**
   * Milník = okamžik. Leží buď na začátku dne `startDay` (pak successorStartDay = startDay),
   * nebo na jeho konci (successorStartDay = další pracovní den). Vazby SS, FF a SF z milníku
   * proto počítají s tímto okamžikem, ne s „dnem milníku“ (audit V-S1, V-N1, V-N2).
   */
  milestone?: true
  /** Fáze, která obsahuje jen milníky (i vnořeně) – má délku 0 dní (audit V-N5). */
  onlyMilestones?: true
}

export const EMPTY_SCHEDULED: ScheduledTask = {
  start: null,
  finish: null,
  durationDays: null,
  lateStart: null,
  lateFinish: null,
  totalSlack: null,
  freeSlack: null,
  critical: false,
}
const EMPTY = EMPTY_SCHEDULED

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
    // Začátek a konec předchůdce jako pracovní dny. U milníku oba odpovídají jeho okamžiku:
    // „začátek“ = den, kdy po milníku může něco začít; „konec“ = den, který milníkem končí.
    const startDay = pred.milestone ? pred.successorStartDay : pred.startDay
    const finishDay = pred.milestone ? calendar.previousWorkingDay(pred.successorStartDay - 1) : pred.finishDay
    switch (type) {
      case 'FS':
        return { kind: 'start', day: calendar.addWorkingDays(pred.successorStartDay, lag), type }
      case 'SS':
        return { kind: 'start', day: calendar.addWorkingDays(startDay, lag), type }
      case 'FF':
        return { kind: 'finish', day: calendar.addWorkingDays(finishDay, lag), type }
      case 'SF':
        return { kind: 'finish', day: calendar.addWorkingDays(calendar.previousWorkingDay(startDay - 1), lag), type }
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
    return { startDay: day, finishDay: day, successorStartDay: next, milestone: true }
  }

  function computePhase(t: Task): Computed | null {
    const parts = (children.get(t.id) ?? []).map((c) => computed.get(c.id)).filter((c) => c !== undefined)
    if (parts.length === 0) return null
    const finishDay = Math.max(...parts.map((p) => p.finishDay))
    const result: Computed = {
      startDay: Math.min(...parts.map((p) => p.startDay)),
      finishDay,
      successorStartDay: Math.max(...parts.map((p) => p.successorStartDay)),
    }
    if (parts.every((p) => p.milestone || p.onlyMilestones)) result.onlyMilestones = true
    return result
  }

  // --- 4. Konec projektu ---
  let lastFinish: number | null = null
  for (const c of computed.values()) if (lastFinish === null || c.finishDay > lastFinish) lastFinish = c.finishDay

  // --- 5. Zpětný průchod: nejpozdější termíny a rezervy (fáze 6c) ---
  const late = lastFinish === null ? new Map<string, Late>() : backwardPass(lastFinish)

  // --- 6. Výsledek v ISO dnech ---
  const tasks = new Map<string, ScheduledTask>()
  for (const t of project.tasks) {
    const c = computed.get(t.id)
    if (!c) {
      tasks.set(t.id, EMPTY)
      continue
    }
    const durationDays =
      t.kind !== 'phase' ? t.durationDays : c.onlyMilestones ? 0 : calendar.countWorkingDays(c.startDay, c.finishDay)
    const l = late.get(t.id)
    tasks.set(t.id, {
      start: dayToIso(c.startDay),
      finish: dayToIso(c.finishDay),
      durationDays,
      lateStart: l ? dayToIso(l.lateStartDay) : null,
      lateFinish: l ? dayToIso(l.lateFinishDay) : null,
      totalSlack: l?.total ?? null,
      freeSlack: l?.free ?? null,
      critical: l !== undefined && l.total <= 0,
    })
  }

  return { tasks, projectFinish: lastFinish === null ? null : dayToIso(lastFinish), cycleTaskIds, constraintOverridden }

  /**
   * Zpětný průchod na ose pracovních dnů (index = kolikátý pracovní den od začátku projektu).
   * Činnost: [ES, EE) s délkou d; milník: bod ES = EE (konec dne předchůdce, nebo začátek dne).
   */
  function backwardPass(projectFinishDay: number): Map<string, Late> {
    const days: number[] = []
    const indexOf = new Map<number, number>()
    for (let day = projectStartDay; day <= projectFinishDay; day++) {
      if (calendar.isWorkingDay(day)) {
        indexOf.set(day, days.length)
        days.push(day)
      }
    }
    // Den za koncem projektu (začátek následníka poslední činnosti) = days.length.
    const idx = (day: number) => indexOf.get(day) ?? (day > projectFinishDay ? days.length : 0)
    const early = new Map<string, { es: number; ee: number; endOfDay: boolean }>()
    let projectEnd = 0
    for (const [id, c] of computed) {
      if ((byId.get(id) as Task).kind === 'phase') continue
      const es = idx(c.startDay)
      // Konec = začátek, kdy může navázat následník FS (u milníku konec / začátek dne).
      const ee = idx(c.successorStartDay)
      const isMilestone = c.startDay === c.finishDay && (byId.get(id) as Task).durationDays === 0
      early.set(id, { es: isMilestone ? ee : es, ee, endOfDay: c.successorStartDay > c.finishDay })
      projectEnd = Math.max(projectEnd, ee)
    }

    // Následníci přes vazby (předchůdce → seznam vazeb).
    const links = new Map<string, { to: string; type: Dependency['type']; lag: number }[]>()
    for (const t of project.tasks) {
      if (!early.has(t.id)) continue
      for (const d of dependenciesOf(t)) {
        if (!early.has(d.predecessorId)) continue
        links.set(d.predecessorId, [...(links.get(d.predecessorId) ?? []), { to: t.id, type: d.type, lag: d.lagDays }])
      }
    }

    const lateEnd = new Map<string, number>()
    const result = new Map<string, Late>()
    for (const id of [...order].reverse()) {
      const e = early.get(id)
      if (!e) continue // fáze a položky bez termínu
      const d = e.ee - e.es
      let le = projectEnd
      let free = Number.POSITIVE_INFINITY
      for (const link of links.get(id) ?? []) {
        const s = early.get(link.to) as { es: number; ee: number }
        const sLe = lateEnd.get(link.to) as number
        const sLs = sLe - (s.ee - s.es)
        switch (link.type) {
          case 'FS':
            le = Math.min(le, sLs - link.lag)
            free = Math.min(free, s.es - link.lag - e.ee)
            break
          case 'SS':
            le = Math.min(le, sLs - link.lag + d)
            free = Math.min(free, s.es - link.lag - e.es)
            break
          case 'FF':
            le = Math.min(le, sLe - link.lag)
            free = Math.min(free, s.ee - link.lag - e.ee)
            break
          case 'SF':
            le = Math.min(le, sLe - link.lag + d)
            free = Math.min(free, s.ee - link.lag - e.es)
            break
        }
      }
      if (!Number.isFinite(free)) free = projectEnd - e.ee
      lateEnd.set(id, le)
      const total = le - e.ee
      const ls = le - d
      // Datum: činnost [ls, le) → poslední den le − 1; milník na konci dne → den před bodem.
      const lateStartDay = d === 0 ? (days[e.endOfDay ? ls - 1 : ls] ?? days[days.length - 1]) : days[ls]
      const lateFinishDay = d === 0 ? lateStartDay : days[le - 1]
      result.set(id, {
        lateStartDay: lateStartDay as number,
        lateFinishDay: lateFinishDay as number,
        total,
        free: Math.max(0, Math.min(free, total)),
      })
    }

    // Fáze: rezerva nejmenší ze svých položek, pozdní termíny z rozsahu položek (podřízené dřív než fáze).
    for (const id of order) {
      const t = byId.get(id) as Task
      if (t.kind !== 'phase') continue
      const parts = (children.get(id) ?? []).map((c) => result.get(c.id)).filter((x) => x !== undefined)
      if (parts.length === 0) continue
      result.set(id, {
        lateStartDay: Math.min(...parts.map((x) => x.lateStartDay)),
        lateFinishDay: Math.max(...parts.map((x) => x.lateFinishDay)),
        total: Math.min(...parts.map((x) => x.total)),
        free: Math.min(...parts.map((x) => x.free)),
      })
    }
    return result
  }
}

/** Výsledek zpětného průchodu pro jednu položku (čísla dnů a rezervy v pracovních dnech). */
interface Late {
  lateStartDay: number
  lateFinishDay: number
  total: number
  free: number
}
