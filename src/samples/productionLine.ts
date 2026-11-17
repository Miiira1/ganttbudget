/**
 * Šablona „Zavedení nové výrobní linky“ (U-02, fáze 10): montážní nebo obráběcí linka od investičního
 * záměru přes výběr dodavatele, přípravu haly, instalaci a přejímky FAT / SAT až po náběh výroby.
 *
 * Ukázky: SS s prodlevou (hala se začne vyklízet 35 dní po zahájení výroby linky u dodavatele,
 * rozvody 5 dní po zahájení stavebních prací), předstih FS−5 (školení obsluhy začne 5 dní před koncem
 * oživení), FF (validace kvality skončí se zkušebním provozem); platby dodavateli v milnících
 * (záloha, platba po FAT, doplatek po předání), průběžná podpora dodavatele za týden, rezerva.
 *
 * Texty jsou v překladech pod templates.productionLine. Jména lidí jsou smyšlená. Peníze v Kč.
 */
import type { TemplateDef, TemplateLine, TemplateRow } from './template'

const ROWS: TemplateRow[] = [
  ['p1', 'phase', 0],
  ['t1a', 'task', 10],
  ['t1b', 'task', 5, [['t1a', 0]]],
  ['m1', 'milestone', 0, [['t1b', 0]]],
  ['p2', 'phase', 0],
  ['t2a', 'task', 10, [['m1', 0]]],
  ['t2b', 'task', 10, [['t2a', 0]]],
  ['m2', 'milestone', 0, [['t2b', 0]]],
  ['p3', 'phase', 0],
  ['t3a', 'task', 60, [['m2', 0]]],
  ['t3b', 'task', 3, [['t3a', 0]]],
  ['m3', 'milestone', 0, [['t3b', 0]]],
  ['p4', 'phase', 0],
  // Hala se začne vyklízet, až dodavatel linku rozpracuje (35 dní po zahájení výroby).
  ['t4a', 'task', 8, [['t3a', 35, 'SS']]],
  ['t4b', 'task', 15, [['t4a', 0]]],
  // Rozvody energií souběžně se stavebními úpravami, 5 dní po jejich zahájení.
  ['t4c', 'task', 10, [['t4b', 5, 'SS']]],
  ['m4', 'milestone', 0, [['t4b', 0], ['t4c', 0]]],
  ['p5', 'phase', 0],
  ['t5a', 'task', 5, [['m3', 0], ['m4', 0]]],
  ['t5b', 'task', 15, [['t5a', 0]]],
  ['t5c', 'task', 10, [['t5b', 0]]],
  ['t5d', 'task', 3, [['t5c', 0]]],
  ['m5', 'milestone', 0, [['t5d', 0]]],
  ['p6', 'phase', 0],
  // Školení obsluhy začne 5 pracovních dnů před koncem oživení (předstih).
  ['t6a', 'task', 10, [['t5c', -5]]],
  ['t6b', 'task', 20, [['m5', 0], ['t6a', 0]]],
  // Validace kvality (PPAP) skončí spolu se zkušebním provozem.
  ['t6c', 'task', 10, [['t6b', 0, 'FF']]],
  ['m6', 'milestone', 0, [['t6b', 0], ['t6c', 0]]],
]

