import { describe, expect, it } from 'vitest'
import { createWorkCalendar, dayToIso, isoToDay } from '../engine/calendar'
import { createDefaultCalendar } from '../model/schema'
import { createTimeline, dayToX, headerRows, isoWeek, nonWorkingRuns, xToDay } from './timeline'

const day = isoToDay
const iso = dayToIso

// Vzorový rozsah: projekt od pondělí 16. 11. 2026 do středy 31. 3. 2027.
const START = '2026-11-16'
const FINISH = '2027-03-31'

describe('rozsah časové osy', () => {
  it('Týdny: od pondělí týden před začátkem do neděle po konci + měsíc rezerva', () => {
    const tl = createTimeline({ zoom: 'week', projectStart: START, projectFinish: FINISH })
    expect(iso(tl.startDay)).toBe('2026-11-09') // 16. 11. − 7 dní, pondělí
    // 31. 3. + 30 dní = pátek 30. 4. → dorovnáno do neděle 2. 5.; endDay je první den ZA osou
    expect(iso(tl.endDay)).toBe('2027-05-03')
    expect(tl.dayWidth).toBe(12)
    expect(tl.width).toBe((tl.endDay - tl.startDay) * 12)
  })

  it('Dny: zarovnání stejně jako Týdny, širší den', () => {
    const tl = createTimeline({ zoom: 'day', projectStart: START, projectFinish: FINISH })
    expect(iso(tl.startDay)).toBe('2026-11-09')
    expect(iso(tl.endDay)).toBe('2027-05-03')
    expect(tl.dayWidth).toBe(28)
  })

  it('Měsíce: od 1. dne měsíce do konce měsíce', () => {
    const tl = createTimeline({ zoom: 'month', projectStart: START, projectFinish: FINISH })
    expect(iso(tl.startDay)).toBe('2026-11-01')
    expect(iso(tl.endDay)).toBe('2027-05-01')
  })

  it('Čtvrtletí: od začátku do konce čtvrtletí', () => {
    const tl = createTimeline({ zoom: 'quarter', projectStart: START, projectFinish: FINISH })
    expect(iso(tl.startDay)).toBe('2026-10-01')
    expect(iso(tl.endDay)).toBe('2027-07-01')
  })

  it('bez spočítaného konce se osa ukáže aspoň od začátku projektu', () => {
    const tl = createTimeline({ zoom: 'week', projectStart: START, projectFinish: null })
    expect(iso(tl.startDay)).toBe('2026-11-09')
    expect(iso(tl.endDay)).toBe('2026-12-21') // 16. 11. + 30 = 16. 12. (St) → neděle 20. 12.
  })

  it('den ↔ x tam i zpět', () => {
    const tl = createTimeline({ zoom: 'week', projectStart: START, projectFinish: FINISH })
    expect(dayToX(tl, day('2026-11-09'))).toBe(0)
    expect(dayToX(tl, day('2026-11-16'))).toBe(84)
    expect(xToDay(tl, 84)).toBe(day('2026-11-16'))
    expect(xToDay(tl, 95.9)).toBe(day('2026-11-16')) // kdekoli uvnitř dne
    expect(xToDay(tl, 96)).toBe(day('2026-11-17'))
  })
})

describe('číslo týdne podle ISO', () => {
  it.each([
    ['2026-11-16', 2026, 47],
    ['2026-01-01', 2026, 1], // čtvrtek → týden 1
    ['2027-01-01', 2026, 53], // pátek → ještě 53. týden roku 2026
    ['2027-01-04', 2027, 1],
    ['2024-12-30', 2025, 1], // pondělí → už 1. týden roku 2025
  ])('%s je týden %i/%i', (date, year, week) => {
    expect(isoWeek(day(date))).toEqual({ year, week })
  })
})

