import { describe, expect, it } from 'vitest'
import type { Bar } from './geometry'
import { linkTarget } from './link'

const bar: Bar = { kind: 'task', xStart: 100, xEnd: 200, centerY: 48 }
const milestone: Bar = { kind: 'milestone', xStart: 293, xEnd: 307, centerY: 80 }

describe('kreslení vazby: kam míří a jaký typ vznikne', () => {
  it('levá polovina cíle = do začátku, pravá = do konce', () => {
    expect(linkTarget('end', bar, 120).anchor).toBe('start')
    expect(linkTarget('end', bar, 149).anchor).toBe('start')
    expect(linkTarget('end', bar, 150).anchor).toBe('end')
    expect(linkTarget('end', bar, 199).anchor).toBe('end')
  })

  it('typ podle toho, odkud a kam', () => {
    expect(linkTarget('end', bar, 110).type).toBe('FS') // konec → začátek
    expect(linkTarget('start', bar, 110).type).toBe('SS') // začátek → začátek
    expect(linkTarget('end', bar, 190).type).toBe('FF') // konec → konec
    expect(linkTarget('start', bar, 190).type).toBe('SF') // začátek → konec
  })

  it('u milníku rozhoduje strana od jeho středu', () => {
    expect(linkTarget('end', milestone, 299)).toEqual({ anchor: 'start', type: 'FS' })
    expect(linkTarget('end', milestone, 301)).toEqual({ anchor: 'end', type: 'FF' })
  })
})