/** Smlouva na linku 12 mil. Kč: záloha 30 % při podpisu, 60 % po FAT, doplatek 10 % po předání. */
const LINES: Record<string, TemplateLine[]> = {
  p3: [['labor', 'pm', 'w1', 10]],
  p5: [['labor', 'pm', 'w1', 20]],
  p6: [['labor', 'pm', 'w1', 20]],
  t1a: [['labor', 'pm', 'w1', 50], ['labor', 'processEng', 'w2', 100]],
  t1b: [['labor', 'pm', 'w1', 100]],
  t2a: [['labor', 'processEng', 'w2', 100], ['labor', 'pm', 'w1', 30]],
  t2b: [['labor', 'pm', 'w1', 50], ['labor', 'processEng', 'w2', 50], ['labor', 'quality', 'w7', 25]],
  m2: [['oneTime', 'deposit', 3_600_000, 'start', 'investment']],
  t3b: [['labor', 'processEng', 'w2', 100], ['labor', 'quality', 'w7', 100], ['labor', 'maintTech', 'w3', 50], ['oneTime', 'travelFat', 25_000, 'start', 'services']],
  m3: [['oneTime', 'fatPayment', 7_200_000, 'start', 'investment']],
  t4a: [['labor', 'maintTech', 'w3', 100], ['machine', 'forklift', 50], ['oneTime', 'disposal', 60_000, 'end', 'services']],
  t4b: [['labor', 'pm', 'w1', 25], ['oneTime', 'construction', 450_000, 'end', 'services'], ['material', 'concrete', 25], ['material', 'anchor', 10]],
  t4c: [['labor', 'electrician', 'w4', 100], ['labor', 'maintTech', 'w3', 50], ['machine', 'scissorLift', 50], ['material', 'cable', 400], ['material', 'pipe', 150]],
  t5a: [['labor', 'maintTech', 'w3', 100], ['machine', 'forklift', 100], ['machine', 'crane', 50]],
  t5b: [['labor', 'maintTech', 'w3', 100], ['labor', 'electrician', 'w4', 100], ['labor', 'processEng', 'w2', 50], ['machine', 'scissorLift', 100], ['material', 'guard', 30]],
  t5c: [['labor', 'processEng', 'w2', 100], ['labor', 'electrician', 'w4', 50], ['labor', 'maintTech', 'w3', 50], ['material', 'testMaterial', 200]],
  t5d: [['labor', 'quality', 'w7', 100], ['labor', 'pm', 'w1', 50]],
  m5: [['oneTime', 'reserve', 400_000, 'start', 'reserve']],
  t6a: [['labor', 'operator', 'w5', 100], ['labor', 'operator', 'w6', 100], ['labor', 'maintTech', 'w3', 50], ['oneTime', 'training', 80_000, 'end', 'services']],
  t6b: [
    ['labor', 'operator', 'w5', 100],
    ['labor', 'operator', 'w6', 100],
    ['labor', 'processEng', 'w2', 50],
    ['material', 'testMaterial', 1_500],
    ['recurring', 'supplierSupport', 15_000, 'week'],
  ],
  t6c: [['labor', 'quality', 'w7', 100], ['labor', 'processEng', 'w2', 25]],
  m6: [['oneTime', 'finalPayment', 1_200_000, 'start', 'investment']],
}

export const PRODUCTION_LINE_TEMPLATE: TemplateDef = {
  keyPrefix: 'templates.productionLine',
  idPrefix: 'line',
  rows: ROWS,
  departments: [
    ['tech', '200'],
    ['quality', '250'],
    ['maint', '310'],
    ['prod', '400'],
  ],
  professions: [
    { key: 'pm', category: 'labor', capacityPerDay: 8, calc: { wageKc: 74_000, overheadPct: 15 } },
    { key: 'processEng', category: 'labor', capacityPerDay: 8, calc: { wageKc: 56_000, overheadPct: 12 } },
    { key: 'quality', category: 'labor', capacityPerDay: 8, calc: { wageKc: 58_000, overheadPct: 12 } },
    { key: 'maintTech', category: 'labor', capacityPerDay: 8, calc: { wageKc: 46_000, overheadPct: 10 } },
    { key: 'electrician', category: 'labor', capacityPerDay: 8, calc: { wageKc: 44_000, overheadPct: 10 } },
    { key: 'operator', category: 'labor', capacityPerDay: 8, calc: { wageKc: 36_000, overheadPct: 10 } },
  ],
  workers: [
    { key: 'w1', name: 'Barbora Šťastná', profession: 'pm', department: 'tech', capacityPerDay: 8 },
    { key: 'w2', name: 'Daniel Kolář', profession: 'processEng', department: 'tech', capacityPerDay: 8 },
    { key: 'w3', name: 'Filip Urban', profession: 'maintTech', department: 'maint', capacityPerDay: 8 },
    { key: 'w4', name: 'Vojtěch Hájek', profession: 'electrician', department: 'maint', capacityPerDay: 8 },
    { key: 'w5', name: 'Simona Králová', profession: 'operator', department: 'prod', capacityPerDay: 8 },
    { key: 'w6', name: 'Adam Jelínek', profession: 'operator', department: 'prod', capacityPerDay: 8, calc: { wageKc: 38_000, overheadPct: 10 } },
    { key: 'w7', name: 'Hana Doležalová', profession: 'quality', department: 'quality', capacityPerDay: 8 },
  ],
  machines: [
    { key: 'forklift', category: 'services', rateKc: 450, rateUnit: 'hour', capacityPerDay: 8 },
    { key: 'crane', category: 'services', rateKc: 2_200, rateUnit: 'hour', capacityPerDay: 8 },
    { key: 'scissorLift', category: 'services', rateKc: 1_800, rateUnit: 'day', capacityPerDay: 8 },
  ],
  materials: [
    ['concrete', 'm3', 3_200, 'C25/30'],
    ['anchor', 'set', 1_500],
    ['cable', 'm', 95, 'CYKY-J 5x10'],
    ['pipe', 'm', 210],
    ['guard', 'm', 2_400],
    ['testMaterial', 'kg', 60],
  ],
  lines: LINES,
}
