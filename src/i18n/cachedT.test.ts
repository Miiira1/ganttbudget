import type { TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import { cachedT, clearCachedT } from './cachedT'

describe('paměť hotových překladů pro tabulku (13c – výkon)', () => {
  it('stejný klíč, jazyk a hodnoty se přeloží jen jednou', () => {
    clearCachedT()
    const fn = vi.fn((key: string, options?: Record<string, unknown>) => `${key}:${JSON.stringify(options ?? {})}`)
    const t = fn as unknown as TFunction
    expect(cachedT(t, 'cs', 'table.fieldLabel', { field: 'Začátek', number: 5 })).toBe('table.fieldLabel:{"field":"Začátek","number":5}')
    cachedT(t, 'cs', 'table.fieldLabel', { field: 'Začátek', number: 5 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('jiný jazyk, jiné číslo nebo jiný text = nový překlad', () => {
    clearCachedT()
    const fn = vi.fn((key: string, options?: Record<string, unknown>) => `${key}${String(options?.number ?? '')}${String(options?.name ?? '')}`)
    const t = fn as unknown as TFunction
    cachedT(t, 'cs', 'a', { number: 1 })
    cachedT(t, 'en', 'a', { number: 1 })
    cachedT(t, 'cs', 'a', { number: 2 })
    cachedT(t, 'cs', 'a', { name: 'x' })
    cachedT(t, 'cs', 'a')
    expect(fn).toHaveBeenCalledTimes(5)
  })

  it('hodnoty se v klíči nespletou (oddělovače uvnitř textu)', () => {
    clearCachedT()
    const t = ((key: string, options?: Record<string, unknown>) => `${key}|${String(options?.a)}|${String(options?.b)}`) as unknown as TFunction
    expect(cachedT(t, 'cs', 'k', { a: 'x&b=y' })).not.toBe(cachedT(t, 'cs', 'k', { a: 'x', b: 'y' }))
  })
})
