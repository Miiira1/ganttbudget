import { describe, expect, it } from 'vitest'
import { isoToDay } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import { baselineBac, createBaseline } from './baseline'
import { computeCosts } from './costs'
import { computeCostTimeline } from './costTimeline'
import { earnedValue, evCurves, rollupPercent, sampleCurves } from './earnedValue'
import { createEmptyProject, createTask, type Baseline, type Project, type Task, type TaskLine } from './schema'

/*
 * Kalendář: Po–Pá, české svátky. Listopad 2026: po 16., út 17. = svátek, st 18.–pá 20., so–ne 21.–22., po 23.
 * Fáze P: A (5 dnů, práce 50 % = 2 000 Kč/den → 16., 18., 19., 20., 23. 11. = 10 000 Kč)
 *         B (2 dny 16. a 18. 11., jednorázově 3 000 Kč na konci → 18. 11.).
 */
const labor = (id: string, sharePct: number): TaskLine => ({ id, kind: 'labor', categoryId: 'cat-labor', professionId: 'pr', sharePct })
const oneTimeEnd = (id: string, amount: number): TaskLine => ({ id, kind: 'oneTime', categoryId: 'cat-services', name: id, amount, timing: 'end' })
const task = (id: string, durationDays: number, lines: TaskLine[], order: number, parentId: string | null = 'P', percent = 0): Task => ({
  ...createTask({ id, name: id, order, durationDays }),
  parentId,
  lines,
  percentComplete: percent,
})

function project(edit: (p: Project) => void = () => {}): Project {
  const p = createEmptyProject({ name: 'T', language: 'cs', startDate: '2026-11-16' })
  p.professions = [{ id: 'pr', name: 'Programátor', categoryId: 'cat-labor', capacityPerDay: 8, manualRate: 50_000 }] // 500 Kč/h
  p.tasks = [
    { ...createTask({ id: 'P', name: 'P', order: 0, kind: 'phase' }) },
    task('A', 5, [labor('a1', 50)], 0),
    task('B', 2, [oneTimeEnd('b1', 300_000)], 1),
  ]
  edit(p)
  return p
}

function snapshot(p: Project) {
  const s = schedule(p)
  return createBaseline(p, s, computeCostTimeline(p, s, computeCosts(p, s)), '2026-11-17')
}
function baselineOf(p: Project): Baseline {
  return { id: 'b', name: 'Schválený plán', ...snapshot(p) }
}
const day = isoToDay

describe('snímek baseline', () => {
  it('termíny, délky a náklad po dnech každé položky; fáze bez vlastních nákladů', () => {
    expect(snapshot(project())).toEqual({
      savedAt: '2026-11-17',
      tasks: [
        { taskId: 'P', parentId: null, name: 'P', kind: 'phase', start: '2026-11-16', finish: '2026-11-23', durationDays: 5, costs: [] },
        {
          taskId: 'A',
          parentId: 'P',
          name: 'A',
          kind: 'task',
          start: '2026-11-16',
          finish: '2026-11-23',
          durationDays: 5,
          costStart: '2026-11-16',
          costs: [200_000, 0, 200_000, 200_000, 200_000, 0, 0, 200_000],
        },
        { taskId: 'B', parentId: 'P', name: 'B', kind: 'task', start: '2026-11-16', finish: '2026-11-18', durationDays: 2, costStart: '2026-11-18', costs: [300_000] },
      ],
    })
  })

  it('položka bez termínu (kruh vazeb) se do snímku nedostane', () => {
    const p = project((x) => {
      x.tasks[1]!.dependencies = [{ predecessorId: 'B', type: 'FS', lagDays: 0 }]
      x.tasks[2]!.dependencies = [{ predecessorId: 'A', type: 'FS', lagDays: 0 }]
    })
    // A a B tvoří kruh; fáze P termín počítá ze svých činností, takže ho nemá také.
    expect(snapshot(p).tasks.map((t) => t.taskId)).toEqual([])
  })
})

