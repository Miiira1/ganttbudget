import { describe, expect, it } from 'vitest'
import { dayToIso, isoToDay } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import { computeLoad, lineLoadWarnings, loadPeriods, summarizePeriod, type ResourceLoad } from './load'
import { createEmptyProject, createTask, type Project, type Task, type TaskLine } from './schema'

/*
 * Kalendář: Po–Pá, české svátky. Listopad 2026: po 16., út 17. = svátek, st 18.–pá 20., so–ne 21.–22., po 23.
 * Činnost s délkou 5 dnů od 16. 11. pracuje 16., 18., 19., 20. a 23. 11.
 * Profese Programátor (8 h/den); pracovníci Eva (6 h/den) a Jan (8 h/den) jsou programátoři.
 */
function project(tasks: Task[], extra: (p: Project) => void = () => {}): Project {
  const p = createEmptyProject({ name: 'T', language: 'cs', startDate: '2026-11-16' })
  p.professions = [
    { id: 'pr-plc', name: 'Programátor', categoryId: 'cat-labor', capacityPerDay: 8 },
    { id: 'pr-none', name: 'Bez lidí', categoryId: 'cat-labor', capacityPerDay: 8 },
  ]
  p.workers = [
    { id: 'w-eva', name: 'Eva', professionId: 'pr-plc', capacityPerDay: 6 },
    { id: 'w-jan', name: 'Jan', professionId: 'pr-plc', capacityPerDay: 8 },
  ]
  p.machines = [{ id: 'm-crane', name: 'Jeřáb', categoryId: 'cat-services', rate: 150_000, rateUnit: 'hour', capacityPerDay: 8 }]
  p.tasks = tasks
  extra(p)
  return p
}

let lineSeq = 0
const labor = (professionId: string, sharePct: number, workerId?: string): TaskLine => ({
  id: `l${++lineSeq}`,
  kind: 'labor',
  categoryId: 'cat-labor',
  professionId,
  ...(workerId ? { workerId } : {}),
  sharePct,
})
const machine = (sharePct: number): TaskLine => ({ id: `l${++lineSeq}`, kind: 'machine', categoryId: 'cat-services', machineId: 'm-crane', sharePct })
const task = (id: string, durationDays: number, lines: TaskLine[], order = 0): Task => ({ ...createTask({ id, name: id, order, durationDays }), lines })

function load(p: Project) {
  return computeLoad(p, schedule(p))
}
function resource(p: Project, key: string): ResourceLoad {
  const r = load(p).resources.find((x) => x.key === key)
  if (!r) throw new Error(`zdroj ${key} nenalezen`)
  return r
}
/** Poptávka a kapacita zdroje v daném dni (ISO). */
function at(p: Project, key: string, iso: string) {
  const result = load(p)
  const r = result.resources.find((x) => x.key === key)!
  const i = isoToDay(iso) - result.range!.startDay
  return { demand: r.demand[i], capacity: r.capacity[i] }
}
const isoDays = (days: number[]) => days.map(dayToIso)

