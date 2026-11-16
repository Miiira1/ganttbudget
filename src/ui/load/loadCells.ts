/**
 * Jak vypadá jedna buňka mřížky vytížení a jak se jmenují období (sloupce).
 * Odděleno od komponent, aby mřížka i histogram mluvily stejně.
 */
import type { TFunction } from 'i18next'
import { dayToIso } from '../../engine/calendar'
import { isoWeek } from '../../gantt/timeline'
import { formatDayMonth, formatIsoDate, formatMonth, formatNumber, formatWeekdayShort } from '../../i18n/format'
import type { PeriodLoad, ResourceLoad } from '../../model/load'
import type { DayRange, PeriodUnit } from '../../model/periods'

/** Hranice „vysokého“ vytížení (ještě bez přetížení). */
export const HIGH_LOAD_PCT = 80

export type CellLevel = 'empty' | 'low' | 'high' | 'over' | 'demandOnly'

export function cellLevel(summary: PeriodLoad, resource: ResourceLoad): CellLevel {
  if (summary.demand === 0) return 'empty'
  if (!resource.hasCapacity) return 'demandOnly'
  if (summary.overloadedDays > 0) return 'over'
  return (summary.peakPct ?? 0) >= HIGH_LOAD_PCT ? 'high' : 'low'
}

/** Barvy buněk: tyrkysová = práce v rámci kapacity, červená = přetížení (chyba plánu). */
export const CELL_CLASS: Record<CellLevel, string> = {
  empty: '',
  low: 'bg-miro-turquoise-light/70 text-slate-700 dark:bg-miro-turquoise/15 dark:text-slate-200',
  high: 'bg-miro-turquoise/45 font-medium text-miro-graphite dark:bg-miro-turquoise/35 dark:text-white',
  over: 'bg-red-100 font-semibold text-red-800 dark:bg-red-500/30 dark:text-red-100',
  demandOnly: 'bg-slate-100 italic text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

const hours = (value: number, lang: string) => formatNumber(Math.round(value * 10) / 10, lang)

/** Text v buňce: nejvyšší denní vytížení v %, u profese bez lidí hodiny. */
export function cellText(summary: PeriodLoad, level: CellLevel, lang: string): string {
  if (level === 'empty') return ''
  if (level === 'demandOnly') return `${hours(summary.demand, lang)} h`
  return summary.peakPct === null ? '!' : `${summary.peakPct} %`
}

/** Bublina buňky: kolik hodin z kolika, nejvyšší vytížení a počet přetížených dnů. */
export function cellTitle(summary: PeriodLoad, level: CellLevel, t: TFunction, lang: string): string {
  const demand = hours(summary.demand, lang)
  const capacity = hours(summary.capacity, lang)
  if (level === 'empty') return t('load.cell.free', { capacity })
  if (level === 'demandOnly') return t('load.cell.noCapacity', { demand })
  const parts = [t('load.cell.title', { demand, capacity })]
  if (summary.peakPct !== null) parts.push(t('load.cell.peak', { pct: summary.peakPct }))
  if (summary.overloadedDays > 0) parts.push(t('load.cell.overloaded', { count: summary.overloadedDays }))
  return parts.join('\n')
}

export function formatHours(value: number, lang: string): string {
  return hours(value, lang)
}

/** Popisek sloupce ve dvou řádcích (nahoře hlavní, dole doplňující) + celé období do bubliny. */
export function periodLabel(period: DayRange, unit: PeriodUnit, t: TFunction, lang: string): { top: string; bottom: string; title: string } {
  const start = dayToIso(period.startDay)
  const end = dayToIso(period.endDay)
  const title = start === end ? formatIsoDate(start, lang) : `${formatIsoDate(start, lang)} – ${formatIsoDate(end, lang)}`
  if (unit === 'day') return { top: formatDayMonth(start, lang), bottom: formatWeekdayShort(start, lang), title }
  if (unit === 'week') return { top: t('load.weekShort', { n: isoWeek(period.startDay).week }), bottom: formatDayMonth(start, lang), title }
  const [y, m] = start.split('-').map(Number) as [number, number]
  if (unit === 'quarter') return { top: t('periods.quarterShort', { n: Math.ceil(m / 3) }), bottom: String(y), title }
  return { top: formatMonth(y, m, lang, 'short'), bottom: String(y), title }
}
