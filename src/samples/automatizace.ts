/**
 * Vzorový projekt „Zavedení automatizace do výroby“ (ZADANI.md, kap. 11) – zjednodušená verze.
 * Názvy, typy, délky v pracovních dnech, vazby všech typů FS, SS, FF, SF (s prodlevou, fáze 4c)
 * a hierarchie: činnosti a milníky patří do fáze, která je v seznamu nad nimi.
 * Obsahuje i vzorovou databázi zdrojů (fáze 6a): střediska, profese a pracovníky se sazbami
 * (ruční, kalkulace, podle profese), stroje a materiály, a zdroje a náklady na činnostech (fáze 6b).
 *
 * Fáze 9: addSampleTracking z něj udělá rozběhnutý projekt (baseline, % hotovo, skutečné náklady).
 *
 * Názvy jsou v překladových souborech (sample.tasks.*, sample.resources.*), aby šel projekt
 * vytvořit v každém jazyce. Jména lidí jsou smyšlená. Peníze v haléřích.
 */
import { dayToIso, isoToDay } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import { baselineBac, createBaseline } from '../model/baseline'
import { rollupPercent } from '../model/earnedValue'
import { computeCostTimeline } from '../model/costTimeline'
import { computeCosts } from '../model/costs'
import { defaultCategoryId } from '../model/defaultCategories'
import { createDefaultRateCalc, type RateCalc } from '../model/rates'
import { createEmptyProject, createTask, type DependencyType, type Project, type TaskKind, type TaskLine } from '../model/schema'

/** [klíč, typ, délka v pracovních dnech, předchůdci jako [klíč, prodleva, typ vazby (výchozí FS)]] */
type Row = [key: string, kind: TaskKind, durationDays: number, predecessors?: [string, number, DependencyType?][]]

const ROWS: Row[] = [
  ['p1', 'phase', 0],
  ['t1a', 'task', 10],
  ['t1b', 'task', 15, [['t1a', 0]]],
  ['p2', 'phase', 0],
  ['t2a', 'task', 10, [['t1b', 0]]],
  ['t2b', 'task', 20, [['t2a', 0]]],
  ['m2', 'milestone', 0, [['t2b', 0]]],
  ['p3', 'phase', 0],
  ['t3a', 'task', 15, [['m2', 0]]],
  ['t3b', 'task', 25, [['t3a', 0]]],
  ['p4', 'phase', 0],
  ['t4a', 'task', 40, [['t3b', 0]]],
  // Programování začne týden po dokončení konstrukce a skončí spolu s výrobou zařízení (FF).
  ['t4b', 'task', 20, [['t3b', 5], ['t4a', 0, 'FF']]],
  ['m4', 'milestone', 0, [['t4a', 0], ['t4b', 0]]],
  ['p5', 'phase', 0],
  // Hala se připravuje souběžně s výrobou: začne 10 pracovních dnů po jejím zahájení (SS+10).
  ['t5a', 'task', 10, [['t4a', 10, 'SS']]],
  ['t5b', 'task', 8, [['t5a', 0]]],
  ['t5c', 'task', 5, [['t5b', 0]]],
  ['p6', 'phase', 0],
  ['t6a', 'task', 10, [['m4', 0], ['t5c', 0]]],
  ['t6b', 'task', 8, [['t6a', 0]]],
  // Náhradní ruční výroba musí běžet, dokud nezačne zkušební provoz (SF).
  ['t6c', 'task', 10, [['t7b', 0, 'SF']]],
  ['m6', 'milestone', 0, [['t6b', 0]]],
  ['p7', 'phase', 0],
  ['t7a', 'task', 5, [['m6', 0]]],
  ['t7b', 'task', 20, [['t7a', 0]]],
  ['p8', 'phase', 0],
  ['t8a', 'task', 5, [['t7b', 0]]],
  ['m8', 'milestone', 0, [['t8a', 0]]],
]

const idOf = (key: string) => `sample-${key}`

/** Kalkulace sazby: hrubá měsíční mzda v Kč a režie v % z mzdy. */
const calc = (monthlyWageKc: number, overheadPct: number): RateCalc => ({
  ...createDefaultRateCalc(),
  monthlyWage: monthlyWageKc * 100,
  overheadMode: 'percent',
  overheadValue: overheadPct,
})

