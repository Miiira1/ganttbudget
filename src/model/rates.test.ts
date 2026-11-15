import { describe, expect, it } from 'vitest'
import { createDefaultCalendar } from './schema'
import { calculateRate, createDefaultRateCalc, effectiveWorkerRate, professionRate, workingDaysInYear, type RateCalc } from './rates'

const calc = (patch: Partial<RateCalc> = {}): RateCalc => ({
  ...createDefaultRateCalc(),
  monthlyWage: 5_000_000, // 50 000 Kč
  overheadMode: 'percent',
  overheadValue: 10,
  ...patch,
})

describe('fond pracovních dnů v roce (podle kalendáře projektu)', () => {
  it('2027: 261 dnů Po–Pá − 9 svátků ve všední den = 252', () => {
    // Svátky 2027 ve všední den: 1. 1., 26. 3. (Velký pátek), 29. 3., 5. 7., 6. 7., 28. 9., 28. 10., 17. 11., 24. 12.
    // (1. 5., 8. 5., 25. 12., 26. 12. připadají na víkend.)
    expect(workingDaysInYear(createDefaultCalendar(), 2027)).toBe(252)
  })

  it('odstávka a vypnuté svátky se projeví', () => {
    const calendar = { ...createDefaultCalendar(), customHolidays: [{ start: '2027-07-19', end: '2027-07-30', name: 'Odstávka' }] }
    expect(workingDaysInYear(calendar, 2027)).toBe(242) // 10 pracovních dnů odstávky
    expect(workingDaysInYear({ ...createDefaultCalendar(), useCzechHolidays: false }, 2027)).toBe(261)
  })
})

describe('kalkulace hodinové sazby (Z-04)', () => {
  it('ruční výpočet krok po kroku (peníze v haléřích)', () => {
    const r = calculateRate(calc(), 252)
    if (!r.ok) throw new Error(r.error)
    expect(r).toMatchObject({
      annualWage: 60_000_000, // 50 000 × 12
      contributions: 20_280_000, // 33,8 %
      overhead: 6_000_000, // 10 % z mzdy
      annualCost: 86_280_000, // 862 800 Kč
      fundDays: 252,
      availableDays: 222, // 252 − 25 dovolená − 5 nemoc
      productiveHours: 1509.6, // 222 × 8 h × 85 %
      rate: 57_154, // 862 800 / 1 509,6 = 571,5421… Kč/h → 571,54 Kč
    })
  })

  it('režie jako pevná částka za rok', () => {
    const r = calculateRate(calc({ overheadMode: 'annual', overheadValue: 12_000_000 }), 252)
    expect(r.ok && r.overhead).toBe(12_000_000)
    expect(r.ok && r.annualCost).toBe(92_280_000)
  })

  it('žádné produktivní hodiny → chyba, ne dělení nulou', () => {
    expect(calculateRate(calc({ vacationDays: 200, sickDays: 52 }), 252)).toEqual({ ok: false, error: 'noProductiveHours' })
    expect(calculateRate(calc({ productivityPct: 0 }), 252)).toEqual({ ok: false, error: 'noProductiveHours' })
  })
})

describe('která sazba platí', () => {
  const profession = { manualRate: undefined, rateCalc: calc() }

  it('profese: ruční sazba > kalkulace > žádná', () => {
    expect(professionRate({ manualRate: 45_000, rateCalc: calc() }, 252)).toBe(45_000)
    expect(professionRate(profession, 252)).toBe(57_154)
    expect(professionRate({}, 252)).toBeNull()
  })

  it('pracovník: ruční > vlastní kalkulace > sazba profese', () => {
    expect(effectiveWorkerRate({ manualRate: 60_000 }, profession, 252)).toEqual({ rate: 60_000, source: 'manual' })
    expect(effectiveWorkerRate({ rateCalc: calc({ monthlyWage: 4_000_000 }) }, profession, 252)).toMatchObject({ source: 'calc' })
    expect(effectiveWorkerRate({}, profession, 252)).toEqual({ rate: 57_154, source: 'profession' })
    expect(effectiveWorkerRate({}, {}, 252)).toEqual({ rate: null, source: 'profession' })
  })
})
