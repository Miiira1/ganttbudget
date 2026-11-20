/**
 * Earned Value – plán vs. skutečnost (fáze 9, A-05) – čisté funkce, testy v earnedValue.test.ts.
 *
 * K datu stavu a vybrané baseline (peníze v haléřích):
 *  - BAC = plánovaný náklad podle baseline (celý),
 *  - PV  = náklad baseline do data stavu včetně (kolik práce mělo být hotovo),
 *  - EV  = BAC × % hotovo (kolik práce je opravdu hotovo),
 *  - AC  = skutečné náklady do data stavu včetně (kolik se opravdu utratilo),
 *  - SV = EV − PV, CV = EV − AC, SPI = EV / PV, CPI = EV / AC (2 desetinná místa),
 *  - EAC = BAC / CPI (odhad celkových nákladů), ETC = EAC − AC, VAC = BAC − EAC.
 * Dělení nulou → null (UI vysvětlí). Fáze sčítá své podřízené; její % = EV / BAC podřízených,
 * bez nákladů vážené délkou (rollupPercent). Činnost přidaná po uložení baseline má BAC 0,
 * ale skutečnost se jí počítá; činnost smazaná z plánu zůstává (PV běží, hotovo 0 %).
 */
import { isoToDay } from '../engine/calendar'
import type { ScheduleResult } from '../engine/schedule'
import type { DayRange } from './periods'
import type { Baseline, BaselineTask, Project, Task, TaskKind } from './schema'

export interface EvRow {
  taskId: string
  name: string
  kind: TaskKind
  parentId: string | null
  /** Položka je v aktuálním plánu / v baseline. */
  inPlan: boolean
  inBaseline: boolean
  /** % hotovo (u fáze spočítané). */
  percent: number
  bac: number
  pv: number
  ev: number
  ac: number
  baselineStart: string | null
  baselineFinish: string | null
  /** Aktuální termíny (null = položka v plánu není nebo nemá termín). */
  start: string | null
  finish: string | null
  /** Posun proti baseline v kalendářních dnech (kladný = později); null = nejde porovnat. */
  startShift: number | null
  finishShift: number | null
}

export interface EvTotals {
  bac: number
  pv: number
  ev: number
  ac: number
  sv: number
  cv: number
  spi: number | null
  cpi: number | null
  eac: number | null
  etc: number | null
  vac: number | null
}

export interface EarnedValueResult {
  statusDay: number
  /** Řádky ve stromovém pořadí (fáze před podřízenými; položky jen z baseline na konci své fáze). */
  rows: EvRow[]
  byId: Map<string, EvRow>
  totals: EvTotals
}

const round2 = (x: number) => Math.round(x * 100) / 100

/** Podřízené položky podle nadřazené (null = nejvyšší úroveň), seřazené podle pořadí. */
function childrenOf(tasks: readonly Task[]): Map<string | null, Task[]> {
  const map = new Map<string | null, Task[]>()
  for (const t of tasks) {
    const list = map.get(t.parentId)
    if (list) list.push(t)
    else map.set(t.parentId, [t])
  }
  for (const list of map.values()) list.sort((a, b) => a.order - b.order)
  return map
}

/**
 * % hotovo každé položky: činnost a milník jak je zadáno, fáze spočítaná z podřízených.
 *
 * S baseline (bacByTask) přesně jako pohled Sledování (Earned Value): % fáze = EV podřízených
 * ÷ BAC podřízených, kde vnořená fáze přispívá i svými vlastními náklady (audit V-N6 – dřív
 * Gantt bral jen činnosti a ukazoval jiné číslo než Sledování). Když podřízené nemají žádný
 * plánovaný náklad, platí výpočet bez baseline.
 *
 * Bez baseline: z činností (i vnořených) vážených délkou, a když mají všechny délku 0
 * (milníky), prostým průměrem. Fáze bez činností = 0 %.
 */
