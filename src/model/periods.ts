/**
 * Dělení času na období – společné pro Vytížení (fáze 6c) i Náklady (fáze 7), aby oba pohledy
 * dělily čas stejně. Dny jsou čísla dnů (viz engine/calendar). Testy v periods.test.ts a load.test.ts.
 */
import { dayToIso, isoWeekday } from '../engine/calendar'

/** Souvislý rozsah dnů od–do včetně. */
export interface DayRange {
  startDay: number
  endDay: number
}

export type PeriodUnit = 'day' | 'week' | 'month' | 'quarter'

/** Číslo dne posledního dne měsíce (`month` 1–12). */
function lastDayOfMonth(year: number, month: number): number {
  return Math.round(Date.UTC(year, month, 0) / 86_400_000)
}

/**
 * Rozdělí rozsah na dny, týdny (po–ne), kalendářní měsíce nebo čtvrtletí (leden–březen…).
 * Krajní období jsou oříznutá rozsahem.
 */
export function splitPeriods(range: DayRange, unit: PeriodUnit): DayRange[] {
  const periods: DayRange[] = []
  for (let start = range.startDay; start <= range.endDay; ) {
    let end: number
    if (unit === 'day') end = start
    else if (unit === 'week') end = start + (7 - isoWeekday(start))
    else {
      const [y, m] = dayToIso(start).split('-').map(Number) as [number, number]
      end = unit === 'month' ? lastDayOfMonth(y, m) : lastDayOfMonth(y, Math.ceil(m / 3) * 3)
    }
    end = Math.min(end, range.endDay)
    periods.push({ startDay: start, endDay: end })
    start = end + 1
  }
  return periods
}
