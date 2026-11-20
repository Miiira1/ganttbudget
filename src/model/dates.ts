/**
 * Práce s daty. Termíny se ukládají jako text "YYYY-MM-DD" (ISO den) – bez času a časového pásma.
 */

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Je text platný den "YYYY-MM-DD" (včetně kontroly, že den v měsíci existuje)? */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false
  // Bez objektu Date (volá se při každém otevření souboru u každého data – audit R11).
  const y = Number(value.slice(0, 4))
  const m = Number(value.slice(5, 7))
  const d = Number(value.slice(8, 10))
  if (m < 1 || m > 12 || d < 1) return false
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const daysInMonth = m === 2 ? (leap ? 29 : 28) : m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31
  return d <= daysInMonth
}

/** Dnešní den v místním čase jako "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Nejbližší pondělí po daném dni (výchozí začátek projektu ze šablony; z pondělí na další pondělí). */
export function nextMonday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  const weekday = date.getUTCDay() // 0 = neděle, 1 = pondělí
  date.setUTCDate(date.getUTCDate() + (((8 - weekday) % 7) || 7))
  return date.toISOString().slice(0, 10)
}
