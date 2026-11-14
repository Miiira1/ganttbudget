import { describe, expect, it } from 'vitest'
import {
  createWorkCalendar,
  czechHolidays,
  dayToIso,
  easterSunday,
  isoToDay,
  isoWeekday,
  NoWorkingDaysError,
} from './calendar'
import { createDefaultCalendar, type Calendar } from '../model/schema'

const day = isoToDay
const iso = dayToIso

function calendar(patch: Partial<Calendar> = {}) {
  return createWorkCalendar({ ...createDefaultCalendar(), ...patch })
}

describe('převod dat', () => {
  it('ISO den ↔ číslo dne tam i zpět', () => {
    for (const d of ['1970-01-01', '2026-11-14', '2028-02-29', '2099-12-31']) {
      expect(iso(day(d))).toBe(d)
    }
    expect(day('2026-11-15') - day('2026-11-14')).toBe(1)
  })

  it('den v týdnu: 1 = pondělí … 7 = neděle', () => {
    expect(isoWeekday(day('2026-11-16'))).toBe(1) // pondělí
    expect(isoWeekday(day('2026-11-14'))).toBe(6) // sobota
    expect(isoWeekday(day('2026-11-15'))).toBe(7) // neděle
    expect(isoWeekday(day('1970-01-01'))).toBe(4) // čtvrtek
  })
})

describe('Velikonoce', () => {
  it.each([
    [2019, '2019-04-21'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
    [2285, '2285-03-22'], // nejdřívější možné datum
  ])('velikonoční neděle %i = %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected)
  })
})

describe('české svátky', () => {
  it('rok 2026 má 13 svátků včetně pohyblivých', () => {
    const dates = czechHolidays(2026).map((h) => h.date)
    expect(dates).toEqual([
      '2026-01-01',
      '2026-04-03', // Velký pátek
      '2026-04-06', // Velikonoční pondělí
      '2026-05-01',
      '2026-05-08',
      '2026-07-05',
      '2026-07-06',
      '2026-09-28',
      '2026-10-28',
      '2026-11-17',
      '2026-12-24',
      '2026-12-25',
      '2026-12-26',
    ])
  })

  it('každý svátek má klíč pro překlad názvu', () => {
    expect(czechHolidays(2027).every((h) => h.key.length > 0)).toBe(true)
    expect(new Set(czechHolidays(2027).map((h) => h.key)).size).toBe(13)
  })
})

describe('pracovní dny', () => {
  it('víkend a svátek nejsou pracovní dny', () => {
    const cal = calendar()
    expect(cal.isWorkingDay(day('2026-11-16'))).toBe(true) // pondělí
    expect(cal.isWorkingDay(day('2026-11-14'))).toBe(false) // sobota
    expect(cal.isWorkingDay(day('2026-11-17'))).toBe(false) // úterý, svátek
    expect(cal.isWorkingDay(day('2026-04-03'))).toBe(false) // Velký pátek
  })

  it('svátky lze vypnout nebo jednotlivě nepočítat', () => {
    expect(calendar({ useCzechHolidays: false }).isWorkingDay(day('2026-11-17'))).toBe(true)
    const cal = calendar({ removedHolidays: ['2026-11-17'] })
    expect(cal.isWorkingDay(day('2026-11-17'))).toBe(true)
    expect(cal.isWorkingDay(day('2026-10-28'))).toBe(false)
  })

  it('vlastní odstávka (rozsah dnů) je volno', () => {
    const cal = calendar({ customHolidays: [{ start: '2026-12-21', end: '2026-12-31', name: 'Odstávka' }] })
    expect(cal.isWorkingDay(day('2026-12-18'))).toBe(true)
    expect(cal.isWorkingDay(day('2026-12-21'))).toBe(false)
    expect(cal.isWorkingDay(day('2026-12-29'))).toBe(false)
    expect(cal.isWorkingDay(day('2027-01-04'))).toBe(true)
  })

  it('jiné pracovní dny v týdnu (např. Po–So)', () => {
    const cal = calendar({ workingWeekdays: [1, 2, 3, 4, 5, 6] })
    expect(cal.isWorkingDay(day('2026-11-14'))).toBe(true) // sobota
    expect(cal.isWorkingDay(day('2026-11-15'))).toBe(false) // neděle
  })

  it('nejbližší pracovní den dopředu i dozadu', () => {
    const cal = calendar()
    expect(iso(cal.nextWorkingDay(day('2026-11-14')))).toBe('2026-11-16') // So → Po
    expect(iso(cal.nextWorkingDay(day('2026-11-16')))).toBe('2026-11-16') // Po zůstane
    expect(iso(cal.previousWorkingDay(day('2026-11-15')))).toBe('2026-11-13') // Ne → Pá
  })

  it('přičítání pracovních dnů přes víkend a svátky', () => {
    const cal = calendar()
    expect(iso(cal.addWorkingDays(day('2026-11-12'), 1))).toBe('2026-11-13') // Čt + 1 = Pá
    expect(iso(cal.addWorkingDays(day('2026-11-13'), 1))).toBe('2026-11-16') // Pá + 1 = Po
    expect(iso(cal.addWorkingDays(day('2026-11-16'), 1))).toBe('2026-11-18') // Po + 1 = St (17. 11. svátek)
    expect(iso(cal.addWorkingDays(day('2026-12-23'), 1))).toBe('2026-12-28') // přes Vánoce
    expect(iso(cal.addWorkingDays(day('2026-11-18'), -2))).toBe('2026-11-13') // zpět přes svátek a víkend
    expect(iso(cal.addWorkingDays(day('2026-11-16'), 0))).toBe('2026-11-16')
    expect(iso(cal.addWorkingDays(day('2026-11-14'), 0))).toBe('2026-11-16') // začátek o víkendu se posune
  })

  it('přes konec roku použije svátky obou let', () => {
    const cal = calendar()
    expect(iso(cal.addWorkingDays(day('2026-12-31'), 1))).toBe('2027-01-04') // 1. 1. svátek, pak víkend
  })

  it('kalendář bez pracovních dnů ohlásí chybu (nezacyklí se)', () => {
    const cal = calendar({ workingWeekdays: [], useCzechHolidays: false })
    expect(() => cal.nextWorkingDay(day('2026-11-16'))).toThrow(NoWorkingDaysError)
  })
})