describe('hlavička osy', () => {
  it('Týdny: nahoře měsíce (oříznuté okrajem osy), dole celé týdny', () => {
    const tl = createTimeline({ zoom: 'week', projectStart: START, projectFinish: FINISH })
    const [top, bottom] = headerRows(tl)
    expect(top[0]).toMatchObject({ unit: 'month', value: 11, year: 2026, x: 0, width: 22 * 12 })
    expect(top[1]).toMatchObject({ unit: 'month', value: 12, year: 2026, x: 22 * 12, width: 31 * 12 })
    expect(top.at(-1)).toMatchObject({ unit: 'month', value: 5, year: 2027, width: 2 * 12 })
    expect(bottom[0]).toMatchObject({ unit: 'week', value: 46, year: 2026, x: 0, width: 84 })
    expect(bottom.every((s) => s.width === 84)).toBe(true)
    expect(bottom.find((s) => s.startDay === day('2026-12-28'))).toMatchObject({ value: 53, year: 2026 })
  })

  it('Dny: nahoře měsíce, dole jednotlivé dny', () => {
    const tl = createTimeline({ zoom: 'day', projectStart: START, projectFinish: FINISH })
    const [top, bottom] = headerRows(tl)
    expect(top[0]).toMatchObject({ unit: 'month', value: 11 })
    expect(bottom).toHaveLength(tl.endDay - tl.startDay)
    expect(bottom[0]).toMatchObject({ unit: 'day', value: 9, x: 0, width: 28 })
  })

  it('Měsíce: nahoře roky, dole měsíce', () => {
    const tl = createTimeline({ zoom: 'month', projectStart: START, projectFinish: FINISH })
    const [top, bottom] = headerRows(tl)
    expect(top.map((s) => [s.value, s.width])).toEqual([
      [2026, 61 * 4],
      [2027, 120 * 4],
    ])
    expect(bottom.map((s) => s.value)).toEqual([11, 12, 1, 2, 3, 4])
  })

  it('Čtvrtletí: nahoře roky, dole čtvrtletí', () => {
    const tl = createTimeline({ zoom: 'quarter', projectStart: START, projectFinish: FINISH })
    const [top, bottom] = headerRows(tl)
    expect(top.map((s) => s.value)).toEqual([2026, 2027])
    expect(bottom.map((s) => [s.value, s.year])).toEqual([
      [4, 2026],
      [1, 2027],
      [2, 2027],
    ])
    expect(bottom[0]?.width).toBe(92 * 1.5)
  })

  it('segmenty na sebe navazují bez mezer a pokryjí celou osu', () => {
    for (const zoom of ['day', 'week', 'month', 'quarter'] as const) {
      const tl = createTimeline({ zoom, projectStart: START, projectFinish: FINISH })
      for (const row of headerRows(tl)) {
        expect(row[0]?.startDay).toBe(tl.startDay)
        expect(row.at(-1)?.endDay).toBe(tl.endDay)
        row.slice(1).forEach((s, i) => expect(s.startDay).toBe(row[i]?.endDay))
      }
    }
  })
})

describe('volné dny na pozadí', () => {
  const tl = createTimeline({ zoom: 'week', projectStart: START, projectFinish: '2026-11-20' })

  it('sousední dny stejného druhu se spojí do jednoho pruhu', () => {
    const runs = nonWorkingRuns(tl, createWorkCalendar(createDefaultCalendar()))
    expect(runs.slice(0, 3).map((r) => [iso(r.startDay), iso(r.endDay), r.info])).toEqual([
      ['2026-11-14', '2026-11-16', { kind: 'weekend' }],
      ['2026-11-17', '2026-11-18', { kind: 'holiday', key: 'freedomDay' }],
      ['2026-11-21', '2026-11-23', { kind: 'weekend' }],
    ])
  })

  it('odstávka přes svátky a víkendy je jeden pruh', () => {
    const tlDec = createTimeline({ zoom: 'week', projectStart: '2026-12-14', projectFinish: '2027-01-08' })
    const cal = createWorkCalendar({
      ...createDefaultCalendar(),
      customHolidays: [{ start: '2026-12-21', end: '2026-12-31', name: 'Odstávka' }],
    })
    const runs = nonWorkingRuns(tlDec, cal).filter((r) => r.info.kind === 'custom')
    expect(runs.map((r) => [iso(r.startDay), iso(r.endDay)])).toEqual([['2026-12-21', '2027-01-01']])
  })
})