/** Vzorová databáze zdrojů. */
function addSampleResources(project: Project, translate: (key: string) => string): void {
  const name = (key: string) => translate(`sample.resources.${key}`)
  const labor = defaultCategoryId('labor')
  project.departments = [
    { id: 'sample-d-pm', name: name('departments.pm'), code: '100' },
    { id: 'sample-d-eng', name: name('departments.eng'), code: '210' },
    { id: 'sample-d-maint', name: name('departments.maint'), code: '310' },
    { id: 'sample-d-prod', name: name('departments.prod'), code: '400' },
  ]
  project.professions = [
    { id: 'sample-pr-pm', name: name('professions.pm'), categoryId: labor, capacityPerDay: 8, rateCalc: calc(75_000, 15) },
    { id: 'sample-pr-designer', name: name('professions.designer'), categoryId: labor, capacityPerDay: 8, rateCalc: calc(62_000, 15) },
    { id: 'sample-pr-plc', name: name('professions.plc'), categoryId: labor, capacityPerDay: 8, rateCalc: calc(68_000, 15) },
    // Externí elektrikáři – fakturovaná hodinová sazba dodavatele.
    { id: 'sample-pr-electrician', name: name('professions.electrician'), categoryId: defaultCategoryId('services'), capacityPerDay: 8, manualRate: 52_000 },
    { id: 'sample-pr-fitter', name: name('professions.fitter'), categoryId: labor, capacityPerDay: 8, rateCalc: calc(42_000, 10) },
    { id: 'sample-pr-operator', name: name('professions.operator'), categoryId: labor, capacityPerDay: 8, rateCalc: calc(38_000, 10) },
  ]
  project.workers = [
    { id: 'sample-w1', name: 'Jana Dvořáková', professionId: 'sample-pr-pm', departmentId: 'sample-d-pm', capacityPerDay: 8 },
    { id: 'sample-w2', name: 'Petr Svoboda', professionId: 'sample-pr-designer', departmentId: 'sample-d-eng', capacityPerDay: 8, rateCalc: calc(66_000, 15) },
    { id: 'sample-w3', name: 'Lukáš Černý', professionId: 'sample-pr-plc', departmentId: 'sample-d-eng', capacityPerDay: 8 },
    { id: 'sample-w4', name: 'Tomáš Procházka', professionId: 'sample-pr-electrician', departmentId: 'sample-d-maint', capacityPerDay: 8 },
    { id: 'sample-w5', name: 'Martin Kučera', professionId: 'sample-pr-fitter', departmentId: 'sample-d-maint', capacityPerDay: 8 },
    { id: 'sample-w6', name: 'Pavel Veselý', professionId: 'sample-pr-fitter', departmentId: 'sample-d-prod', capacityPerDay: 6 },
    { id: 'sample-w7', name: 'Eva Horáková', professionId: 'sample-pr-operator', departmentId: 'sample-d-prod', capacityPerDay: 8, manualRate: 33_000 },
  ]
  const services = defaultCategoryId('services')
  project.machines = [
    { id: 'sample-m-crane', name: name('machines.crane'), categoryId: services, rate: 180_000, rateUnit: 'hour', capacityPerDay: 8 },
    { id: 'sample-m-platform', name: name('machines.platform'), categoryId: services, rate: 250_000, rateUnit: 'day', capacityPerDay: 8 },
    { id: 'sample-m-welder', name: name('machines.welder'), categoryId: services, rate: 15_000, rateUnit: 'hour', capacityPerDay: 8 },
  ]
  const material = defaultCategoryId('material')
  /** [klíč, jednotka, cena v Kč, kód] */
  const MATERIALS: [string, string, number, string?][] = [
    ['cablePower', 'm', 65, 'CYKY-J 5x2,5'],
    ['cableSignal', 'm', 38.5],
    ['tray', 'm', 245],
    ['sensor', 'pcs', 1_290, 'IS-M18'],
    ['lightCurtain', 'pcs', 18_900],
    ['cabinet', 'pcs', 32_500],
    ['fasteners', 'set', 1_850],
    ['profile', 'm', 420, '45x45'],
    ['cylinder', 'pcs', 3_450],
  ]
  project.materials = MATERIALS.map(([key, unit, priceKc, code]) => ({
    id: `sample-x-${key}`,
    name: name(`materials.${key}`),
    unit: name(`units.${unit}`),
    unitPrice: Math.round(priceKc * 100),
    categoryId: material,
    ...(code ? { code } : {}),
  }))
}

/**
 * @param translate funkce překladu (t z i18next) – vrací text podle klíče
 * @param language jazyk obsahu projektu
 */