export function rollupPercent(project: Project, bacByTask: ReadonlyMap<string, number> | null): Map<string, number> {
  const children = childrenOf(project.tasks)
  const byDuration = rollupByDuration(project, children)
  if (!bacByTask) return byDuration

  const result = new Map<string, number>()
  const done = new Map<string, { bac: number; ev: number }>()
  const visit = (task: Task): { bac: number; ev: number } => {
    const known = done.get(task.id)
    if (known) return known
    const own = bacByTask.get(task.id) ?? 0
    let value: { bac: number; ev: number }
    if (task.kind !== 'phase') {
      result.set(task.id, task.percentComplete)
      value = { bac: own, ev: Math.round((own * task.percentComplete) / 100) }
    } else {
      // Stejné výpočty a zaokrouhlení jako earnedValue() níže.
      const kids = (children.get(task.id) ?? []).map(visit)
      const kidsBac = kids.reduce((sum, k) => sum + k.bac, 0)
      const kidsEv = kids.reduce((sum, k) => sum + k.ev, 0)
      const percent = kidsBac > 0 ? Math.round((kidsEv / kidsBac) * 100) : (byDuration.get(task.id) ?? 0)
      result.set(task.id, percent)
      value = { bac: kidsBac + own, ev: kidsEv + Math.round((own * percent) / 100) }
    }
    done.set(task.id, value)
    return value
  }
  for (const task of project.tasks) visit(task)
  return result
}

/** % hotovo fází bez baseline: činnosti vážené délkou, při nulových délkách prostý průměr. */
function rollupByDuration(project: Project, children: Map<string | null, Task[]>): Map<string, number> {
  const result = new Map<string, number>()
  const leavesOf = (id: string): Task[] => (children.get(id) ?? []).flatMap((c) => (c.kind === 'phase' ? leavesOf(c.id) : [c]))
  for (const task of project.tasks) {
    if (task.kind !== 'phase') {
      result.set(task.id, task.percentComplete)
      continue
    }
    const leaves = leavesOf(task.id)
    const weighted = (weight: (t: Task) => number): number | null => {
      const total = leaves.reduce((sum, t) => sum + weight(t), 0)
      return total > 0 ? Math.round(leaves.reduce((sum, t) => sum + weight(t) * t.percentComplete, 0) / total) : null
    }
    result.set(task.id, weighted((t) => t.durationDays) ?? weighted(() => 1) ?? 0)
  }
  return result
}

export function earnedValue(project: Project, scheduleResult: ScheduleResult, baseline: Baseline, statusDay: number): EarnedValueResult {
  const planned = new Map<string, BaselineTask>(baseline.tasks.map((t) => [t.taskId, t]))
  const current = new Map(project.tasks.map((t) => [t.id, t]))
  const fallbackPercent = rollupPercent(project, null)

  // Strom: aktuální plán + položky, které zůstaly jen v baseline (pod svou původní fází, existuje-li).
  const children = new Map<string | null, string[]>()
  const add = (parent: string | null, id: string) => {
    const list = children.get(parent)
    if (list) list.push(id)
    else children.set(parent, [id])
  }
  for (const [parent, list] of childrenOf(project.tasks)) for (const t of list) add(parent, t.id)
  const onlyInBaseline = baseline.tasks.filter((t) => !current.has(t.taskId))
  const known = new Set([...current.keys(), ...planned.keys()])
  const parentOf = (t: BaselineTask) => (t.parentId !== null && known.has(t.parentId) ? t.parentId : null)
  for (const t of onlyInBaseline) add(parentOf(t), t.taskId)

  /** Náklad baseline položky: celý a do data stavu. */
  const ownPlan = (t: BaselineTask | undefined): { bac: number; pv: number } => {
    if (!t || t.costs.length === 0 || t.costStart === undefined) return { bac: 0, pv: 0 }
    const first = isoToDay(t.costStart)
    let bac = 0
    let pv = 0
    t.costs.forEach((amount, i) => {
      bac += amount
      if (first + i <= statusDay) pv += amount
    })
    return { bac, pv }
  }
  const ownActual = (task: Task | undefined) => (task?.actuals ?? []).reduce((sum, a) => (isoToDay(a.date) <= statusDay ? sum + a.amount : sum), 0)

  const byId = new Map<string, EvRow>()
  const rows: EvRow[] = []
  function visit(id: string, parentId: string | null): EvRow {
    const task = current.get(id)
    const base = planned.get(id)
    const s = task ? scheduleResult.tasks.get(id) : undefined
    const kind = task?.kind ?? base!.kind
    const own = ownPlan(base)
    const row: EvRow = {
      taskId: id,
      name: task?.name ?? base!.name,
      kind,
      parentId,
      inPlan: task !== undefined,
      inBaseline: base !== undefined,
      percent: 0,
      bac: own.bac,
      pv: own.pv,
      ev: 0,
      ac: ownActual(task),
      baselineStart: base?.start ?? null,
      baselineFinish: base?.finish ?? null,
      start: s?.start ?? null,
      finish: s?.finish ?? null,
      startShift: base && s?.start ? isoToDay(s.start) - isoToDay(base.start) : null,
      finishShift: base && s?.finish ? isoToDay(s.finish) - isoToDay(base.finish) : null,
    }
    rows.push(row)
    byId.set(id, row)

    const kids = (children.get(id) ?? []).map((childId) => visit(childId, id))
    if (kind !== 'phase') {
      row.percent = task?.percentComplete ?? 0
      row.ev = Math.round((own.bac * row.percent) / 100)
    } else {
      const kidsBac = kids.reduce((sum, k) => sum + k.bac, 0)
      const kidsEv = kids.reduce((sum, k) => sum + k.ev, 0)
      row.percent = kidsBac > 0 ? Math.round((kidsEv / kidsBac) * 100) : task ? (fallbackPercent.get(id) ?? 0) : 0
      // Vlastní řádky fáze se plní stejně jako fáze.
      row.ev = kidsEv + Math.round((own.bac * row.percent) / 100)
      for (const k of kids) {
        row.bac += k.bac
        row.pv += k.pv
        row.ac += k.ac
      }
    }
    return row
  }
  const roots = (children.get(null) ?? []).map((id) => visit(id, null))

  const sum = (key: 'bac' | 'pv' | 'ev' | 'ac') => roots.reduce((total, r) => total + r[key], 0)
  const bac = sum('bac')
  const pv = sum('pv')
  const ev = sum('ev')
  const ac = sum('ac')
  const eac = ac > 0 && ev > 0 ? Math.round((bac * ac) / ev) : null
  return {
    statusDay,
    rows,
    byId,
    totals: {
      bac,
      pv,
      ev,
      ac,
      sv: ev - pv,
      cv: ev - ac,
      spi: pv > 0 ? round2(ev / pv) : null,
      cpi: ac > 0 ? round2(ev / ac) : null,
      eac,
      etc: eac === null ? null : eac - ac,
      vac: eac === null ? null : bac - eac,
    },
  }
}

