/**
 * Pracovní kalendář projektu (K-01 až K-03).
 *
 * Uvnitř výpočtů pracujeme s „číslem dne“ (počet dní od 1. 1. 1970). S celými čísly se
 * snadno počítá a nehrozí posun o den kvůli časovým pásmům nebo letnímu času.
 * Ven (do dat projektu a na obrazovku) jdou vždy ISO dny "YYYY-MM-DD".
 *
 * Soubor nezávisí na uživatelském rozhraní – je to součást plánovacího jádra.
 * Fáze 13d: kromě českých svátků i sady pro Slovensko, Polsko, Německo (celostátní) a Rakousko.
 */
import type { Calendar } from '../model/schema'

const MS_PER_DAY = 86_400_000

/** ISO den "YYYY-MM-DD" → číslo dne. */
export function isoToDay(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY)
}

/** Číslo dne → ISO den "YYYY-MM-DD". */
export function dayToIso(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Den v týdnu podle ISO: 1 = pondělí … 7 = neděle. (1. 1. 1970 byl čtvrtek.) */
export function isoWeekday(day: number): number {
  return ((((day + 3) % 7) + 7) % 7) + 1
}

function yearOf(day: number): number {
  return new Date(day * MS_PER_DAY).getUTCFullYear()
}

/**
 * Velikonoční neděle pro daný rok (gregoriánský kalendář).
 * Tzv. anonymní gregoriánský algoritmus (Meeus/Jones/Butcher) – jen celočíselné dělení.
 */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const dayOfMonth = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
}

/** Klíče svátků – názvy jsou v překladových souborech (holiday.*). */
export type HolidayKey =
  | 'newYear'
  | 'goodFriday'
  | 'easterMonday'
  | 'labourDay'
  | 'liberationDay'
  | 'cyrilMethodius'
  | 'janHus'
  | 'statehoodDay'
  | 'independenceDay'
  | 'freedomDay'
  | 'christmasEve'
  | 'christmasDay'
  | 'stStephensDay'
  // Další země (fáze 13d)
  | 'newYearsDay'
  | 'epiphany'
  | 'easterSunday'
  | 'ascension'
  | 'pentecost'
  | 'whitMonday'
  | 'corpusChristi'
  | 'assumption'
  | 'allSaints'
  | 'immaculateConception'
  | 'skRepublicDay'
  | 'skNationalUprising'
  | 'skConstitutionDay'
  | 'ourLadyOfSorrows'
  | 'plConstitutionDay'
  | 'plIndependenceDay'
  | 'deUnityDay'
  | 'reformationDay'
  | 'atNationalDay'

export interface Holiday {
  date: string
  key: HolidayKey
}

/** Pevné svátky: [měsíc, den, klíč]. */
const FIXED_CZECH_HOLIDAYS: [number, number, HolidayKey][] = [
  [1, 1, 'newYear'],
  [5, 1, 'labourDay'],
  [5, 8, 'liberationDay'],
  [7, 5, 'cyrilMethodius'],
  [7, 6, 'janHus'],
  [9, 28, 'statehoodDay'],
  [10, 28, 'independenceDay'],
  [11, 17, 'freedomDay'],
  [12, 24, 'christmasEve'],
  [12, 25, 'christmasDay'],
  [12, 26, 'stStephensDay'],
]

/**
 * Dny pracovního klidu v ČR podle zákona č. 245/2000 Sb. (ověřeno 14. 11. 2026,
 * včetně novely 59/2026 Sb., která přidala jen významný den 30. 3. – ten není volný).
 * Velký pátek a Velikonoční pondělí se počítají od velikonoční neděle.
 */
export function czechHolidays(year: number): Holiday[] {
  const easter = isoToDay(easterSunday(year))
  const pad = (n: number) => String(n).padStart(2, '0')
  const holidays: Holiday[] = FIXED_CZECH_HOLIDAYS.map(([month, d, key]) => ({
    date: `${year}-${pad(month)}-${pad(d)}`,
    key,
  }))
  holidays.push({ date: dayToIso(easter - 2), key: 'goodFriday' })
  holidays.push({ date: dayToIso(easter + 1), key: 'easterMonday' })
  return holidays.sort((x, y) => x.date.localeCompare(y.date))
}

/** Země, jejichž státní svátky aplikace umí (fáze 13d). */
export const HOLIDAY_COUNTRIES = ['CZ', 'SK', 'PL', 'DE', 'AT'] as const
export type HolidayCountry = (typeof HOLIDAY_COUNTRIES)[number]

/** Pohyblivý svátek: počet dní od velikonoční neděle. */
type Movable = [offset: number, key: HolidayKey]
/** Pevný svátek: [měsíc, den, klíč, platí v roce?]. */
type Fixed = [month: number, day: number, key: HolidayKey, applies?: (year: number) => boolean]