describe('Earned Value k datu stavu', () => {
  // Stav k 19. 11.: A hotová ze 40 %, B ze 100 %; skutečnost A 2 500 Kč (18. 11.) + 1 000 Kč (25. 11. – po datu stavu), B 3 500 Kč.
  const progress = (p: Project) => {
    p.tasks[1]!.percentComplete = 40
    p.tasks[1]!.actuals = [
      { id: 'x1', date: '2026-11-18', amount: 250_000 },
      { id: 'x2', date: '2026-11-25', amount: 100_000 },
    ]
    p.tasks[2]!.percentComplete = 100
    p.tasks[2]!.actuals = [{ id: 'x3', date: '2026-11-18', amount: 350_000 }]
  }
  const base = baselineOf(project())

  it('ručně spočítaný příklad: BAC, PV, EV, AC po činnostech, fázi a projektu', () => {
    const p = project(progress)
    const ev = earnedValue(p, schedule(p), base, day('2026-11-19'))
    const row = (id: string) => ev.byId.get(id)!
    // A: PV = 16., 18., 19. 11. = 6 000 Kč; EV = 40 % z 10 000 Kč; AC jen do data stavu.
    expect(row('A')).toMatchObject({ bac: 1_000_000, pv: 600_000, ev: 400_000, ac: 250_000, percent: 40, inPlan: true, inBaseline: true })
    expect(row('B')).toMatchObject({ bac: 300_000, pv: 300_000, ev: 300_000, ac: 350_000, percent: 100 })
    // Fáze = součet; % fáze = EV / BAC = 7 000 / 13 000 = 53,8 % → 54 %.
    expect(row('P')).toMatchObject({ bac: 1_300_000, pv: 900_000, ev: 700_000, ac: 600_000, percent: 54 })
    expect(ev.rows.map((r) => r.taskId)).toEqual(['P', 'A', 'B'])
    // SPI = 7 000 / 9 000 = 0,78; CPI = 7 000 / 6 000 = 1,17; EAC = 13 000 / (7/6) = 11 142,86 Kč.
    expect(ev.totals).toEqual({
      bac: 1_300_000,
      pv: 900_000,
      ev: 700_000,
      ac: 600_000,
      sv: -200_000,
      cv: 100_000,
      spi: 0.78,
      cpi: 1.17,
      eac: 1_114_286,
      etc: 514_286,
      vac: 185_714,
    })
  })

  it('posun termínů proti baseline v kalendářních dnech (kladný = později)', () => {
    const p = project((x) => {
      x.tasks[1]!.durationDays = 6 // A končí 24. 11. místo 23. 11.
    })
    const ev = earnedValue(p, schedule(p), base, day('2026-11-19'))
    expect(ev.byId.get('A')).toMatchObject({ baselineStart: '2026-11-16', baselineFinish: '2026-11-23', start: '2026-11-16', finish: '2026-11-24', startShift: 0, finishShift: 1 })
  })

  it('dělení nulou: bez skutečnosti CPI/EAC chybí, před začátkem SPI chybí', () => {
    const p = project()
    const before = earnedValue(p, schedule(p), base, day('2026-11-13'))
    expect(before.totals).toMatchObject({ pv: 0, ev: 0, ac: 0, spi: null, cpi: null, eac: null, etc: null, vac: null })
  })

  it('nová činnost (není v baseline) a smazaná činnost (jen v baseline)', () => {
    const p = project((x) => {
      progress(x)
      x.tasks.splice(2, 1) // B smazána
      x.tasks.push({ ...task('C', 1, [], 1, 'P', 50), actuals: [{ id: 'c1', date: '2026-11-16', amount: 1_000 }] })
    })
    const ev = earnedValue(p, schedule(p), base, day('2026-11-19'))
    // C: v baseline není → BAC, PV, EV 0, ale skutečnost se počítá.
    expect(ev.byId.get('C')).toMatchObject({ inBaseline: false, inPlan: true, bac: 0, pv: 0, ev: 0, ac: 1_000 })
    // B: jen v baseline – plán počítá dál (PV), hotovo 0 %, pod svou původní fází.
    expect(ev.byId.get('B')).toMatchObject({ inBaseline: true, inPlan: false, name: 'B', parentId: 'P', bac: 300_000, pv: 300_000, ev: 0, ac: 0, start: null })
    expect(ev.rows.map((r) => r.taskId)).toEqual(['P', 'A', 'C', 'B'])
    expect(ev.totals).toMatchObject({ bac: 1_300_000, pv: 900_000, ev: 400_000, ac: 251_000 })
  })
})

describe('% hotovo fáze', () => {
  it('s baseline váží podle BAC, bez ní podle délky; vnořené fáze', () => {
    const p = project((x) => {
      x.tasks[1]!.percentComplete = 40
      x.tasks[2]!.percentComplete = 100
    })
    const bac = new Map([
      ['A', 1_000_000],
      ['B', 300_000],
    ])
    expect(rollupPercent(p, bac).get('P')).toBe(54)
    // Podle délky: (5 × 40 + 2 × 100) / 7 = 57,1 → 57.
    expect(rollupPercent(p, null).get('P')).toBe(57)
    // Vnořená fáze Q pod P se dvěma milníky (délka 0) → prostý průměr.
    const q = project((x) => {
      x.tasks = [
        { ...createTask({ id: 'P', name: 'P', order: 0, kind: 'phase' }) },
        { ...createTask({ id: 'Q', name: 'Q', order: 0, kind: 'phase' }), parentId: 'P' },
        { ...createTask({ id: 'M1', name: 'M1', order: 0, kind: 'milestone' }), parentId: 'Q', percentComplete: 100 },
        { ...createTask({ id: 'M2', name: 'M2', order: 1, kind: 'milestone' }), parentId: 'Q' },
      ]
    })
    expect(rollupPercent(q, null).get('Q')).toBe(50)
    expect(rollupPercent(q, null).get('P')).toBe(50)
  })

  it('vlastní náklady vnořené fáze se počítají stejně jako ve Sledování (audit V-N6)', () => {
    // F: vnořená fáze G (vlastní řádek 1 000 Kč) s činností A (1 000 Kč, 0 %) + činnost B (1 000 Kč, 100 %).
    const p = project((x) => {
      x.tasks = [
        { ...createTask({ id: 'F', name: 'F', order: 0, kind: 'phase' }) },
        { ...createTask({ id: 'G', name: 'G', order: 0, kind: 'phase' }), parentId: 'F', lines: [oneTimeEnd('g1', 100_000)] },
        task('A', 1, [oneTimeEnd('a1', 100_000)], 0, 'G', 0),
        task('B', 1, [oneTimeEnd('b1', 100_000)], 1, 'F', 100),
      ]
    })
    const base = baselineOf(p)
    const percent = rollupPercent(p, baselineBac(base))
    const ev = earnedValue(p, schedule(p), base, day('2026-11-30'))
    // Hotovo je 1 000 z 3 000 Kč → 33 % (dřív Gantt ukazoval 50 %, protože vlastní řádek G vynechal).
    expect(percent.get('F')).toBe(33)
    expect(percent.get('F')).toBe(ev.byId.get('F')?.percent)
    expect(percent.get('G')).toBe(ev.byId.get('G')?.percent)
  })
})

