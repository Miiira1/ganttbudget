import { describe, expect, it } from 'vitest'
import cs from './locales/cs.json'

/** Všechny texty překladů jako [klíč, text]. */
function texts(o: unknown, prefix = ''): [string, string][] {
  if (typeof o === 'string') return [[prefix, o]]
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => texts(v, prefix ? `${prefix}.${k}` : k))
  return []
}

describe('česká typografie (audit U20)', () => {
  it('jednopísmenná předložka / spojka (k, s, v, z, o, u, a, i) nezůstane na konci řádku', () => {
    // Za takovým slovem musí být nezlomitelná mezera (U+00A0), ne obyčejná.
    const bad = texts(cs).filter(([, text]) => /(^|[\s(„"–/])[ksvzouaiKSVZOUAI] (?=\S)/.test(text))
    expect(bad.map(([key]) => key)).toEqual([])
  })
})
