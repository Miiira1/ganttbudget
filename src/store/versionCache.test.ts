import { describe, expect, it } from 'vitest'
import { createVersionCache, VERSION_CACHE_SIZE } from './versionCache'

/** Verze projektu stačí jako libovolné objekty – cache je porovnává jen podle identity. */
const versions = (n: number) => Array.from({ length: n }, (_, i) => ({ version: i }))

describe('paměť výsledků jen pro poslední verze projektu (audit R2)', () => {
  it('výchozí velikost: 3 verze (aktuální, předchozí a náhled)', () => {
    expect(VERSION_CACHE_SIZE).toBe(3)
  })

  it('stejná verze se spočítá jen jednou', () => {
    const cache = createVersionCache<object, number>()
    const [a] = versions(1)
    let runs = 0
    const compute = () => ++runs
    expect(cache.get(a!, compute)).toBe(1)
    expect(cache.get(a!, compute)).toBe(1)
    expect(runs).toBe(1)
  })

  it('po 10 změnách drží jen poslední 3 verze, starší se případně spočítá znovu', () => {
    const cache = createVersionCache<object, string>()
    const all = versions(10)
    for (const v of all) cache.get(v, () => `výsledek ${(v as { version: number }).version}`)
    expect(cache.size()).toBe(3)
    expect(cache.has(all[9]!)).toBe(true)
    expect(cache.has(all[7]!)).toBe(true)
    expect(cache.has(all[6]!)).toBe(false)
    let recomputed = false
    cache.get(all[0]!, () => {
      recomputed = true
      return 'znovu'
    })
    expect(recomputed).toBe(true)
  })

  it('naposledy použitá verze se nevyhodí (střídání plánu a náhledu)', () => {
    const cache = createVersionCache<object, number>()
    const [a, b, c, d] = versions(4)
    cache.get(a!, () => 1)
    cache.get(b!, () => 2)
    cache.get(c!, () => 3)
    cache.get(a!, () => 99) // a se znovu použila → je nejnovější
    cache.get(d!, () => 4) // vyhodí se nejstarší použitá = b
    expect(cache.has(a!)).toBe(true)
    expect(cache.has(b!)).toBe(false)
    expect(cache.get(a!, () => 99)).toBe(1)
  })
})