describe('křivky PV a AC po dnech (kumulativně)', () => {
  it('od prvního dne nákladu či skutečnosti do posledního', () => {
    const p = project((x) => {
      x.tasks[1]!.actuals = [
        { id: 'x1', date: '2026-11-18', amount: 250_000 },
        { id: 'x2', date: '2026-11-25', amount: 100_000 },
      ]
      x.tasks[2]!.actuals = [{ id: 'x3', date: '2026-11-18', amount: 350_000 }]
    })
    const curves = evCurves(p, baselineOf(project()))
    expect(curves.range).toEqual({ startDay: day('2026-11-16'), endDay: day('2026-11-25') })
    expect(curves.pv).toEqual([200_000, 200_000, 700_000, 900_000, 1_100_000, 1_100_000, 1_100_000, 1_300_000, 1_300_000, 1_300_000])
    expect(curves.ac).toEqual([0, 0, 600_000, 600_000, 600_000, 600_000, 600_000, 600_000, 600_000, 700_000])
  })

  it('vzorkování po obdobích: kumulativně ke konci období, AC jen do data stavu', () => {
    const p = project((x) => {
      x.tasks[1]!.actuals = [
        { id: 'x1', date: '2026-11-18', amount: 250_000 },
        { id: 'x2', date: '2026-11-25', amount: 100_000 },
      ]
      x.tasks[2]!.actuals = [{ id: 'x3', date: '2026-11-18', amount: 350_000 }]
    })
    const curves = evCurves(p, baselineOf(project()))
    const periods = [
      { startDay: day('2026-11-10'), endDay: day('2026-11-12') }, // před rozsahem
      { startDay: day('2026-11-16'), endDay: day('2026-11-18') },
      { startDay: day('2026-11-19'), endDay: day('2026-11-22') }, // obsahuje datum stavu 20. 11.
      { startDay: day('2026-11-23'), endDay: day('2026-11-29') }, // po datu stavu, konec za rozsahem
    ]
    expect(sampleCurves(curves, periods, day('2026-11-20'))).toEqual({
      pv: [0, 700_000, 1_100_000, 1_300_000],
      ac: [0, 600_000, 600_000, null],
    })
    expect(sampleCurves({ range: null, pv: [], ac: [] }, periods, day('2026-11-20'))).toEqual({ pv: [0, 0, 0, 0], ac: [0, 0, 0, null] })
  })

  it('bez nákladů i skutečnosti = žádný rozsah', () => {
    const p = createEmptyProject({ name: 'T', language: 'cs', startDate: '2026-11-16' })
    expect(evCurves(p, { id: 'b', name: 'B', savedAt: '2026-11-16', tasks: [] })).toEqual({ range: null, pv: [], ac: [] })
  })
})

describe('výkon', () => {
  it('300 činností × 3 řádky, rok – snímek + Earned Value + křivky pod 100 ms', () => {
    const p = project((x) => {
      x.tasks = Array.from({ length: 300 }, (_, i) => ({
        ...createTask({ id: `t${i}`, name: `t${i}`, order: i, durationDays: 5 + (i % 40) }),
        dependencies: i > 0 && i % 5 !== 0 ? [{ predecessorId: `t${i - 1}`, type: 'SS' as const, lagDays: 2 }] : [],
        lines: [labor(`l${i}a`, 50), labor(`l${i}b`, 25), oneTimeEnd(`l${i}c`, 10_000)],
        percentComplete: i % 100,
        actuals: [{ id: `a${i}`, date: '2027-01-15', amount: 5_000 }],
      }))
    })
    const s = schedule(p)
    const tl = computeCostTimeline(p, s, computeCosts(p, s))
    const run = () => {
      const b: Baseline = { id: 'b', name: 'B', ...createBaseline(p, s, tl, '2026-11-17') }
      earnedValue(p, s, b, day('2027-03-01'))
      evCurves(p, b)
    }
    run() // zahřátí
    let best = Infinity
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now()
      run()
      best = Math.min(best, performance.now() - t0)
    }
    expect(best).toBeLessThan(100)
  })
})
