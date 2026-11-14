import { describe, expect, it } from 'vitest'
import { createTimeline, headerRows, nonWorkingRuns } from './timeline'
import { createWorkCalendar } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import {
  ARROW_GAP,
  BAR_HALF_HEIGHT,
  barGeometry,
  dependencyPoints,
  layoutBars,
  MILESTONE_HALF,
  ROW_HEIGHT,
  type Bar,
} from './geometry'
import { createEmptyProject, createTask } from '../model/schema'

// Týdenní zoom (12 px/den), osa začíná pondělím 9. 11. 2026.
const tl = createTimeline({ zoom: 'week', projectStart: '2026-11-16', projectFinish: '2026-12-31' })

/** Ruční úsečka pro testy šipek. */
const bar = (row: number, xStart: number, xEnd: number): Bar => ({
  kind: 'task',
  xStart,
  xEnd,
  centerY: row * ROW_HEIGHT + ROW_HEIGHT / 2,
})

describe('poloha úseček', () => {
  it('činnost: od začátku prvního dne do konce posledního dne', () => {
    expect(barGeometry(tl, 'task', '2026-11-16', '2026-11-20', 2)).toEqual({
      kind: 'task',
      xStart: 84, // 7 dní od začátku osy
      xEnd: 144, // konec pátku 20. 11.
      centerY: 2 * ROW_HEIGHT + ROW_HEIGHT / 2,
    })
  })

  it('jednodenní činnost má šířku jednoho dne', () => {
    const b = barGeometry(tl, 'task', '2026-11-16', '2026-11-16', 0)
    expect(b.xEnd - b.xStart).toBe(12)
  })

  it('fáze se počítá stejně jako činnost', () => {
    expect(barGeometry(tl, 'phase', '2026-11-16', '2026-11-20', 0)).toMatchObject({ xStart: 84, xEnd: 144 })
  })

  it('milník: kosočtverec na konci svého dne', () => {
    const b = barGeometry(tl, 'milestone', '2026-11-20', '2026-11-20', 1)
    expect(b).toEqual({ kind: 'milestone', xStart: 144 - MILESTONE_HALF, xEnd: 144 + MILESTONE_HALF, centerY: 48 })
  })
})

describe('úsečky všech řádků', () => {
  it('každý řádek se spočítaným termínem dostane úsečku na své výšce, ostatní žádnou', () => {
    const rows = [
      createTask({ id: 'a', name: 'A', order: 0 }),
      createTask({ id: 'b', name: 'B', order: 1 }),
      createTask({ id: 'c', name: 'C', order: 2, kind: 'milestone' }),
    ]
    const dates = new Map([
      ['a', { start: '2026-11-16', finish: '2026-11-20' }],
      ['b', { start: null, finish: null }], // např. činnost v kruhu vazeb
      ['c', { start: '2026-11-20', finish: '2026-11-20' }],
    ])
    const bars = layoutBars(tl, rows, dates)
    expect([...bars.keys()]).toEqual(['a', 'c'])
    expect(bars.get('a')).toMatchObject({ xStart: 84, xEnd: 144, centerY: 16 })
    expect(bars.get('c')).toMatchObject({ kind: 'milestone', centerY: 2 * ROW_HEIGHT + ROW_HEIGHT / 2 })
  })
})

describe('výkon (N-02)', () => {
  it('300 činností: osa, volné dny, úsečky a šipky v měřítku Dny do 50 ms', () => {
    // 300 navazujících činností po 5 dnech ≈ 6 let – osa v měřítku Dny má přes 2 000 dnů.
    const rows = Array.from({ length: 300 }, (_, i) => {
      const task = createTask({ id: `T${i}`, name: `T${i}`, order: i, durationDays: 5 })
      return i > 0 ? { ...task, dependencies: [{ predecessorId: `T${i - 1}`, type: 'FS' as const, lagDays: 0 }] } : task
    })
    const project = { ...createEmptyProject({ name: 'P', language: 'cs', startDate: '2026-11-16' }), tasks: rows }
    const result = schedule(project)

    const run = () => {
      const timeline = createTimeline({ zoom: 'day', projectStart: project.startDate, projectFinish: result.projectFinish })
      headerRows(timeline)
      nonWorkingRuns(timeline, createWorkCalendar(project.calendar))
      const bars = layoutBars(timeline, rows, result.tasks)
      for (const task of rows) {
        for (const dep of task.dependencies) dependencyPoints(bars.get(dep.predecessorId)!, bars.get(task.id)!, dep.type)
      }
      return bars
    }
    run() // zahřátí
    const t0 = performance.now()
    const bars = run()
    expect(performance.now() - t0).toBeLessThan(50)
    expect(bars.size).toBe(300)
  })
})

