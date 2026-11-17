/**
 * Šablona „Plánovaná odstávka a údržba“ (U-02, fáze 10): odstávka výroby kvůli generální opravě lisu,
 * výměně dílů a revizím – plánování, objednání dílů, výroba do zásoby, souběžné práce během odstávky
 * a bezpečný náběh výroby. Krátký projekt, kde se počítá každý den odstávky.
 *
 * Ukázky: odstávka začne, až je hotové všechno potřebné (díly, výroba do zásoby, povolení k práci);
 * během ní souběžné práce – SS s prodlevou (dopravník 2 dny po zahájení opravy lisu), FF (nátěry
 * skončí s opravou); průběžný náklad za pracovní den (přesčasy), stroje za den (pronájem jeřábu,
 * lešení), náhradní díly jako materiál, externí servis a rezerva na nalezené závady.
 *
 * Texty jsou v překladech pod templates.shutdown. Jména lidí jsou smyšlená. Peníze v Kč.
 */
import type { TemplateDef, TemplateLine, TemplateRow } from './template'

const ROWS: TemplateRow[] = [
  ['p1', 'phase', 0],
  ['t1a', 'task', 10],
  ['t1b', 'task', 5, [['t1a', 0]]],
  ['t1c', 'task', 5, [['t1b', 0]]],
  ['m1', 'milestone', 0, [['t1b', 0]]],
  ['p2', 'phase', 0],
  ['t2a', 'task', 20, [['t1c', 0]]],
  ['t2b', 'task', 10, [['m1', 0]]],
  ['t2c', 'task', 15, [['m1', 0]]],
  ['t2d', 'task', 5, [['t2b', 0]]],
  // Odstávka začne, až jsou díly na skladě, zásoba vyrobená a práce povolené.
  ['m2', 'milestone', 0, [['t2a', 0], ['t2c', 0], ['t2d', 0]]],
  ['p3', 'phase', 0],
  ['t3a', 'task', 2, [['m2', 0]]],
  ['t3b', 'task', 10, [['t3a', 0]]],
  // Dopravník se opravuje souběžně s lisem, 2 dny po zahájení opravy lisu.
  ['t3c', 'task', 5, [['t3b', 2, 'SS']]],
  ['t3d', 'task', 4, [['t3a', 0]]],
  // Čištění a nátěry skončí spolu s opravou lisu.
  ['t3e', 'task', 6, [['t3b', 0, 'FF']]],
  ['t3f', 'task', 3, [['t3b', 0], ['t3c', 0], ['t3d', 0], ['t3e', 0]]],
  ['m3', 'milestone', 0, [['t3f', 0]]],
  ['p4', 'phase', 0],
  ['t4a', 'task', 5, [['m3', 0]]],
  ['t4b', 'task', 3, [['t4a', 0]]],
  ['m4', 'milestone', 0, [['t4b', 0]]],
]