export function createSampleProject(translate: (key: string) => string, language: string, startDate?: string): Project {
  const project = createEmptyProject({ name: translate('sample.projectName'), language, startDate })
  let phaseId: string | null = null
  const counters = new Map<string | null, number>()
  project.tasks = ROWS.map(([key, kind, durationDays, predecessors = []]) => {
    // Fáze je na nejvyšší úrovni, ostatní položky patří do poslední fáze nad nimi.
    const parentId = kind === 'phase' ? null : phaseId
    if (kind === 'phase') phaseId = idOf(key)
    const order = counters.get(parentId) ?? 0
    counters.set(parentId, order + 1)
    return {
      ...createTask({ id: idOf(key), name: translate(`sample.tasks.${key}`), order, kind, durationDays }),
      parentId,
      dependencies: predecessors.map(([pred, lagDays, type = 'FS']) => ({ predecessorId: idOf(pred), type, lagDays })),
    }
  })
  addSampleResources(project, translate)
  addSampleLines(project, translate)
  return project
}

/**
 * Zdroje a náklady činností (fáze 6b). Zápis řádku:
 *  ['labor', profese, pracovník | null, %] · ['machine', stroj, %] · ['material', materiál, množství]
 *  ['oneTime', klíč názvu, Kč, kdy, kategorie] · ['recurring', klíč názvu, Kč, období]
 * Smlouva s dodavatelem pracoviště 4,5 mil. Kč: záloha 30 % při podpisu, doplatek při předání.
 */
type SampleLine =
  | ['labor', string, string | null, number]
  | ['machine', string, number]
  | ['material', string, number]
  | ['oneTime', string, number, 'start' | 'end', 'services' | 'investment']
  | ['recurring', string, number, 'day' | 'week' | 'month']

const SAMPLE_LINES: Record<string, SampleLine[]> = {
  p1: [['labor', 'pm', 'sample-w1', 20]],
  t1a: [['labor', 'designer', 'sample-w2', 50]],
  t1b: [['labor', 'pm', 'sample-w1', 50], ['labor', 'designer', 'sample-w2', 30]],
  t2a: [['labor', 'pm', 'sample-w1', 50]],
  t2b: [['labor', 'pm', 'sample-w1', 30], ['oneTime', 'consultant', 45_000, 'end', 'services']],
  m2: [['oneTime', 'deposit', 1_350_000, 'start', 'investment']],
  t3a: [['labor', 'designer', 'sample-w2', 100]],
  t3b: [['labor', 'designer', 'sample-w2', 100], ['labor', 'plc', 'sample-w3', 50]],
  t4a: [
    ['material', 'sensor', 24],
    ['material', 'lightCurtain', 2],
    ['material', 'cabinet', 1],
    ['material', 'profile', 60],
    ['material', 'cylinder', 8],
    ['material', 'fasteners', 10],
  ],
  t4b: [['labor', 'plc', 'sample-w3', 100]],
  m4: [['oneTime', 'travel', 18_000, 'start', 'services']],
  t5a: [['oneTime', 'floor', 280_000, 'end', 'services']],
  t5b: [
    ['labor', 'electrician', 'sample-w4', 100],
    ['labor', 'fitter', 'sample-w5', 50],
    ['machine', 'platform', 50],
    ['material', 'cablePower', 180],
    ['material', 'cableSignal', 120],
    ['material', 'tray', 45],
  ],
  t5c: [['labor', 'fitter', 'sample-w5', 100], ['machine', 'welder', 50], ['material', 'profile', 40], ['material', 'fasteners', 5]],
  t6a: [
    ['labor', 'fitter', 'sample-w5', 100],
    ['labor', 'fitter', 'sample-w6', 100],
    ['labor', 'electrician', 'sample-w4', 50],
    ['machine', 'crane', 25],
    ['recurring', 'container', 6_000, 'week'],
  ],
  t6b: [['labor', 'plc', 'sample-w3', 100], ['labor', 'electrician', 'sample-w4', 50]],
  t6c: [['labor', 'operator', 'sample-w7', 100], ['labor', 'operator', null, 100]],
  t7a: [['oneTime', 'training', 35_000, 'end', 'services'], ['labor', 'operator', 'sample-w7', 50]],
  t7b: [['labor', 'operator', 'sample-w7', 100], ['labor', 'pm', 'sample-w1', 20], ['recurring', 'support', 25_000, 'month']],
  t8a: [['labor', 'pm', 'sample-w1', 50]],
  m8: [['oneTime', 'finalPayment', 3_150_000, 'start', 'investment']],
}

