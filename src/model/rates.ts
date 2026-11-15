/**
 * Kalkulace hodinové sazby profese nebo pracovníka (Z-04) – čisté funkce, testy v rates.test.ts.
 *
 *   roční náklady       = hrubá měsíční mzda × 12 + odvody zaměstnavatele + režie
 *   produktivní hodiny  = (fond pracovních dnů − dovolená − nemoc) × hodin denně × produktivita
 *   sazba               = roční náklady ÷ produktivní hodiny (zaokrouhleno na haléře)
 *
 * Peníze jsou celá čísla v haléřích; zaokrouhluje se u každé peněžní mezihodnoty.
 */
import { createWorkCalendar, isoToDay } from '../engine/calendar'
import type { Calendar, RateCalcData } from './schema'

/**
 * Údaje kalkulace (tvar a meze určuje RateCalcSchema ve schema.ts):
 * hrubá měsíční mzda (haléře), odvody zaměstnavatele v % (ČR 2026: 33,8 %), režie
 * (pevná částka za rok v haléřích, nebo % z mzdy), dny dovolené a nemoci, hodin denně
 * a produktivita v % (porady, cesty a školení se nepočítají).
 */
export type RateCalc = RateCalcData

export function createDefaultRateCalc(): RateCalc {
  return {
    monthlyWage: 0,
    contributionsPct: 33.8,
    overheadMode: 'percent',
    overheadValue: 0,
    vacationDays: 25,
    sickDays: 5,
    hoursPerDay: 8,
    productivityPct: 85,
  }
}

/** Fond: pracovní dny v kalendářním roce podle kalendáře projektu (víkendy, svátky, odstávky). */
export function workingDaysInYear(calendar: Calendar, year: number): number {
  return createWorkCalendar(calendar).countWorkingDays(isoToDay(`${year}-01-01`), isoToDay(`${year}-12-31`))
}

export type RateResult =
  | {
      ok: true
      annualWage: number
      contributions: number
      overhead: number
      annualCost: number
      fundDays: number
      availableDays: number
      productiveHours: number
      /** Hodinová sazba v haléřích. */
      rate: number
    }
  | { ok: false; error: 'noProductiveHours' }

const percentOf = (amount: number, pct: number) => Math.round((amount * pct) / 100)

export function calculateRate(calc: RateCalc, fundDays: number): RateResult {
  const annualWage = calc.monthlyWage * 12
  const contributions = percentOf(annualWage, calc.contributionsPct)
  const overhead = calc.overheadMode === 'percent' ? percentOf(annualWage, calc.overheadValue) : calc.overheadValue
  const annualCost = annualWage + contributions + overhead
  const availableDays = fundDays - calc.vacationDays - calc.sickDays
  // Hodiny zaokrouhlené na desetiny (jen pro zobrazení a stabilní výsledek).
  const productiveHours = Math.round((availableDays * calc.hoursPerDay * calc.productivityPct) / 10) / 10
  if (!(productiveHours > 0)) return { ok: false, error: 'noProductiveHours' }
  const rate = Math.round(annualCost / productiveHours)
  return { ok: true, annualWage, contributions, overhead, annualCost, fundDays, availableDays, productiveHours, rate }
}

interface RateSource {
  manualRate?: number
  rateCalc?: RateCalc
}

/** Sazba z ruční hodnoty nebo z kalkulace; null = sazba zatím chybí. */
function ownRate(source: RateSource, fundDays: number): { rate: number; source: 'manual' | 'calc' } | null {
  if (source.manualRate !== undefined) return { rate: source.manualRate, source: 'manual' }
  if (source.rateCalc) {
    const result = calculateRate(source.rateCalc, fundDays)
    if (result.ok) return { rate: result.rate, source: 'calc' }
  }
  return null
}

/** Sazba profese: ruční > kalkulace > žádná (null). */
export function professionRate(profession: RateSource, fundDays: number): number | null {
  return ownRate(profession, fundDays)?.rate ?? null
}

/** Sazba pracovníka: ruční > vlastní kalkulace > sazba jeho profese. */
export function effectiveWorkerRate(
  worker: RateSource,
  profession: RateSource,
  fundDays: number,
): { rate: number | null; source: 'manual' | 'calc' | 'profession' } {
  return ownRate(worker, fundDays) ?? { rate: professionRate(profession, fundDays), source: 'profession' }
}