const GOOD_FRIDAY: Movable = [-2, 'goodFriday']
const EASTER_SUNDAY: Movable = [0, 'easterSunday']
const EASTER_MONDAY: Movable = [1, 'easterMonday']
const ASCENSION: Movable = [39, 'ascension']
const PENTECOST: Movable = [49, 'pentecost']
const WHIT_MONDAY: Movable = [50, 'whitMonday']
const CORPUS_CHRISTI: Movable = [60, 'corpusChristi']

/**
 * Sady dnů pracovního klidu. Zdroje (ověřeno 17. 11. 2026):
 *  - SK: zákon č. 241/1993 Z. z. ve znění do 256/2026 Z. z. (Slov-Lex). 1. 9. není volno od 2024
 *    (530/2023), 17. 11. od 1. 11. 2025 (261/2025), 8. 5. a 15. 9. nejsou volno jen v roce 2026 (§ 4b),
 *    28. 10. je státní svátek, ale volno nikdy nebyl.
 *  - PL: ustawa o dniach wolnych od pracy (1951) – 6. 1. od 2011, 24. 12. od 2025 (novela z 6. 12. 2024).
 *  - DE: 9 celostátních svátků (ostatní jsou podle spolkových zemí); 31. 10. 2017 jednorázově celostátně.
 *  - AT: Arbeitsruhegesetz § 7 odst. 2 (13 svátků, Velký pátek od 2019 ne).
 */
const RULES: Record<Exclude<HolidayCountry, 'CZ'>, { fixed: Fixed[]; movable: Movable[] }> = {
  SK: {
    fixed: [
      [1, 1, 'skRepublicDay'],
      [1, 6, 'epiphany'],
      [5, 1, 'labourDay'],
      [5, 8, 'liberationDay', (y) => y !== 2026],
      [7, 5, 'cyrilMethodius'],
      [8, 29, 'skNationalUprising'],
      [9, 1, 'skConstitutionDay', (y) => y <= 2023],
      [9, 15, 'ourLadyOfSorrows', (y) => y !== 2026],
      [11, 1, 'allSaints'],
      [11, 17, 'freedomDay', (y) => y <= 2024],
      [12, 24, 'christmasEve'],
      [12, 25, 'christmasDay'],
      [12, 26, 'stStephensDay'],
    ],
    movable: [GOOD_FRIDAY, EASTER_MONDAY],
  },
  PL: {
    fixed: [
      [1, 1, 'newYearsDay'],
      [1, 6, 'epiphany', (y) => y >= 2011],
      [5, 1, 'labourDay'],
      [5, 3, 'plConstitutionDay'],
      [8, 15, 'assumption'],
      [11, 1, 'allSaints'],
      [11, 11, 'plIndependenceDay'],
      [12, 24, 'christmasEve', (y) => y >= 2025],
      [12, 25, 'christmasDay'],
      [12, 26, 'stStephensDay'],
    ],
    movable: [EASTER_SUNDAY, EASTER_MONDAY, PENTECOST, CORPUS_CHRISTI],
  },
  DE: {
    fixed: [
      [1, 1, 'newYearsDay'],
      [5, 1, 'labourDay'],
      [10, 3, 'deUnityDay', (y) => y >= 1990],
      [10, 31, 'reformationDay', (y) => y === 2017],
      [12, 25, 'christmasDay'],
      [12, 26, 'stStephensDay'],
    ],
    movable: [GOOD_FRIDAY, EASTER_MONDAY, ASCENSION, WHIT_MONDAY],
  },
  AT: {
    fixed: [
      [1, 1, 'newYearsDay'],
      [1, 6, 'epiphany'],
      [5, 1, 'labourDay'],
      [8, 15, 'assumption'],
      [10, 26, 'atNationalDay'],
      [11, 1, 'allSaints'],
      [12, 8, 'immaculateConception'],
      [12, 25, 'christmasDay'],
      [12, 26, 'stStephensDay'],
    ],
    movable: [EASTER_MONDAY, ASCENSION, WHIT_MONDAY, CORPUS_CHRISTI],
  },
}

/** Dny pracovního klidu dané země v daném roce (seřazené podle data). */
export function publicHolidays(country: HolidayCountry, year: number): Holiday[] {
  if (country === 'CZ') return czechHolidays(year)
  const rules = RULES[country]
  const easter = isoToDay(easterSunday(year))
  const pad = (n: number) => String(n).padStart(2, '0')
  const holidays: Holiday[] = rules.fixed
    .filter(([, , , applies]) => !applies || applies(year))
    .map(([month, d, key]) => ({ date: `${year}-${pad(month)}-${pad(d)}`, key }))
  for (const [offset, key] of rules.movable) holidays.push({ date: dayToIso(easter + offset), key })
  return holidays.sort((x, y) => x.date.localeCompare(y.date))
}

/** Volba v okně Kalendář a v průvodci: země, nebo „bez státních svátků“. */
export type HolidayChoice = HolidayCountry | 'none'

/** Nastavení kalendáře → volba (chybí země = Česko). */
export function holidayChoice(calendar: Pick<Calendar, 'useCzechHolidays' | 'holidayCountry'>): HolidayChoice {
  return calendar.useCzechHolidays ? (calendar.holidayCountry ?? 'CZ') : 'none'
}