function addSampleLines(project: Project, translate: (key: string) => string): void {
  const categoryOf = (catalog: { id: string; categoryId: string }[], id: string) => catalog.find((x) => x.id === id)?.categoryId ?? defaultCategoryId('services')
  project.tasks = project.tasks.map((task) => {
    const key = task.id.replace(/^sample-/, '')
    const lines: TaskLine[] = (SAMPLE_LINES[key] ?? []).map((spec, i): TaskLine => {
      const id = `sample-l-${key}-${i + 1}`
      switch (spec[0]) {
        case 'labor': {
          const professionId = `sample-pr-${spec[1]}`
          return {
            id,
            kind: 'labor',
            categoryId: categoryOf(project.professions, professionId),
            professionId,
            ...(spec[2] ? { workerId: spec[2] } : {}),
            sharePct: spec[3],
          }
        }
        case 'machine': {
          const machineId = `sample-m-${spec[1]}`
          return { id, kind: 'machine', categoryId: categoryOf(project.machines, machineId), machineId, sharePct: spec[2] }
        }
        case 'material': {
          const materialId = `sample-x-${spec[1]}`
          return { id, kind: 'material', categoryId: categoryOf(project.materials, materialId), materialId, quantity: spec[2] }
        }
        case 'oneTime':
          return {
            id,
            kind: 'oneTime',
            categoryId: defaultCategoryId(spec[4]),
            name: translate(`sample.lines.${spec[1]}`),
            amount: spec[2] * 100,
            timing: spec[3],
          }
        case 'recurring':
          return { id, kind: 'recurring', categoryId: defaultCategoryId('services'), name: translate(`sample.lines.${spec[1]}`), amount: spec[2] * 100, period: spec[3] }
      }
    })
    return lines.length > 0 ? { ...task, lines } : task
  })
}

/**
 * Vzorový projekt „v běhu“ (fáze 9): baseline uložená k začátku projektu, % hotovo a skutečné
 * náklady do včerejška – aby pohled Sledování měl co ukázat. Práce je zhruba o týden pozadu
 * (% hotovo podle uplynulého času před 7 dny). Skutečnost = hodnota hotové práce (EV) o 6 %
 * dráž (milníky přesně), jedna souhrnná položka na položku k jejímu konci, nejpozději včera.
 * Volá se po createSampleProject se začátkem v minulosti.
 */
/** O kolik dní je práce ve vzorovém projektu pozadu. */
const SAMPLE_DELAY_DAYS = 7

export function addSampleTracking(project: Project, translate: (key: string) => string, today: string): void {
  const scheduled = schedule(project)
  const snapshot = createBaseline(project, scheduled, computeCostTimeline(project, scheduled, computeCosts(project, scheduled)), project.startDate)
  const id = 'sample-baseline'
  const baseline = { id, name: translate('sample.baselineName'), ...snapshot }
  project.baselines = [baseline]
  project.activeBaselineId = id
  const yesterday = isoToDay(today) - 1
  const progressDay = isoToDay(today) - SAMPLE_DELAY_DAYS
  for (const task of project.tasks) {
    const s = scheduled.tasks.get(task.id)
    if (task.kind === 'phase' || !s?.start || !s.finish) continue
    const startDay = isoToDay(s.start)
    const finishDay = isoToDay(s.finish)
    const fraction = finishDay < progressDay ? 1 : startDay >= progressDay ? 0 : (progressDay - startDay) / (finishDay - startDay + 1)
    task.percentComplete = fraction >= 1 ? 100 : task.kind === 'milestone' ? 0 : Math.round((fraction * 100) / 5) * 5
  }
  const bac = baselineBac(baseline)
  const percent = rollupPercent(project, bac)
  let seq = 0
  for (const task of project.tasks) {
    const s = scheduled.tasks.get(task.id)
    const ev = Math.round(((bac.get(task.id) ?? 0) * (percent.get(task.id) ?? 0)) / 100)
    if (ev <= 0 || !s?.finish) continue
    const factor = task.kind === 'milestone' ? 1 : 1.06
    task.actuals = [{ id: `sample-a${++seq}`, date: dayToIso(Math.min(isoToDay(s.finish), yesterday)), amount: Math.round((ev * factor) / 100) * 100 }]
  }
}
