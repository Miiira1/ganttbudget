/**
 * Časová osa Ganttova grafu (G-04): jaký rozsah dnů se ukáže, kolik pixelů má jeden den
 * a jak se osa rozdělí na roky, čtvrtletí, měsíce, týdny a dny v hlavičce.
 *
 * Čisté funkce bez Reactu – dají se otestovat (timeline.test.ts). Pracují s „čísly dnů“
 * z plánovacího jádra (engine/calendar.ts). Texty (názvy měsíců) sem nepatří – hlavička
 * dostane jen čísla a přeloží si je sama podle jazyka.
 */
import { dayToIso, isoToDay, isoWeekday, type DayInfo, type WorkCalendar } from '../engine/calendar'

/** Měřítko osy: Dny, Týdny, Měsíce, Čtvrtletí. */
export type Zoom = 'day' | 'week' | 'month' | 'quarter'
export const ZOOMS: Zoom[] = ['day', 'week', 'month', 'quarter']

/**
 * Zoom gestem (dva prsty na touchpadu, Ctrl + kolečko): o jeden krok podrobněji ('in', směrem
 * k Dnům) nebo hrubší ('out', směrem ke Čtvrtletím). Na krajích zůstane.
 */
export function stepZoom(current: Zoom, direction: 'in' | 'out'): Zoom {
  const index = ZOOMS.indexOf(current) + (direction === 'in' ? -1 : 1)
  return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, index))] as Zoom
}

/** Šířka jednoho dne v pixelech pro každé měřítko. */
export const DAY_WIDTH: Record<Zoom, number> = { day: 28, week: 12, month: 4, quarter: 1.5 }

/** Kolik dní před začátkem a po konci projektu osa ještě ukáže (rezerva). */
const DAYS_BEFORE = 7
const DAYS_AFTER = 30

export interface Timeline {
  zoom: Zoom
  /** První den na ose. */
  startDay: number
  /** První den, který UŽ na ose není (konec „bez“, jako u rozsahů v programování). */
  endDay: number
  dayWidth: number
  /** Celková šířka osy v pixelech. */
  width: number
}

const MS_PER_DAY = 86_400_000

/** Rok, měsíc (1–12), den v měsíci. */
function ymd(day: number): [number, number, number] {
  return dayToIso(day).split('-').map(Number) as [number, number, number]
}

/** Číslo dne z roku, měsíce a dne; měsíc 13 = leden dalšího roku (Date.UTC to přepočítá). */
function fromYmd(year: number, month: number, dayOfMonth: number): number {
  return Math.round(Date.UTC(year, month - 1, dayOfMonth) / MS_PER_DAY)
}

const quarterOf = (month: number) => Math.ceil(month / 3)

/** Číslo týdne podle ISO 8601: týden patří do roku, ve kterém leží jeho čtvrtek. */
export function isoWeek(day: number): { year: number; week: number } {
  const thursday = day - isoWeekday(day) + 4
  const [year] = ymd(thursday)
  return { year, week: Math.floor((thursday - fromYmd(year, 1, 1)) / 7) + 1 }
}

type Unit = 'year' | 'quarter' | 'month' | 'week' | 'day'

/** Začátek jednotky (týdne, měsíce…), do které den patří. */
function unitStart(day: number, unit: Unit): number {
  const [y, m] = ymd(day)
  switch (unit) {
    case 'day':
      return day
    case 'week':
      return day - isoWeekday(day) + 1
    case 'month':
      return fromYmd(y, m, 1)
    case 'quarter':
      return fromYmd(y, (quarterOf(m) - 1) * 3 + 1, 1)
    case 'year':
      return fromYmd(y, 1, 1)
  }
}

/** Začátek následující jednotky. */
function nextUnitStart(day: number, unit: Unit): number {
  const start = unitStart(day, unit)
  const [y, m] = ymd(start)
  switch (unit) {
    case 'day':
      return start + 1
    case 'week':
      return start + 7
    case 'month':
      return fromYmd(y, m + 1, 1)
    case 'quarter':
      return fromYmd(y, m + 3, 1)
    case 'year':
      return fromYmd(y + 1, 1, 1)
  }
}

/** Na jaké jednotky se zarovná začátek a konec osy. */
const ALIGN_UNIT: Record<Zoom, Unit> = { day: 'week', week: 'week', month: 'month', quarter: 'quarter' }

/** Dva řádky hlavičky pro každé měřítko: [horní, dolní]. */
const HEADER_UNITS: Record<Zoom, [Unit, Unit]> = {
  day: ['month', 'day'],
  week: ['month', 'week'],
  month: ['year', 'month'],
  quarter: ['year', 'quarter'],
}

