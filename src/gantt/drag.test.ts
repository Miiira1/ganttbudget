import { describe, expect, it } from 'vitest'
import { createWorkCalendar, dayToIso, isoToDay } from '../engine/calendar'
import { createDefaultCalendar } from '../model/schema'
import { applyDrag, durationForFinish, pixelsToDays, type DragMode } from './drag'

// Výchozí kalendář: Po–Pá, české svátky (17. 11. 2026 je úterý a svátek).
const cal = createWorkCalendar(createDefaultCalendar())
const day = isoToDay

/** Tažení činnosti start–finish (s danou délkou) o `delta` dní; vrátí [omezení, délka, začátek, konec]. */
function drag(mode: DragMode, start: string, finish: string, durationDays: number, delta: number, kind: 'task' | 'milestone' = 'task') {
  const r = applyDrag(cal, { mode, kind, startDay: day(start), finishDay: day(finish), durationDays, deltaDays: delta })
  return [r.constraintStart ?? null, r.durationDays, dayToIso(r.startDay), dayToIso(r.finishDay)]
}

describe('pixely → dny', () => {
  it('zaokrouhlí na celé dny podle šířky dne', () => {
    expect(pixelsToDays(13, 12)).toBe(1)
    expect(pixelsToDays(5, 12)).toBe(0)
    expect(pixelsToDays(-7, 12)).toBe(-1)
    expect(pixelsToDays(60, 4)).toBe(15)
  })
})

describe('Konec zadaný v tabulce → délka', () => {
  it('pracovní dny od začátku do konce včetně', () => {
    expect(durationForFinish(cal, day('2026-11-16'), day('2026-11-20'))).toBe(4) // bez svátku 17. 11.
    expect(durationForFinish(cal, day('2026-11-16'), day('2026-11-16'))).toBe(1)
  })

  it('konec o víkendu nebo ve svátek se bere jako předchozí pracovní den', () => {
    expect(durationForFinish(cal, day('2026-11-16'), day('2026-11-22'))).toBe(4) // Ne → Pá 20.
    expect(durationForFinish(cal, day('2026-11-16'), day('2026-11-17'))).toBe(1) // svátek → Po 16.
  })

  it('konec před začátkem nejde (null)', () => {
    expect(durationForFinish(cal, day('2026-11-18'), day('2026-11-16'))).toBeNull()
    expect(durationForFinish(cal, day('2026-11-18'), day('2026-11-17'))).toBeNull() // svátek → Po 16. < začátek
  })
})

describe('posun celé úsečky', () => {
  // Činnost na 3 dny: Po 16., St 18., Čt 19. 11. (17. je svátek)
  it('o 3 dny: začne Čt 19., délka zůstane, nastaví se omezení', () => {
    expect(drag('move', '2026-11-16', '2026-11-19', 3, 3)).toEqual(['2026-11-19', 3, '2026-11-19', '2026-11-23'])
  })

  it('na víkend → přichytí se na pondělí', () => {
    expect(drag('move', '2026-11-16', '2026-11-19', 3, 5)).toEqual(['2026-11-23', 3, '2026-11-23', '2026-11-25'])
  })

  it('na svátek → přichytí se na další pracovní den', () => {
    expect(drag('move', '2026-11-16', '2026-11-19', 3, 1)).toEqual(['2026-11-18', 3, '2026-11-18', '2026-11-20'])
  })

  it('doleva', () => {
    expect(drag('move', '2026-11-18', '2026-11-20', 3, -2)).toEqual(['2026-11-16', 3, '2026-11-16', '2026-11-19'])
  })

  it('milník se jen posouvá (i když chytím „okraj“)', () => {
    expect(drag('end', '2026-11-18', '2026-11-18', 0, 2, 'milestone')).toEqual(['2026-11-20', 0, '2026-11-20', '2026-11-20'])
  })
})

describe('pravý okraj (konec, délka)', () => {
  it('o den delší, omezení se nemění', () => {
    expect(drag('end', '2026-11-16', '2026-11-19', 3, 1)).toEqual([null, 4, '2026-11-16', '2026-11-20'])
  })

  it('konec na víkend → přichytí se na pátek', () => {
    expect(drag('end', '2026-11-16', '2026-11-19', 3, 2)).toEqual([null, 4, '2026-11-16', '2026-11-20'])
  })

  it('kratší nejvýš na 1 den', () => {
    expect(drag('end', '2026-11-16', '2026-11-19', 3, -10)).toEqual([null, 1, '2026-11-16', '2026-11-16'])
  })
})

describe('levý okraj (začátek, konec zůstane)', () => {
  it('začátek na svátek → přichytí se na středu, délka se zkrátí', () => {
    expect(drag('start', '2026-11-16', '2026-11-19', 3, 1)).toEqual(['2026-11-18', 2, '2026-11-18', '2026-11-19'])
  })

  it('doleva přes víkend → přichytí se na pondělí, délka se prodlouží', () => {
    expect(drag('start', '2026-11-18', '2026-11-19', 2, -3)).toEqual(['2026-11-16', 3, '2026-11-16', '2026-11-19'])
  })

  it('nejvýš do konce (délka 1 den)', () => {
    expect(drag('start', '2026-11-16', '2026-11-19', 3, 10)).toEqual(['2026-11-19', 1, '2026-11-19', '2026-11-19'])
  })
})
