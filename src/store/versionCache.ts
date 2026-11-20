/**
 * Paměť spočítaných výsledků jen pro POSLEDNÍCH několik verzí projektu (audit R2).
 *
 * Dřív si aplikace pamatovala termíny, náklady, vytížení… pro KAŽDOU verzi projektu, kterou
 * kdy viděla. Verze v historii Zpět (až 100 kroků) tak držely v paměti i všechny výsledky –
 * u velkého projektu stovky MB. Teď se pamatují jen poslední 3 použité verze (aktuální,
 * předchozí a případný náhled); po Zpět se starší verze prostě spočítá znovu.
 */

/** Kolik verzí si pamatovat. */
export const VERSION_CACHE_SIZE = 3

export interface VersionCache<K extends object, V> {
  /** Výsledek pro danou verzi – z paměti, nebo ho `compute` spočítá a uloží. */
  get(version: K, compute: () => V): V
  /** Je výsledek pro verzi v paměti? (pro testy) */
  has(version: K): boolean
  /** Kolik verzí je v paměti. (pro testy) */
  size(): number
}

export function createVersionCache<K extends object, V>(limit = VERSION_CACHE_SIZE): VersionCache<K, V> {
  // Map drží pořadí vložení: první = nejdéle nepoužitá verze.
  const entries = new Map<K, V>()
  return {
    get(version, compute) {
      if (entries.has(version)) {
        const value = entries.get(version) as V
        entries.delete(version) // přesunout na konec = naposledy použitá
        entries.set(version, value)
        return value
      }
      const value = compute()
      entries.set(version, value)
      if (entries.size > limit) entries.delete(entries.keys().next().value as K)
      return value
    },
    has: (version) => entries.has(version),
    size: () => entries.size,
  }
}
