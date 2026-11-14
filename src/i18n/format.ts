/**
 * Formátování data a čísel podle jazyka (vestavěné Intl v prohlížeči, bez další knihovny).
 */
import { localeFor } from './languages'

/**
 * Den ve formátu "YYYY-MM-DD" → text podle jazyka (cs: "14. 11. 2026", en: "14/11/2026").
 * Počítá se v UTC, aby časové pásmo nikdy neposunulo datum o den.
 */
export function formatIsoDate(isoDate: string, languageCode: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) return isoDate
  const date = new Date(Date.UTC(y, m - 1, d))
  return new Intl.DateTimeFormat(localeFor(languageCode), {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(date)
}

/** Číslo podle jazyka (cs: "1 250,5", en: "1,250.5"). */
export function formatNumber(value: number, languageCode: string): string {
  return new Intl.NumberFormat(localeFor(languageCode)).format(value)
}