/**
 * Volba → nastavení kalendáře. Česko se ukládá bez pole `holidayCountry` (soubory zůstanou jako dřív);
 * „bez svátků“ zemi nemění, takže se po opětovném zapnutí vrátí.
 */
export function holidaySettings(choice: HolidayChoice): { useCzechHolidays: boolean; holidayCountry?: HolidayCountry } {
  if (choice === 'none') return { useCzechHolidays: false }
  return { useCzechHolidays: true, holidayCountry: choice === 'CZ' ? undefined : choice }
}

/** Kalendář neobsahuje žádný pracovní den (např. jsou odškrtnuté všechny dny v týdnu). */
export class NoWorkingDaysError extends Error {
  constructor() {
    super('noWorkingDays')
    this.name = 'NoWorkingDaysError'
  }
}

/** Kolik dní nejvýš hledáme pracovní den, než to vzdáme (cca 10 let). */
const MAX_SEARCH_DAYS = 3700

/**
 * Proč je (nebo není) den pracovní – podle toho graf den obarví a ukáže název.
 * Přednost: vlastní odstávka > státní svátek > víkend.
 */
export type DayInfo =
  | { kind: 'working' }
  | { kind: 'weekend' }
  | { kind: 'holiday'; key: HolidayKey }
  | { kind: 'custom'; name: string }

export interface WorkCalendar {
  isWorkingDay(day: number): boolean
  /** Druh dne: pracovní, víkend, svátek (s klíčem názvu), nebo vlastní odstávka (s názvem). */
  describeDay(day: number): DayInfo
  /** Daný den, pokud je pracovní, jinak nejbližší další pracovní den. */
  nextWorkingDay(day: number): number
  /** Daný den, pokud je pracovní, jinak nejbližší předchozí pracovní den. */
  previousWorkingDay(day: number): number
  /**
   * Posun o `count` pracovních dnů (záporné číslo = zpět).
   * Pokud výchozí den není pracovní, nejdřív se posune na nejbližší další pracovní den.
   */
  addWorkingDays(day: number, count: number): number
  /** Počet pracovních dnů od `start` do `finish` včetně obou dnů (obrácený rozsah = 0). */
  countWorkingDays(start: number, finish: number): number
}

/** Připraví rychlý kalendář pro výpočty z nastavení projektu. */
export function createWorkCalendar(calendar: Calendar): WorkCalendar {
  const workingWeekdays = new Set(calendar.workingWeekdays)
  const removed = new Set(calendar.removedHolidays.map(isoToDay))
  const customRanges = calendar.customHolidays.map((r) => ({ start: isoToDay(r.start), end: isoToDay(r.end), name: r.name }))

  // Svátky počítáme pro každý rok jen jednou a pamatujeme si je (číslo dne → klíč názvu).
  const holidaysByYear = new Map<number, Map<number, HolidayKey>>()
  const country: HolidayCountry = calendar.holidayCountry ?? 'CZ'
  /** Klíč státního svátku, který se v tomto kalendáři počítá, jinak undefined. */
  function holidayKey(day: number): HolidayKey | undefined {
    if (!calendar.useCzechHolidays || removed.has(day)) return undefined
    const year = yearOf(day)
    let days = holidaysByYear.get(year)
    if (!days) {
      days = new Map(publicHolidays(country, year).map((h) => [isoToDay(h.date), h.key]))
      holidaysByYear.set(year, days)
    }
    return days.get(day)
  }

  function describeDay(day: number): DayInfo {
    const custom = customRanges.find((r) => day >= r.start && day <= r.end)
    if (custom) return { kind: 'custom', name: custom.name }
    const holiday = holidayKey(day)
    if (holiday) return { kind: 'holiday', key: holiday }
    if (!workingWeekdays.has(isoWeekday(day))) return { kind: 'weekend' }
    return { kind: 'working' }
  }

  function isWorkingDay(day: number): boolean {
    if (!workingWeekdays.has(isoWeekday(day))) return false
    if (holidayKey(day)) return false
    return !customRanges.some((r) => day >= r.start && day <= r.end)
  }

  function step(day: number, direction: 1 | -1): number {
    let current = day
    for (let i = 0; i <= MAX_SEARCH_DAYS; i++) {
      if (isWorkingDay(current)) return current
      current += direction
    }
    throw new NoWorkingDaysError()
  }

  return {
    isWorkingDay,
    describeDay,
    nextWorkingDay: (day) => step(day, 1),
    previousWorkingDay: (day) => step(day, -1),
    addWorkingDays(day, count) {
      let current = step(day, 1)
      const direction = count >= 0 ? 1 : -1
      for (let i = 0; i < Math.abs(count); i++) current = step(current + direction, direction)
      return current
    },
    countWorkingDays(start, finish) {
      let count = 0
      for (let day = start; day <= finish; day++) if (isWorkingDay(day)) count++
      return count
    },
  }
}
