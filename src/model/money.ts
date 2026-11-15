/**
 * Peníze (pravidlo projektu): vždy CELÁ ČÍSLA v nejmenší jednotce měny (haléře, centy), nikdy float.
 * Tento soubor převádí haléře na text podle jazyka a zadaný text zpět na haléře.
 * Testy: money.test.ts.
 */
import { localeFor } from '../i18n/languages'

/** Nejvyšší povolená částka: 10 miliard (v haléřích 10^12) – daleko pod hranicí přesných celých čísel. */
export const MAX_MONEY = 1_000_000_000_000

const formatters = new Map<string, Intl.NumberFormat>()

/** Haléře → „1 234,50 Kč“ (podle jazyka a měny projektu). */
export function formatMoney(minorUnits: number, currency: string, languageCode: string): string {
  const key = `${currency}|${languageCode}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(localeFor(languageCode), {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    formatters.set(key, formatter)
  }
  // Dělení stem až při zobrazení – výsledek se nikam neukládá.
  return formatter.format(minorUnits / 100)
}

const amountFormatters = new Map<string, Intl.NumberFormat>()

/** Haléře → „1 234,50“ bez značky měny (pro pole, do kterého se částka píše). */
export function formatAmount(minorUnits: number, languageCode: string): string {
  let formatter = amountFormatters.get(languageCode)
  if (!formatter) {
    formatter = new Intl.NumberFormat(localeFor(languageCode), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    amountFormatters.set(languageCode, formatter)
  }
  return formatter.format(minorUnits / 100)
}

/**
 * Zadaný text → haléře, nebo null (nesmysl, záporné číslo, víc než 2 desetinná místa).
 * Přijme „1 234,50 Kč“, „1234.5“, „1.234,50“, „1,234.50“. Oddělovač s přesně třemi číslicemi
 * za sebou (a jediný svého druhu na konci) se bere jako oddělovač tisíců: „1,234“ = 1 234.
 * Převod jde přes text, ne přes float – žádné chyby zaokrouhlení.
 */
export function parseMoney(text: string): number | null {
  // Pryč mezery (i nezlomitelné) a značky měny / písmena na začátku a na konci.
  const cleaned = text.replace(/[\s  ]/g, '').replace(/^[^\d]+|[^\d]+$/g, (m) => (/[-]/.test(m) ? '-' : ''))
  if (!/^\d[\d.,]*$/.test(cleaned)) return null

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let integer = cleaned
  let fraction = ''
  if (lastComma >= 0 || lastDot >= 0) {
    const decimalIndex = Math.max(lastComma, lastDot)
    const decimalChar = cleaned[decimalIndex] as string
    const otherChar = decimalChar === ',' ? '.' : ','
    const after = cleaned.slice(decimalIndex + 1)
    const sameCount = cleaned.split(decimalChar).length - 1
    // „0,125“ nejsou tisíce (skupina tisíců nezačíná nulou) – a tři desetinná místa nejdou.
    const isThousands =
      after.length === 3 && !/^0[.,]/.test(cleaned) && (sameCount > 1 || !cleaned.includes(otherChar))
    if (isThousands) {
      // Všechny oddělovače jsou tisíce: „1,234“, „1.234.567“.
      if (cleaned.includes(otherChar)) return null
      integer = cleaned
    } else {
      if (sameCount > 1) return null // „1,2,3“ – desetinný oddělovač smí být jen jednou
      integer = cleaned.slice(0, decimalIndex)
      fraction = after
    }
    // Skupiny tisíců musí mít přesně 3 číslice: „12,345.6.7“ ani „1,234,5“ neprojde.
    const groups = integer.split(/[.,]/)
    if (groups.length > 1 && (groups.slice(1).some((g) => g.length !== 3) || (groups[0] ?? '').length === 0)) return null
    integer = groups.join('')
  }
  if (!/^\d+$/.test(integer) || !/^\d{0,2}$/.test(fraction)) return null
  const value = Number(integer) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(value) && value <= MAX_MONEY ? value : null
}
