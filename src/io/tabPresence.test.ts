import { describe, expect, it } from 'vitest'
import { watchOtherTabs, type TabChannel } from './tabPresence'

/** Napodobený BroadcastChannel: zpráva jedné „záložky“ dojde všem ostatním (ne odesílateli). */
function bus() {
  const members: FakeChannel[] = []
  class FakeChannel implements TabChannel {
    onmessage: ((event: { data: unknown }) => void) | null = null
    closed = false
    constructor() {
      members.push(this)
    }
    postMessage(data: unknown) {
      for (const m of members) if (m !== this && !m.closed) m.onmessage?.({ data })
    }
    close() {
      this.closed = true
    }
  }
  return () => new FakeChannel()
}

describe('aplikace ve více záložkách (audit B4)', () => {
  it('jediná záložka varování nedostane', () => {
    const channel = bus()
    let warnings = 0
    watchOtherTabs(channel(), () => warnings++)
    expect(warnings).toBe(0)
  })

  it('druhá záložka: varování dostanou obě, každá jen jednou', () => {
    const channel = bus()
    let first = 0
    let second = 0
    watchOtherTabs(channel(), () => first++)
    watchOtherTabs(channel(), () => second++)
    expect(first).toBe(1)
    expect(second).toBe(1)
    watchOtherTabs(channel(), () => {}) // třetí záložka
    expect(first).toBe(1) // dál už nic
  })

  it('zavřená záložka se už neozve', () => {
    const channel = bus()
    let warnings = 0
    const stop = watchOtherTabs(channel(), () => {})
    stop()
    watchOtherTabs(channel(), () => warnings++)
    expect(warnings).toBe(0)
  })

  it('prohlížeč bez BroadcastChannel: nic se neděje', () => {
    expect(() => watchOtherTabs(null, () => {})()).not.toThrow()
  })
})