export function createTimeline(options: { zoom: Zoom; projectStart: string; projectFinish: string | null }): Timeline {
  const { zoom } = options
  const start = isoToDay(options.projectStart)
  const finish = Math.max(start, options.projectFinish ? isoToDay(options.projectFinish) : start)
  const unit = ALIGN_UNIT[zoom]
  const startDay = unitStart(start - DAYS_BEFORE, unit)
  const endDay = nextUnitStart(finish + DAYS_AFTER, unit)
  const dayWidth = DAY_WIDTH[zoom]
  return { zoom, startDay, endDay, dayWidth, width: (endDay - startDay) * dayWidth }
}

/** Levý okraj dne na ose (v pixelech). */
export function dayToX(tl: Timeline, day: number): number {
  return (day - tl.startDay) * tl.dayWidth
}

/** Který den leží na pozici x. */
export function xToDay(tl: Timeline, x: number): number {
  return tl.startDay + Math.floor(x / tl.dayWidth)
}

/**
 * Který den (i s částí dne) je pod kurzorem: graf je posunutý o `scrollLeft` a kurzor je
 * `offsetX` pixelů od levého okraje viditelné části.
 */
export function dayAtOffset(tl: Timeline, scrollLeft: number, offsetX: number): number {
  return tl.startDay + (scrollLeft + offsetX) / tl.dayWidth
}

/** O kolik posunout graf, aby den `day` byl `offsetX` pixelů od levého okraje (nikdy záporně). */
export function scrollLeftForAnchor(tl: Timeline, day: number, offsetX: number): number {
  return Math.max(0, dayToX(tl, day) - offsetX)
}

/** Jeden úsek hlavičky (např. „listopad 2026“ nebo „týden 47“). */
export interface HeaderSegment {
  unit: Unit
  startDay: number
  /** První den za úsekem. */
  endDay: number
  x: number
  width: number
  /** Číslo k zobrazení: den v měsíci, číslo týdne, měsíc 1–12, čtvrtletí 1–4, nebo rok. */
  value: number
  /** Rok, ke kterému úsek patří (u týdne rok podle ISO). */
  year: number
}

function segmentsFor(tl: Timeline, unit: Unit): HeaderSegment[] {
  const segments: HeaderSegment[] = []
  for (let day = tl.startDay; day < tl.endDay; ) {
    const endDay = Math.min(nextUnitStart(day, unit), tl.endDay)
    const [y, m, d] = ymd(day)
    let value: number
    let year = y
    switch (unit) {
      case 'day':
        value = d
        break
      case 'week':
        ;({ week: value, year } = isoWeek(day))
        break
      case 'month':
        value = m
        break
      case 'quarter':
        value = quarterOf(m)
        break
      case 'year':
        value = y
        break
    }
    segments.push({ unit, startDay: day, endDay, x: dayToX(tl, day), width: (endDay - day) * tl.dayWidth, value, year })
    day = endDay
  }
  return segments
}

/** Úseky obou řádků hlavičky: [horní, dolní]. */
export function headerRows(tl: Timeline): [HeaderSegment[], HeaderSegment[]] {
  const [top, bottom] = HEADER_UNITS[tl.zoom]
  return [segmentsFor(tl, top), segmentsFor(tl, bottom)]
}

/** Souvislý pruh volných dnů stejného druhu (např. víkend, nebo celá odstávka). */
export interface NonWorkingRun {
  startDay: number
  /** První den za pruhem. */
  endDay: number
  info: Exclude<DayInfo, { kind: 'working' }>
}

function sameInfo(a: DayInfo, b: DayInfo): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'holiday' && b.kind === 'holiday') return a.key === b.key
  if (a.kind === 'custom' && b.kind === 'custom') return a.name === b.name
  return true
}

/** Volné dny na ose, sousední dny stejného druhu spojené do jednoho pruhu (méně kreslení). */
export function nonWorkingRuns(tl: Timeline, calendar: WorkCalendar): NonWorkingRun[] {
  const runs: NonWorkingRun[] = []
  for (let day = tl.startDay; day < tl.endDay; day++) {
    const info = calendar.describeDay(day)
    if (info.kind === 'working') continue
    const last = runs.at(-1)
    if (last && last.endDay === day && sameInfo(last.info, info)) last.endDay = day + 1
    else runs.push({ startDay: day, endDay: day + 1, info })
  }
  return runs
}
