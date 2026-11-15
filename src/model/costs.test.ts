import { describe, expect, it } from 'vitest'
import { isoToDay } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import { computeCosts, monthlyAmount } from './costs'
import { createEmptyProject, createTask, type Project, type TaskLine } from './schema'

/*
 * Kalendář: Po–Pá, české svátky. 17. 11. 2026 (út) je svátek.
 * Činnost A: 5 pracovních dnů od po 16. 11. → 16., 18., 19., 20., 23. 11. (konec po 23. 11.),
 * kalendářně 16.–23. 11. = 8 dní.
 */
function project(lines: TaskLine[], extra: (p: Project) => void = () => {}): Project {
  const p = createEmptyProject({ name: 'T', language: 'cs', startDate: '2026-11-16' })
  p.professions = [
    { id: 'pr-plc', name: 'Programátor', categoryId: 'cat-labor', capacityPerDay: 8, manualRate: 50_000 }, // 500 Kč/h
    { id: 'pr-none', name: 'Bez sazby', categoryId: 'cat-labor', capacityPerDay: 8 },
  ]
  p.workers = [{ id: 'w-eva', name: 'Eva', professionId: 'pr-plc', capacityPerDay: 6, manualRate: 60_000 }] // 600 Kč/h, 6 h/den
  p.machines = [
    { id: 'm-crane', name: 'Jeřáb', categoryId: 'cat-services', rate: 150_000, rateUnit: 'hour', capacityPerDay: 8 },
    { id: 'm-platform', name: 'Plošina', categoryId: 'cat-services', rate: 250_000, rateUnit: 'day', capacityPerDay: 8 },
  ]
  p.materials = [{ id: 'x-cable', name: 'Kabel', unit: 'm', unitPrice: 3_250, categoryId: 'cat-material' }]
  p.tasks = [{ ...createTask({ id: 'A', name: 'A', order: 0, durationDays: 5 }), lines }]
  extra(p)
  return p
}

const line = <T extends TaskLine>(l: T) => l
/** Náklad a hodiny jediného řádku činnosti A. */
function single(l: TaskLine) {
  const p = project([l])
  const c = computeCosts(p, schedule(p)).lines.get(l.id)!
  return c
}

describe('náklad jednoho řádku (ručně spočítané)', () => {
  it('člověk – profese: 5 dnů × 8 h × 50 % = 20 h × 500 Kč = 10 000 Kč', () => {
    expect(single(line({ id: 'l', kind: 'labor', categoryId: 'cat-labor', professionId: 'pr-plc', sharePct: 50 }))).toEqual({
      amount: 1_000_000,
      hours: 20,
      warning: null,
    })
  })

  it('člověk – konkrétní pracovník: jeho kapacita 6 h a sazba 600 Kč → 30 h = 18 000 Kč', () => {
    expect(single(line({ id: 'l', kind: 'labor', categoryId: 'cat-labor', professionId: 'pr-plc', workerId: 'w-eva', sharePct: 100 }))).toEqual({
      amount: 1_800_000,
      hours: 30,
      warning: null,
    })
  })

  it('člověk bez sazby: hodiny ano, náklad 0 a varování', () => {
    expect(single(line({ id: 'l', kind: 'labor', categoryId: 'cat-labor', professionId: 'pr-none', sharePct: 100 }))).toEqual({
      amount: 0,
      hours: 40,
      warning: 'noRate',
    })
  })

  it('stroj se sazbou za hodinu: 5 × 8 h × 25 % = 10 h × 1 500 Kč = 15 000 Kč', () => {
    expect(single(line({ id: 'l', kind: 'machine', categoryId: 'cat-services', machineId: 'm-crane', sharePct: 25 }))).toEqual({
      amount: 1_500_000,
      hours: 10,
      warning: null,
    })
  })

  it('stroj se sazbou za den: 5 dnů × 50 % × 2 500 Kč = 6 250 Kč (hodiny 20)', () => {
    expect(single(line({ id: 'l', kind: 'machine', categoryId: 'cat-services', machineId: 'm-platform', sharePct: 50 }))).toEqual({
      amount: 625_000,
      hours: 20,
      warning: null,
    })
  })

  it('materiál: 120,5 m × 32,50 Kč = 3 916,25 Kč; s přepsanou cenou 30 Kč = 3 615 Kč', () => {
    expect(single(line({ id: 'l', kind: 'material', categoryId: 'cat-material', materialId: 'x-cable', quantity: 120.5 })).amount).toBe(391_625)
    expect(
      single(line({ id: 'l', kind: 'material', categoryId: 'cat-material', materialId: 'x-cable', quantity: 120.5, unitPriceOverride: 3_000 })).amount,
    ).toBe(361_500)
  })

  it('jednorázový náklad = částka', () => {
    expect(single(line({ id: 'l', kind: 'oneTime', categoryId: 'cat-services', name: 'Záloha', amount: 5_000_000, timing: 'start' }))).toEqual({
      amount: 5_000_000,
      hours: null,
      warning: null,
    })
  })

  it('průběžný za pracovní den: 5 × 1 000 Kč = 5 000 Kč', () => {
    expect(single(line({ id: 'l', kind: 'recurring', categoryId: 'cat-services', name: 'N', amount: 100_000, period: 'day' })).amount).toBe(500_000)
  })

  it('průběžný za týden: 8 kalendářních dnů ÷ 7 × 700 Kč = 800 Kč (svátek nic nesnižuje)', () => {
    expect(single(line({ id: 'l', kind: 'recurring', categoryId: 'cat-services', name: 'N', amount: 70_000, period: 'week' })).amount).toBe(80_000)
  })

  it('průběžný za měsíc: 8 dnů listopadu × 31 000 Kč ÷ 30 = 8 266,67 Kč', () => {
    expect(single(line({ id: 'l', kind: 'recurring', categoryId: 'cat-services', name: 'N', amount: 3_100_000, period: 'month' })).amount).toBe(826_667)
  })

  it('měsíc přes přelom: 29. 11.–2. 12. = 31 000 Kč × (2/30 + 2/31) = 4 066,67 Kč', () => {
    expect(monthlyAmount(3_100_000, isoToDay('2026-11-29'), isoToDay('2026-12-02'))).toBe(406_667)
  })
})

