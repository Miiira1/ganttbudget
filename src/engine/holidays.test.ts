import { describe, expect, it } from 'vitest'
import { createDefaultCalendar } from '../model/schema'
import { createWorkCalendar, holidayChoice, holidaySettings, isoToDay, publicHolidays, HOLIDAY_COUNTRIES, type HolidayCountry } from './calendar'

const dates = (country: HolidayCountry, year: number) => publicHolidays(country, year).map((h) => h.date)
const has = (country: HolidayCountry, iso: string) => dates(country, Number(iso.slice(0, 4))).includes(iso)

describe('státní svátky dalších zemí (fáze 13d)', () => {
  it('nabízené země: Česko, Slovensko, Polsko, Německo, Rakousko', () => {
    expect(HOLIDAY_COUNTRIES).toEqual(['CZ', 'SK', 'PL', 'DE', 'AT'])
  })

  it('Česko beze změny (zákon 245/2000 Sb.)', () => {
    expect(dates('CZ', 2026)).toHaveLength(13)
    expect(has('CZ', '2026-07-06')).toBe(true)
    expect(has('CZ', '2026-04-03')).toBe(true) // Velký pátek
  })

  it('Slovensko 2027 (zákon 241/1993 Z. z.): 13 volných dnů včetně Velikonoc, 8. 5. a 15. 9.', () => {
    expect(dates('SK', 2027)).toEqual([
      '2027-01-01', '2027-01-06', '2027-03-26', '2027-03-29', '2027-05-01', '2027-05-08', '2027-07-05',
      '2027-08-29', '2027-09-15', '2027-11-01', '2027-12-24', '2027-12-25', '2027-12-26',
    ])
  })

  it('Slovensko podle roku: 1. 9. volno jen do 2023, 17. 11. jen do 2024, 8. 5. a 15. 9. ne v roce 2026, 28. 10. nikdy', () => {
    expect(has('SK', '2023-09-01')).toBe(true)
    expect(has('SK', '2024-09-01')).toBe(false)
    expect(has('SK', '2024-11-17')).toBe(true)
    expect(has('SK', '2025-11-17')).toBe(false)
    expect(has('SK', '2025-05-08')).toBe(true)
    expect(has('SK', '2026-05-08')).toBe(false)
    expect(has('SK', '2026-09-15')).toBe(false)
    expect(has('SK', '2027-09-15')).toBe(true)
    expect(has('SK', '2026-10-28')).toBe(false)
  })

  it('Polsko 2026: 14 dnů včetně Velikonoční neděle, Letnic, Božího těla a Štědrého dne', () => {
    expect(dates('PL', 2026)).toEqual([
      '2026-01-01', '2026-01-06', '2026-04-05', '2026-04-06', '2026-05-01', '2026-05-03', '2026-05-24',
      '2026-06-04', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-24', '2026-12-25', '2026-12-26',
    ])
  })

  it('Polsko podle roku: Štědrý den volný od 2025, Tři králové od 2011', () => {
    expect(has('PL', '2024-12-24')).toBe(false)
    expect(has('PL', '2025-12-24')).toBe(true)
    expect(has('PL', '2010-01-06')).toBe(false)
    expect(has('PL', '2011-01-06')).toBe(true)
  })

  it('Německo 2026: 9 celostátních svátků (Nanebevstoupení, Svatodušní pondělí, Den německé jednoty)', () => {
    expect(dates('DE', 2026)).toEqual([
      '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25', '2026-10-03', '2026-12-25', '2026-12-26',
    ])
  })

  it('Německo: Den reformace celostátně jen v roce 2017', () => {
    expect(has('DE', '2017-10-31')).toBe(true)
    expect(has('DE', '2018-10-31')).toBe(false)
  })

  it('Rakousko 2026 (Arbeitsruhegesetz § 7): 13 dnů, bez Velkého pátku', () => {
    expect(dates('AT', 2026)).toEqual([
      '2026-01-01', '2026-01-06', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25', '2026-06-04',
      '2026-08-15', '2026-10-26', '2026-11-01', '2026-12-08', '2026-12-25', '2026-12-26',
    ])
    expect(has('AT', '2026-04-03')).toBe(false)
  })

  it('pohyblivé svátky v jiném roce (Velikonoce 2028 = 16. 4.)', () => {
    expect(has('DE', '2028-05-25')).toBe(true) // Nanebevstoupení = Velikonoce + 39
    expect(has('AT', '2028-06-05')).toBe(true) // Svatodušní pondělí = + 50
    expect(has('PL', '2028-06-15')).toBe(true) // Boží tělo = + 60
  })

  it('každý svátek má klíč názvu a datum je v daném roce, bez opakování', () => {
    for (const country of HOLIDAY_COUNTRIES) {
      for (const year of [2017, 2024, 2025, 2026, 2030]) {
        const list = publicHolidays(country, year)
        expect(list.every((h) => h.key.length > 0 && h.date.startsWith(String(year)))).toBe(true)
        expect(new Set(list.map((h) => h.date)).size).toBe(list.length)
      }
    }
  })

  it('pracovní kalendář podle země; chybí-li země, počítá se Česko', () => {
    const sk = createWorkCalendar({ ...createDefaultCalendar(), holidayCountry: 'SK' })
    expect(sk.isWorkingDay(isoToDay('2026-09-15'))).toBe(true) // v roce 2026 není volno
    expect(sk.isWorkingDay(isoToDay('2027-09-15'))).toBe(false)
    expect(sk.describeDay(isoToDay('2027-09-15'))).toEqual({ kind: 'holiday', key: 'ourLadyOfSorrows' })
    const cz = createWorkCalendar(createDefaultCalendar())
    expect(cz.isWorkingDay(isoToDay('2026-07-06'))).toBe(false) // Jan Hus
    expect(sk.isWorkingDay(isoToDay('2026-07-06'))).toBe(true)
    const none = createWorkCalendar({ ...createDefaultCalendar(), holidayCountry: 'AT', useCzechHolidays: false })
    expect(none.isWorkingDay(isoToDay('2026-10-26'))).toBe(true) // „bez svátků“ platí pro každou zemi
  })
})

describe('volba státních svátků v okně Kalendář a v průvodci', () => {
  it('nastavení kalendáře → volba (chybí země = Česko, vypnuto = bez svátků)', () => {
    expect(holidayChoice({ useCzechHolidays: true })).toBe('CZ')
    expect(holidayChoice({ useCzechHolidays: true, holidayCountry: 'PL' })).toBe('PL')
    expect(holidayChoice({ useCzechHolidays: false, holidayCountry: 'PL' })).toBe('none')
  })

  it('volba → nastavení kalendáře (Česko bez pole – soubory zůstanou jako dřív)', () => {
    expect(holidaySettings('CZ')).toEqual({ useCzechHolidays: true, holidayCountry: undefined })
    expect(holidaySettings('AT')).toEqual({ useCzechHolidays: true, holidayCountry: 'AT' })
    expect(holidaySettings('none')).toEqual({ useCzechHolidays: false })
  })
})
