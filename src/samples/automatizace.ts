/**
 * Vzorový projekt „Zavedení automatizace do výroby“ (ZADANI.md, kap. 11) – zjednodušená verze.
 * Názvy, typy, délky v pracovních dnech, vazby všech typů FS, SS, FF, SF (s prodlevou, fáze 4c)
 * a hierarchie: činnosti a milníky patří do fáze, která je v seznamu nad nimi.
 * Obsahuje i vzorovou databázi zdrojů (fáze 6a): střediska, profese a pracovníky se sazbami
 * (ruční, kalkulace, podle profese), stroje a materiály. Řádky zdrojů na činnostech přijdou ve fázi 6b.
 *
 * Názvy jsou v překladových souborech (sample.tasks.*, sample.resources.*), aby šel projekt
 * vytvořit v každém jazyce. Jména lidí jsou smyšlená. Peníze v haléřích.
 */
import { defaultCategoryId } from '../model/defaultCategories'
import { createDefaultRateCalc, type RateCalc } from '../model/rates'
import { createEmptyProject, createTask, type DependencyType, type Project, type TaskKind } from '../model/schema'

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
  return project
}