describe('trasa šipky vazby', () => {
  it('FS s místem: doprava, dolů, doprava do začátku následníka', () => {
    const from = bar(0, 84, 144)
    const to = bar(2, 168, 228)
    expect(dependencyPoints(from, to, 'FS')).toEqual([
      [144, 16],
      [144 + ARROW_GAP, 16],
      [144 + ARROW_GAP, 80],
      [168, 80],
    ])
  })

  it('FS na další den: svisle dolů do horní hrany následníka (bez kličky)', () => {
    const from = bar(0, 84, 144)
    const to = bar(2, 144, 204) // začíná hned, kde předchůdce končí
    expect(dependencyPoints(from, to, 'FS')).toEqual([
      [144, 16],
      [144 + ARROW_GAP, 16],
      [144 + ARROW_GAP, 80 - BAR_HALF_HEIGHT],
    ])
  })

  it('FS nahoru na další den: svisle nahoru do spodní hrany', () => {
    const from = bar(3, 84, 144)
    const to = bar(1, 144, 204)
    expect(dependencyPoints(from, to, 'FS').at(-1)).toEqual([144 + ARROW_GAP, 48 + BAR_HALF_HEIGHT])
  })

  it('FS do milníku: hrot se dotkne hrany kosočtverce', () => {
    const from = bar(0, 84, 144)
    // milník se středem 148 (2 px vedle místa, kde šipka klesá)
    const to: Bar = { kind: 'milestone', xStart: 148 - MILESTONE_HALF, xEnd: 148 + MILESTONE_HALF, centerY: 48 }
    expect(dependencyPoints(from, to, 'FS').at(-1)).toEqual([150, 48 - (MILESTONE_HALF - 2)])
  })

  it('FS bez místa (následník začíná dřív a končí před ohybem): oklika mezerou mezi řádky', () => {
    const from = bar(0, 84, 144)
    const to = bar(2, 100, 140)
    expect(dependencyPoints(from, to, 'FS')).toEqual([
      [144, 16],
      [144 + ARROW_GAP, 16],
      [144 + ARROW_GAP, 32], // hranice mezi řádky 0 a 1
      [100 - ARROW_GAP, 32],
      [100 - ARROW_GAP, 80],
      [100, 80],
    ])
  })

  it('FS nahoru (následník je výš): oklika jde mezerou nad řádkem', () => {
    const from = bar(3, 84, 144)
    const to = bar(1, 100, 140)
    const points = dependencyPoints(from, to, 'FS')
    expect(points[2]).toEqual([144 + ARROW_GAP, 3 * ROW_HEIGHT])
    expect(points.at(-1)).toEqual([100, 48])
  })

  it('SS: ze začátku doleva, pak do začátku následníka', () => {
    const from = bar(0, 84, 144)
    const to = bar(1, 120, 180)
    expect(dependencyPoints(from, to, 'SS')).toEqual([
      [84, 16],
      [84 - ARROW_GAP, 16],
      [84 - ARROW_GAP, 48],
      [120, 48],
    ])
  })

  it('FF: z konce doprava, do konce následníka zprava', () => {
    const from = bar(0, 84, 144)
    const to = bar(1, 60, 120)
    expect(dependencyPoints(from, to, 'FF')).toEqual([
      [144, 16],
      [144 + ARROW_GAP, 16],
      [144 + ARROW_GAP, 48],
      [120, 48],
    ])
  })

  it('FF bez místa: oklika a vstup zprava', () => {
    const from = bar(0, 84, 144)
    const to = bar(1, 160, 200) // začíná až za ohybem šipky
    expect(dependencyPoints(from, to, 'FF')).toEqual([
      [144, 16],
      [144 + ARROW_GAP, 16],
      [144 + ARROW_GAP, 32],
      [200 + ARROW_GAP, 32],
      [200 + ARROW_GAP, 48],
      [200, 48],
    ])
  })

  it('FF, když šipka klesá nad úsečkou následníka: svisle do ní', () => {
    const from = bar(0, 84, 144)
    const to = bar(1, 100, 200)
    expect(dependencyPoints(from, to, 'FF').at(-1)).toEqual([144 + ARROW_GAP, 48 - BAR_HALF_HEIGHT])
  })

  it('SF: ze začátku doleva, do konce následníka zprava', () => {
    const from = bar(0, 84, 144)
    const to = bar(1, 20, 60)
    expect(dependencyPoints(from, to, 'SF')).toEqual([
      [84, 16],
      [84 - ARROW_GAP, 16],
      [84 - ARROW_GAP, 48],
      [60, 48],
    ])
  })

  it('poslední úsek je pravoúhlý a nenulový (hrot šipky má jasný směr)', () => {
    const from = bar(0, 84, 144)
    for (const type of ['FS', 'SS', 'FF', 'SF'] as const) {
      for (const to of [bar(1, 0, 40), bar(1, 140, 150), bar(1, 60, 200), bar(3, 300, 400)]) {
        const points = dependencyPoints(from, to, type)
        const [a, b] = points.slice(-2) as [[number, number], [number, number]]
        const horizontal = a[1] === b[1]
        const vertical = a[0] === b[0]
        expect(horizontal || vertical).toBe(true)
        expect(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])).toBeGreaterThanOrEqual(4)
      }
    }
  })
})