const LINES: Record<string, TemplateLine[]> = {
  p3: [['labor', 'maintManager', 'w1', 100]],
  t1a: [['labor', 'maintManager', 'w1', 50], ['labor', 'planner', 'w5', 25]],
  t1b: [['labor', 'maintManager', 'w1', 100], ['labor', 'planner', 'w5', 50]],
  t1c: [['labor', 'maintManager', 'w1', 50]],
  t2a: [
    ['material', 'bearings', 2],
    ['material', 'gearbox', 1],
    ['material', 'seals', 3],
    ['material', 'oil', 600],
    ['material', 'filter', 20],
  ],
  t2b: [['labor', 'maintManager', 'w1', 50], ['labor', 'safety', 'w7', 25]],
  t2c: [['labor', 'operator', 'w6', 100], ['labor', 'planner', 'w5', 50], ['recurring', 'overtime', 4_000, 'day']],
  t2d: [['labor', 'safety', 'w7', 100], ['labor', 'maintManager', 'w1', 25]],
  m2: [['oneTime', 'reserve', 150_000, 'start', 'reserve']],
  t3a: [['labor', 'mechanic', 'w2', 100], ['labor', 'mechanic', 'w3', 100], ['labor', 'operator', 'w6', 100]],
  t3b: [['labor', 'mechanic', 'w2', 100], ['machine', 'mobileCrane', 50], ['oneTime', 'pressService', 420_000, 'end', 'services']],
  t3c: [['labor', 'mechanic', 'w3', 100]],
  t3d: [['labor', 'electrician', 'w4', 100], ['oneTime', 'pressureInspection', 35_000, 'end', 'services']],
  t3e: [['labor', 'operator', 'w6', 100], ['machine', 'cleaner', 50], ['machine', 'scaffolding', 100], ['material', 'paint', 120]],
  t3f: [['labor', 'mechanic', 'w2', 100], ['labor', 'electrician', 'w4', 50], ['labor', 'operator', 'w6', 100], ['labor', 'safety', 'w7', 50]],
  t4a: [['labor', 'operator', 'w6', 100], ['labor', 'planner', 'w5', 50]],
  t4b: [['labor', 'maintManager', 'w1', 50], ['labor', 'safety', 'w7', 25], ['labor', 'planner', 'w5', 25]],
}

export const SHUTDOWN_TEMPLATE: TemplateDef = {
  keyPrefix: 'templates.shutdown',
  idPrefix: 'stop',
  rows: ROWS,
  departments: [
    ['ehs', '150'],
    ['maint', '310'],
    ['prod', '400'],
  ],
  professions: [
    { key: 'maintManager', category: 'labor', capacityPerDay: 8, calc: { wageKc: 68_000, overheadPct: 15 } },
    { key: 'mechanic', category: 'labor', capacityPerDay: 8, calc: { wageKc: 44_000, overheadPct: 10 } },
    { key: 'electrician', category: 'labor', capacityPerDay: 8, calc: { wageKc: 48_000, overheadPct: 10 } },
    { key: 'planner', category: 'labor', capacityPerDay: 8, calc: { wageKc: 50_000, overheadPct: 12 } },
    { key: 'operator', category: 'labor', capacityPerDay: 8, calc: { wageKc: 36_000, overheadPct: 10 } },
    { key: 'safety', category: 'labor', capacityPerDay: 8, calc: { wageKc: 52_000, overheadPct: 12 } },
  ],
  workers: [
    { key: 'w1', name: 'Libor Navrátil', profession: 'maintManager', department: 'maint', capacityPerDay: 8 },
    { key: 'w2', name: 'Jaroslav Říha', profession: 'mechanic', department: 'maint', capacityPerDay: 8 },
    { key: 'w3', name: 'Stanislav Tichý', profession: 'mechanic', department: 'maint', capacityPerDay: 8, calc: { wageKc: 46_000, overheadPct: 10 } },
    { key: 'w4', name: 'Ivana Bartošová', profession: 'electrician', department: 'maint', capacityPerDay: 8 },
    { key: 'w5', name: 'Monika Holubová', profession: 'planner', department: 'prod', capacityPerDay: 8 },
    { key: 'w6', name: 'Aleš Kříž', profession: 'operator', department: 'prod', capacityPerDay: 8 },
    { key: 'w7', name: 'Věra Šebestová', profession: 'safety', department: 'ehs', capacityPerDay: 8 },
  ],
  machines: [
    { key: 'mobileCrane', category: 'services', rateKc: 9_000, rateUnit: 'day', capacityPerDay: 8 },
    { key: 'cleaner', category: 'services', rateKc: 600, rateUnit: 'hour', capacityPerDay: 8 },
    { key: 'scaffolding', category: 'services', rateKc: 1_500, rateUnit: 'day', capacityPerDay: 8 },
  ],
  materials: [
    ['bearings', 'set', 24_000],
    ['gearbox', 'pcs', 86_000],
    ['seals', 'set', 18_500],
    ['oil', 'l', 95, 'HLP 46'],
    ['filter', 'pcs', 1_200],
    ['paint', 'l', 380],
  ],
  lines: LINES,
}