export interface EvCurves {
  /** Od prvního do posledního dne s plánovaným nákladem nebo skutečností; null = nic. */
  range: DayRange | null
  /** Kumulativní PV a AC po dnech rozsahu (index 0 = range.startDay). */
  pv: number[]
  ac: number[]
}

/** Křivky PV (z baseline) a AC (ze skutečnosti) po dnech – podklad grafu v pohledu Sledování. */
export function evCurves(project: Project, baseline: Baseline): EvCurves {
  const planned: { day: number; amount: number }[] = []
  const actual: { day: number; amount: number }[] = []
  for (const t of baseline.tasks) {
    if (t.costStart === undefined) continue
    const first = isoToDay(t.costStart)
    t.costs.forEach((amount, i) => amount !== 0 && planned.push({ day: first + i, amount }))
  }
  for (const task of project.tasks) for (const a of task.actuals ?? []) actual.push({ day: isoToDay(a.date), amount: a.amount })
  const days = [...planned, ...actual].map((x) => x.day)
  if (days.length === 0) return { range: null, pv: [], ac: [] }
  let startDay = Infinity
  let endDay = -Infinity
  for (const d of days) {
    if (d < startDay) startDay = d
    if (d > endDay) endDay = d
  }
  const n = endDay - startDay + 1
  const accumulate = (items: { day: number; amount: number }[]) => {
    const daily = new Array<number>(n).fill(0)
    for (const x of items) daily[x.day - startDay]! += x.amount
    for (let i = 1; i < n; i++) daily[i]! += daily[i - 1]!
    return daily
  }
  return { range: { startDay, endDay }, pv: accumulate(planned), ac: accumulate(actual) }
}

/**
 * Křivky vzorkované po obdobích pro graf: kumulativní hodnota ke konci každého období.
 * PV přes všechna období; AC jen do data stavu (u období, které ho obsahuje, k datu stavu),
 * období po datu stavu = null (skutečnost ještě není).
 */
export function sampleCurves(curves: EvCurves, periods: readonly DayRange[], statusDay: number): { pv: number[]; ac: (number | null)[] } {
  const at = (series: number[], day: number): number => {
    if (!curves.range || day < curves.range.startDay) return 0
    return series[Math.min(day, curves.range.endDay) - curves.range.startDay] ?? 0
  }
  return {
    pv: periods.map((p) => at(curves.pv, p.endDay)),
    ac: periods.map((p) => (p.startDay > statusDay ? null : at(curves.ac, Math.min(p.endDay, statusDay)))),
  }
}
