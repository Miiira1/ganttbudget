import { describe, expect, it } from 'vitest'
import { moveTab, parseTabOrder } from './tabOrder'

const ALL = ['a', 'b', 'c', 'd'] as const

describe('pořadí záložek', () => {
  it('uložené pořadí se načte; neznámé a dvojité se zahodí, chybějící přidají na konec', () => {
    expect(parseTabOrder('["c","a","b","d"]', ALL)).toEqual(['c', 'a', 'b', 'd'])
    expect(parseTabOrder('["c","x","c","a"]', ALL)).toEqual(['c', 'a', 'b', 'd'])
    expect(parseTabOrder(null, ALL)).toEqual(['a', 'b', 'c', 'd'])
    expect(parseTabOrder('nesmysl', ALL)).toEqual(['a', 'b', 'c', 'd'])
    expect(parseTabOrder('{"a":1}', ALL)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('přesun záložky na jiné místo (index v novém pořadí); mimo rozsah se přichytí na kraj', () => {
    expect(moveTab(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveTab(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveTab(['a', 'b', 'c', 'd'], 'b', 9)).toEqual(['a', 'c', 'd', 'b'])
    expect(moveTab(['a', 'b', 'c', 'd'], 'b', -1)).toEqual(['b', 'a', 'c', 'd'])
    expect(moveTab(['a', 'b'], 'x', 0)).toEqual(['a', 'b'])
  })
})
