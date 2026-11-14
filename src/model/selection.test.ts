import { describe, expect, it } from 'vitest'
import { rangeIds, toggleId } from './selection'

const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }))

describe('výběr více řádků', () => {
  it('Shift: rozsah mezi kotvou a kliknutým řádkem, v pořadí řádků (oběma směry)', () => {
    expect(rangeIds(rows, 'b', 'd')).toEqual(['b', 'c', 'd'])
    expect(rangeIds(rows, 'd', 'b')).toEqual(['b', 'c', 'd'])
    expect(rangeIds(rows, 'c', 'c')).toEqual(['c'])
  })

  it('Shift bez platné kotvy vybere jen kliknutý řádek', () => {
    expect(rangeIds(rows, null, 'c')).toEqual(['c'])
    expect(rangeIds(rows, 'x', 'c')).toEqual(['c'])
  })

  it('Ctrl: přidá nebo odebere řádek, ostatní zůstanou', () => {
    expect([...toggleId(new Set(['a']), 'c')]).toEqual(['a', 'c'])
    expect([...toggleId(new Set(['a', 'c']), 'a')]).toEqual(['c'])
  })
})