describe('součty: činnost, fáze, projekt a rozpad podle druhu', () => {
  it('fáze = vlastní řádky + součet podřízených; projekt = součet nejvyšší úrovně', () => {
    const p = project([{ id: 'a1', kind: 'labor', categoryId: 'cat-labor', professionId: 'pr-plc', sharePct: 50 }], (q) => {
      // Fáze F obsahuje A; vlastní řádek F: jednorázový 1 000 Kč. Mimo fázi milník M s materiálem.
      q.tasks = [
        { ...createTask({ id: 'F', name: 'F', order: 0, kind: 'phase' }), lines: [{ id: 'f1', kind: 'oneTime', categoryId: 'cat-services', name: 'X', amount: 100_000, timing: 'end' }] },
        { ...q.tasks[0]!, parentId: 'F', order: 0 },
        {
          ...createTask({ id: 'M', name: 'M', order: 1, kind: 'milestone' }),
          lines: [{ id: 'm1', kind: 'material', categoryId: 'cat-material', materialId: 'x-cable', quantity: 10 }],
        },
      ]
    })
    const costs = computeCosts(p, schedule(p))
    expect(costs.byTask.get('A')!.total).toEqual({ total: 1_000_000, labor: 1_000_000, machines: 0, material: 0, other: 0 })
    expect(costs.byTask.get('F')!.own.total).toBe(100_000)
    expect(costs.byTask.get('F')!.total).toEqual({ total: 1_100_000, labor: 1_000_000, machines: 0, material: 0, other: 100_000 })
    expect(costs.byTask.get('M')!.total.material).toBe(32_500)
    expect(costs.project).toEqual({ total: 1_132_500, labor: 1_000_000, machines: 0, material: 32_500, other: 100_000 })
  })

  it('člověk na fázi počítá se spočítanou délkou fáze', () => {
    const p = project([], (q) => {
      q.tasks = [
        { ...createTask({ id: 'F', name: 'F', order: 0, kind: 'phase' }), lines: [{ id: 'f1', kind: 'labor', categoryId: 'cat-labor', professionId: 'pr-plc', sharePct: 10 }] },
        { ...q.tasks[0]!, parentId: 'F', order: 0 }, // 5 dnů → fáze 5 dnů → 5 × 8 × 10 % = 4 h × 500 = 2 000 Kč
      ]
    })
    expect(computeCosts(p, schedule(p)).lines.get('f1')).toEqual({ amount: 200_000, hours: 4, warning: null })
  })

  it('položka bez termínu (kruh ve vazbách) má časově závislé náklady 0, pevné zůstanou', () => {
    const p = project(
      [
        { id: 'a1', kind: 'labor', categoryId: 'cat-labor', professionId: 'pr-plc', sharePct: 50 },
        { id: 'a2', kind: 'oneTime', categoryId: 'cat-services', name: 'X', amount: 100, timing: 'start' },
      ],
      (q) => {
        q.tasks.push({ ...createTask({ id: 'B', name: 'B', order: 1 }), dependencies: [{ predecessorId: 'A', type: 'FS', lagDays: 0 }] })
        q.tasks[0]!.dependencies = [{ predecessorId: 'B', type: 'FS', lagDays: 0 }]
      },
    )
    const costs = computeCosts(p, schedule(p))
    expect(costs.lines.get('a1')!.amount).toBe(0)
    expect(costs.byTask.get('A')!.total.total).toBe(100)
  })

  it('výkon: 300 činností × 3 řádky do 50 ms', () => {
    const p = project([], (q) => {
      q.tasks = Array.from({ length: 300 }, (_, i) => ({
        ...createTask({ id: `T${i}`, name: `T${i}`, order: i, durationDays: 10 }),
        lines: [
          { id: `T${i}a`, kind: 'labor' as const, categoryId: 'cat-labor', professionId: 'pr-plc', workerId: 'w-eva', sharePct: 50 },
          { id: `T${i}b`, kind: 'material' as const, categoryId: 'cat-material', materialId: 'x-cable', quantity: 10 },
          { id: `T${i}c`, kind: 'recurring' as const, categoryId: 'cat-services', name: 'N', amount: 3_100_000, period: 'month' as const },
        ],
      }))
    })
    const s = schedule(p)
    let best = Infinity
    for (let r = 0; r < 5; r++) {
      const t = performance.now()
      computeCosts(p, s)
      best = Math.min(best, performance.now() - t)
    }
    expect(best).toBeLessThan(50)
  })
})