describe('poptávka a kapacita pracovníka', () => {
  it('hodiny řádku se rozloží do pracovních dnů činnosti (h/den × %), svátek a víkend 0', () => {
    const p = project([task('A', 5, [labor('pr-plc', 50, 'w-eva')])])
    expect(at(p, 'worker:w-eva', '2026-11-16')).toEqual({ demand: 3, capacity: 6 })
    expect(at(p, 'worker:w-eva', '2026-11-17')).toEqual({ demand: 0, capacity: 0 }) // svátek
    expect(at(p, 'worker:w-eva', '2026-11-21')).toEqual({ demand: 0, capacity: 0 }) // sobota
    expect(at(p, 'worker:w-eva', '2026-11-23')).toEqual({ demand: 3, capacity: 6 })
    expect(resource(p, 'worker:w-eva').overloadedDays).toEqual([])
  })

  it('dvě souběžné činnosti na 100 % → 12 h při kapacitě 6 h = přetížených všech 5 dnů', () => {
    const p = project([task('A', 5, [labor('pr-plc', 100, 'w-eva')]), task('B', 5, [labor('pr-plc', 100, 'w-eva')], 1)])
    expect(at(p, 'worker:w-eva', '2026-11-18').demand).toBe(12)
    expect(isoDays(resource(p, 'worker:w-eva').overloadedDays)).toEqual(['2026-11-16', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23'])
  })

  it('přesně plná kapacita (50 % + 50 %) není přetížení', () => {
    const p = project([task('A', 5, [labor('pr-plc', 50, 'w-eva')]), task('B', 5, [labor('pr-plc', 50, 'w-eva')], 1)])
    expect(resource(p, 'worker:w-eva').overloadedDays).toEqual([])
  })

  it('nepřítomnost: kapacita 0 → práce v těch dnech je přetížení; termíny činnosti se nemění', () => {
    const p = project([task('A', 5, [labor('pr-plc', 100, 'w-eva')])], (x) => {
      x.workers[0]!.absences = [{ start: '2026-11-19', end: '2026-11-22' }]
    })
    expect(at(p, 'worker:w-eva', '2026-11-19')).toEqual({ demand: 6, capacity: 0 })
    expect(isoDays(resource(p, 'worker:w-eva').overloadedDays)).toEqual(['2026-11-19', '2026-11-20'])
    expect(schedule(p).tasks.get('A')!.finish).toBe('2026-11-23')
  })

  it('kdo k vytížení přispívá: činnost, řádek, hodiny za den a rozsah', () => {
    const l = labor('pr-plc', 25, 'w-eva')
    const p = project([task('A', 5, [l])])
    expect(resource(p, 'worker:w-eva').contributions).toEqual([
      { taskId: 'A', lineId: l.id, hoursPerDay: 1.5, startDay: isoToDay('2026-11-16'), finishDay: isoToDay('2026-11-23') },
    ])
  })
})

describe('profese', () => {
  it('kapacita = součet jejích pracovníků; poptávka = všechny řádky profese (i s konkrétním pracovníkem)', () => {
    const p = project([task('A', 5, [labor('pr-plc', 100)]), task('B', 5, [labor('pr-plc', 100, 'w-eva')], 1)])
    expect(at(p, 'profession:pr-plc', '2026-11-16')).toEqual({ demand: 14, capacity: 14 })
    expect(resource(p, 'profession:pr-plc').overloadedDays).toEqual([])
    // Eva sama přetížená není (6 h z 6 h), Jan nemá nic.
    expect(at(p, 'worker:w-jan', '2026-11-16')).toEqual({ demand: 0, capacity: 8 })
  })

  it('nepřítomnost pracovníka sníží kapacitu profese', () => {
    const p = project([task('A', 5, [labor('pr-plc', 100)]), task('B', 5, [labor('pr-plc', 100, 'w-eva')], 1)], (x) => {
      x.workers[1]!.absences = [{ start: '2026-11-18', end: '2026-11-18' }]
    })
    expect(at(p, 'profession:pr-plc', '2026-11-18')).toEqual({ demand: 14, capacity: 6 })
    expect(isoDays(resource(p, 'profession:pr-plc').overloadedDays)).toEqual(['2026-11-18'])
  })

  it('profese bez pracovníků ukazuje jen poptávku a přetížení nehlásí', () => {
    const p = project([task('A', 5, [labor('pr-none', 100)])])
    const r = resource(p, 'profession:pr-none')
    expect(r.hasCapacity).toBe(false)
    expect(at(p, 'profession:pr-none', '2026-11-16')).toEqual({ demand: 8, capacity: 0 })
    expect(r.overloadedDays).toEqual([])
  })
})

describe('stroje a fáze', () => {
  it('stroj: 50 % + 75 % souběžně = 10 h z 8 h → přetížení', () => {
    const p = project([task('A', 5, [machine(50)]), task('B', 5, [machine(75)], 1)])
    expect(at(p, 'machine:m-crane', '2026-11-20')).toEqual({ demand: 10, capacity: 8 })
    expect(resource(p, 'machine:m-crane').overloadedDays).toHaveLength(5)
  })

  it('řádek na fázi se rozloží do celé spočítané délky fáze', () => {
    const phase: Task = { ...createTask({ id: 'P', name: 'P', order: 0, durationDays: 1 }), kind: 'phase', lines: [labor('pr-plc', 50, 'w-eva')] }
    const child: Task = { ...task('A', 5, []), parentId: 'P', order: 1 }
    const p = project([phase, child])
    expect(at(p, 'worker:w-eva', '2026-11-16').demand).toBe(3)
    expect(at(p, 'worker:w-eva', '2026-11-23').demand).toBe(3)
  })

  it('činnost, jejíž termín nejde spočítat (kruh vazeb), vytížení nezapočítá', () => {
    const a = { ...task('A', 5, [labor('pr-plc', 100, 'w-eva')]), dependencies: [{ predecessorId: 'B', type: 'FS' as const, lagDays: 0 }] }
    const b = { ...task('B', 5, [], 1), dependencies: [{ predecessorId: 'A', type: 'FS' as const, lagDays: 0 }] }
    const p = project([a, b, task('C', 1, [])])
    expect(resource(p, 'worker:w-eva').contributions).toEqual([])
  })
})

describe('celkový výsledek', () => {
  it('všechny zdroje v pořadí pracovníci, profese, stroje; počet přetížených zdrojů', () => {
    const p = project([task('A', 5, [labor('pr-plc', 100, 'w-eva')]), task('B', 5, [labor('pr-plc', 100, 'w-eva'), machine(50)], 1)])
    const result = load(p)
    expect(result.resources.map((r) => r.key)).toEqual(['worker:w-eva', 'worker:w-jan', 'profession:pr-plc', 'profession:pr-none', 'machine:m-crane'])
    // Eva 12 h z 6 h; profese 12 h z 14 h; stroj 4 h z 8 h → přetížený jen jeden zdroj.
    expect(result.overloadedCount).toBe(1)
    expect(result.range).toEqual({ startDay: isoToDay('2026-11-16'), endDay: isoToDay('2026-11-23') })
  })

  it('prázdný projekt: žádný rozsah, zdroje bez poptávky', () => {
    const result = load(project([]))
    expect(result.range).toBeNull()
    expect(result.overloadedCount).toBe(0)
    expect(result.resources[0]!.demand).toHaveLength(0)
  })
})

describe('shrnutí po obdobích', () => {
  const range = { startDay: isoToDay('2026-11-18'), endDay: isoToDay('2027-01-05') }

  it('týdny začínají v pondělí, krajní týdny jsou oříznuté rozsahem', () => {
    const weeks = loadPeriods(range, 'week')
    expect(weeks[0]).toEqual({ startDay: isoToDay('2026-11-18'), endDay: isoToDay('2026-11-22') })
    expect(weeks[1]).toEqual({ startDay: isoToDay('2026-11-23'), endDay: isoToDay('2026-11-29') })
    expect(weeks.at(-1)).toEqual({ startDay: isoToDay('2027-01-04'), endDay: isoToDay('2027-01-05') })
  })

  it('měsíce podle kalendáře, dny po jednom', () => {
    expect(loadPeriods(range, 'month').map((m) => [dayToIso(m.startDay), dayToIso(m.endDay)])).toEqual([
      ['2026-11-18', '2026-11-30'],
      ['2026-12-01', '2026-12-31'],
      ['2027-01-01', '2027-01-05'],
    ])
    expect(loadPeriods({ startDay: 10, endDay: 12 }, 'day')).toEqual([
      { startDay: 10, endDay: 10 },
      { startDay: 11, endDay: 11 },
      { startDay: 12, endDay: 12 },
    ])
  })

  it('součet poptávky a kapacity, počet přetížených dnů a nejvyšší denní vytížení v %', () => {
    // Eva: A 100 % po celou dobu, B 50 % jen 16.–18. 11. (2 pracovní dny) → 9 h ve dnech 16. a 18.
    const p = project([task('A', 5, [labor('pr-plc', 100, 'w-eva')]), task('B', 2, [labor('pr-plc', 50, 'w-eva')], 1)])
    const result = load(p)
    const eva = result.resources.find((r) => r.key === 'worker:w-eva')!
    const week = { startDay: isoToDay('2026-11-16'), endDay: isoToDay('2026-11-22') }
    expect(summarizePeriod(eva, result.range!, week)).toEqual({ demand: 30, capacity: 24, overloadedDays: 2, peakPct: 150 })
    const nextWeek = { startDay: isoToDay('2026-11-23'), endDay: isoToDay('2026-11-29') }
    expect(summarizePeriod(eva, result.range!, nextWeek)).toEqual({ demand: 6, capacity: 6, overloadedDays: 0, peakPct: 100 })
  })

  it('období bez poptávky má vytížení null', () => {
    const p = project([task('A', 5, [labor('pr-plc', 100, 'w-eva')])])
    const result = load(p)
    const jan = result.resources.find((r) => r.key === 'worker:w-jan')!
    expect(summarizePeriod(jan, result.range!, result.range!)).toEqual({ demand: 0, capacity: 40, overloadedDays: 0, peakPct: null })
  })
})

describe('varování u řádku činnosti (panel Detail činnosti)', () => {
  function warnings(p: Project, taskId: string, lineIndex = 0) {
    const scheduled = schedule(p)
    const line = p.tasks.find((x) => x.id === taskId)!.lines[lineIndex]!
    return lineLoadWarnings(p, scheduled, computeLoad(p, scheduled), taskId, line)
  }

  it('nepřítomnost pracovníka během činnosti: počítají se jen pracovní dny (19. a 20. 11.)', () => {
    const p = project([task('A', 5, [labor('pr-plc', 50, 'w-eva')])], (x) => {
      x.workers[0]!.absences = [{ start: '2026-11-19', end: '2026-11-22' }]
    })
    // V nepřítomnosti je kapacita 0, takže i 50 % práce je přetížení.
    expect(warnings(p, 'A')).toEqual({ absenceDays: 2, overloadedDays: 2 })
  })

  it('přetížení se počítá jen ve dnech dané činnosti', () => {
    const p = project([task('A', 5, [labor('pr-plc', 100, 'w-eva')]), task('B', 2, [labor('pr-plc', 100, 'w-eva')], 1)])
    expect(warnings(p, 'A')).toEqual({ absenceDays: 0, overloadedDays: 2 })
    expect(warnings(p, 'B')).toEqual({ absenceDays: 0, overloadedDays: 2 })
  })

  it('řádek bez konkrétního pracovníka hlídá profesi', () => {
    const p = project([task('A', 5, [labor('pr-plc', 100)]), task('B', 5, [labor('pr-plc', 100, 'w-eva')], 1)], (x) => {
      x.workers[1]!.absences = [{ start: '2026-11-18', end: '2026-11-18' }]
    })
    expect(warnings(p, 'A')).toEqual({ absenceDays: 0, overloadedDays: 1 })
  })

  it('stroj, materiál a profese bez pracovníků', () => {
    const p = project([
      task('A', 5, [machine(75), { id: 'mat', kind: 'material', categoryId: 'cat-material', materialId: 'x', quantity: 1 }, labor('pr-none', 100)]),
      task('B', 5, [machine(50)], 1),
    ])
    expect(warnings(p, 'A', 0)).toEqual({ absenceDays: 0, overloadedDays: 5 })
    expect(warnings(p, 'A', 1)).toEqual({ absenceDays: 0, overloadedDays: 0 })
    expect(warnings(p, 'A', 2)).toEqual({ absenceDays: 0, overloadedDays: 0 })
  })
})

describe('výkon', () => {
  it('300 činností × 3 řádky, 7 pracovníků, rok – výpočet pod 100 ms', () => {
    const p = project([], (x) => {
      x.workers = Array.from({ length: 7 }, (_, i) => ({ id: `w${i}`, name: `W${i}`, professionId: 'pr-plc', capacityPerDay: 8 }))
      x.tasks = Array.from({ length: 300 }, (_, i) => ({
        ...createTask({ id: `t${i}`, name: `t${i}`, order: i, durationDays: 5 + (i % 40) }),
        dependencies: i > 0 && i % 5 !== 0 ? [{ predecessorId: `t${i - 1}`, type: 'SS' as const, lagDays: 2 }] : [],
        lines: [labor('pr-plc', 50, `w${i % 7}`), labor('pr-plc', 25), machine(20)],
      }))
    })
    const scheduled = schedule(p)
    computeLoad(p, scheduled) // zahřátí
    const t0 = performance.now()
    const result = computeLoad(p, scheduled)
    for (const r of result.resources) for (const period of loadPeriods(result.range!, 'week')) summarizePeriod(r, result.range!, period)
    expect(performance.now() - t0).toBeLessThan(100)
  })
})
