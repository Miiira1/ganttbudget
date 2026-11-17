/**
 * Paměť hotových překladů (fáze 13c – výkon).
 *
 * Tabulka s 300 řádky volá při každém překreslení tisíce překladů (popisky polí „Začátek – řádek 5“,
 * bubliny…). Samotné i18next `t()` s doplněním hodnot stojí desítky mikrosekund, dohromady to
 * dělalo kolem 50 ms. Texty se přitom nemění, dokud se nezmění jazyk nebo hodnoty – proto si
 * hotový text pamatujeme podle (jazyk, klíč, hodnoty). Překladové soubory jsou pevné, paměť
 * tedy nikdy nevrátí zastaralý text; při přeplnění se vyprázdní.
 */
import type { TFunction } from 'i18next'

const MAX_ENTRIES = 50_000
const cache = new Map<string, string>()

export function cachedT(t: TFunction, language: string, key: string, options?: Record<string, string | number>): string {
  // JSON drží hodnoty od sebe spolehlivě oddělené (i když text obsahuje & nebo =).
  const id = options === undefined ? `${language}\u0000${key}` : `${language}\u0000${key}\u0000${JSON.stringify(options)}`
  let text = cache.get(id)
  if (text === undefined) {
    if (cache.size >= MAX_ENTRIES) cache.clear()
    text = t(key, options ?? {})
    cache.set(id, text)
  }
  return text
}

/** Vyprázdnit paměť (testy). */
export function clearCachedT(): void {
  cache.clear()
}
