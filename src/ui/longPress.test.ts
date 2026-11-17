import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isTouchLike, LONG_PRESS_MS, LONG_PRESS_TOLERANCE, recentLongPress, watchLongPress } from './longPress'

describe('dlouhý stisk na dotykovém displeji (hromadný výběr bez Ctrl)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('prst, který se ½ s nehne, vyvolá dlouhý stisk', () => {
    const fire = vi.fn()
    watchLongPress(100, 100, fire)
    vi.advanceTimersByTime(LONG_PRESS_MS - 1)
    expect(fire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fire).toHaveBeenCalledOnce()
  })

  it('drobné chvění prstu nevadí, větší pohyb (tažení) dlouhý stisk zruší', () => {
    const shaky = vi.fn()
    const a = watchLongPress(100, 100, shaky)
    a.move(100 + LONG_PRESS_TOLERANCE, 100 - 3)
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(shaky).toHaveBeenCalledOnce()

    const dragged = vi.fn()
    const b = watchLongPress(100, 100, dragged)
    b.move(100 + LONG_PRESS_TOLERANCE + 1, 100)
    b.move(100, 100) // návrat zpět už nepomůže
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(dragged).not.toHaveBeenCalled()
  })

  it('zvednutí prstu před limitem dlouhý stisk zruší', () => {
    const fire = vi.fn()
    const w = watchLongPress(0, 0, fire)
    vi.advanceTimersByTime(200)
    w.cancel()
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(fire).not.toHaveBeenCalled()
  })

  it('těsně po dlouhém stisku se následné „kliknutí“ ignoruje (nezruší hromadný výběr)', () => {
    vi.setSystemTime(Date.now() + 100_000) // daleko od dlouhých stisků z předchozích testů
    watchLongPress(0, 0, () => {})
    expect(recentLongPress()).toBe(false)
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(recentLongPress()).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(recentLongPress()).toBe(false)
  })

  it('dlouhý stisk platí jen pro prst a pero, ne pro myš', () => {
    expect(isTouchLike({ pointerType: 'touch' })).toBe(true)
    expect(isTouchLike({ pointerType: 'pen' })).toBe(true)
    expect(isTouchLike({ pointerType: 'mouse' })).toBe(false)
  })
})
