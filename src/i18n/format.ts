/**
 * Formátování data a čísel podle jazyka (vestavěné Intl v prohlížeči, bez další knihovny).
 *
 * Vytvořit formátovač (Intl.DateTimeFormat) je drahé – stojí víc než samotné formátování.
 * Graf a tabulka formátují tisíce dat najednou, proto si hotové formátovače pamatujeme
 * (jeden pro každý jazyk a styl).
 */
import { localeFor } from './languages'

const dateFormatters = new Map<string, Intl.DateTimeFormat>()

function dateFormatter(languageCode: string, style: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${languageCode}|${style}`
  let formatter = dateFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(localeFor(languageCode), { timeZone: 'UTC', ...options })
    dateFormatters.set(key, formatter)
  }
  return formatter
}

/**
 * Den ve formátu "YYYY-MM-DD" → text podle jazyka (cs: "14. 11. 2026", en: "14/11/2026").
 * Počítá se v UTC, aby časové pásmo nikdy neposunulo datum o den.
 */
export function formatIsoDate(isoDate: string, languageCode: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) return isoDate
  return dateFormatter(languageCode, 'date', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}

/**
 * Název měsíce podle jazyka pro hlavičku grafu.
 *  - "withYear": "listopad 2026" / "November 2026"
 *  - "long":     "listopad" / "November"
 *  - "short":    "lis" / "Nov"
 */
export function formatMonth(year: number, month: number, languageCode: string, style: 'withYear' | 'long' | 'short'): string {
  return dateFormatter(languageCode, `month-${style}`, {
    month: style === 'short' ? 'short' : 'long',
    year: style === 'withYear' ? 'numeric' : undefined,
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

/** Okamžik (ISO čas) → datum a čas v místním čase podle jazyka (cs: "14. 11. 2026 22:30"). */
export function formatDateTime(isoTime: string, languageCode: string): string {
  let formatter = dateTimeFormatters.get(languageCode)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(localeFor(languageCode), {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    dateTimeFormatters.set(languageCode, formatter)
  }
  const date = new Date(isoTime)
  return Number.isNaN(date.getTime()) ? isoTime : formatter.format(date)
}

/** Číslo podle jazyka (cs: "1 250,5", en: "1,250.5"). */
export function formatNumber(value: number, languageCode: string): string {
  return new Intl.NumberFormat(localeFor(languageCode)).format(value)
}
