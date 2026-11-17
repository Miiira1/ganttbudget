/**
 * Šablona „Vývoj nového výrobku“ (U-02, fáze 10): strojní výrobek (např. čerpadlo nebo převodovka)
 * od analýzy trhu přes konstrukci, prototyp a zkoušky až po přípravu sériové výroby.
 * Postup „stage-gate“: každou fázi uzavírá milník (brána), přes který se jde dál.
 *
 * Ukázky: vazby FS, SS s prodlevou (výpočty začnou 10 dní po zahájení modelu, životnostní zkouška
 * 3 dny po funkčních), FF (FMEA skončí s modelem); lidé s kalkulací i ruční sazbou, stroj za hodinu
 * i za den, materiál, externí služby, investice a rezerva.
 *
 * Texty jsou v překladech pod templates.productDevelopment. Jména lidí jsou smyšlená. Peníze v Kč.
 */
import type { TemplateDef, TemplateLine, TemplateRow } from './template'

const ROWS: TemplateRow[] = [
  ['p1', 'phase', 0],
  ['t1a', 'task', 10],
  ['t1b', 'task', 5, [['t1a', 0]]],
  ['t1c', 'task', 10, [['t1b', 0]]],
  ['m1', 'milestone', 0, [['t1c', 0]]],
  ['p2', 'phase', 0],
  ['t2a', 'task', 25, [['m1', 0]]],
  // Výpočty začnou, až je model rozpracovaný (10 dní po jeho zahájení).
  ['t2b', 'task', 10, [['t2a', 10, 'SS']]],
  // Analýza rizik (FMEA) běží souběžně a skončí spolu s modelem.
  ['t2c', 'task', 5, [['t2a', 0, 'FF']]],
  ['m2', 'milestone', 0, [['t2a', 0], ['t2b', 0], ['t2c', 0]]],
  ['p3', 'phase', 0],
  ['t3a', 'task', 10, [['m2', 0]]],
  ['t3b', 'task', 15, [['t3a', 0]]],
  ['t3c', 'task', 5, [['t3b', 0]]],
  ['m3', 'milestone', 0, [['t3c', 0]]],
  ['p4', 'phase', 0],
  ['t4a', 'task', 10, [['m3', 0]]],
  // Životnostní zkouška v externí zkušebně začne 3 dny po funkčních zkouškách.
  ['t4b', 'task', 20, [['t4a', 3, 'SS']]],
  ['t4c', 'task', 10, [['t4a', 0]]],
  ['t4d', 'task', 10, [['t4b', 0], ['t4c', 0]]],
  ['m4', 'milestone', 0, [['t4d', 0]]],
  ['p5', 'phase', 0],
  ['t5a', 'task', 15, [['m4', 0]]],
  // Přípravky a nástroje se začnou vyrábět, jakmile jsou první postupy (5 dní po zahájení).
  ['t5b', 'task', 20, [['t5a', 5, 'SS']]],
  ['t5c', 'task', 10, [['t5a', 0], ['t5b', 0]]],
  ['m5', 'milestone', 0, [['t5c', 0]]],
]

const LINES: Record<string, TemplateLine[]> = {
  p3: [['labor', 'pm', 'w1', 20]],
  p4: [['labor', 'pm', 'w1', 20]],
  p5: [['labor', 'pm', 'w1', 20]],
  t1a: [['labor', 'pm', 'w1', 50], ['oneTime', 'marketStudy', 60_000, 'end', 'services']],
  t1b: [['labor', 'pm', 'w1', 50], ['labor', 'designer', 'w2', 50]],
  t1c: [['labor', 'designer', 'w2', 100], ['labor', 'designer', 'w3', 50], ['machine', 'printer', 25]],
  t2a: [['labor', 'designer', 'w2', 100], ['labor', 'designer', 'w3', 100]],
  t2b: [['labor', 'analyst', 'w4', 100], ['oneTime', 'software', 40_000, 'start', 'services']],
  t2c: [['labor', 'pm', 'w1', 50], ['labor', 'technologist', 'w5', 50]],
  t3a: [
    ['labor', 'technologist', 'w5', 50],
    ['material', 'steel', 120],
    ['material', 'aluminium', 40],
    ['material', 'bearing', 8],
    ['material', 'seal', 4],
    ['material', 'electronics', 2],
    ['material', 'fasteners', 3],
  ],
  t3b: [['labor', 'machinist', 'w7', 100], ['machine', 'cnc', 75]],
  t3c: [['labor', 'machinist', 'w7', 50], ['labor', 'tester', 'w6', 50], ['labor', 'designer', 'w3', 25]],
  t4a: [['labor', 'tester', 'w6', 100], ['labor', 'designer', 'w2', 25], ['machine', 'testbench', 100]],
  t4b: [['oneTime', 'externalTest', 180_000, 'end', 'services']],
  t4c: [['labor', 'designer', 'w2', 100], ['labor', 'designer', 'w3', 50], ['material', 'steel', 30], ['material', 'fasteners', 1]],
  t4d: [['labor', 'pm', 'w1', 30], ['oneTime', 'certification', 95_000, 'end', 'services']],
  m4: [['oneTime', 'reserve', 200_000, 'start', 'reserve']],
  t5a: [['labor', 'technologist', 'w5', 100], ['labor', 'designer', 'w3', 25]],
  t5b: [['labor', 'machinist', 'w7', 100], ['machine', 'cnc', 50], ['material', 'steel', 80], ['oneTime', 'tooling', 120_000, 'start', 'investment']],
  t5c: [
    ['labor', 'machinist', 'w7', 100],
    ['labor', 'technologist', 'w5', 50],
    ['labor', 'tester', 'w6', 50],
    ['machine', 'cnc', 75],
    ['material', 'steel', 200],
    ['material', 'aluminium', 60],
    ['material', 'bearing', 50],
    ['material', 'seal', 25],
    ['material', 'electronics', 25],
    ['material', 'fasteners', 10],
  ],
  m5: [['oneTime', 'launch', 150_000, 'start', 'services']],
}

export const PRODUCT_DEVELOPMENT_TEMPLATE: TemplateDef = {
  keyPrefix: 'templates.productDevelopment',
  idPrefix: 'prod',
  rows: ROWS,
  departments: [
    ['dev', '220'],
    ['test', '230'],
    ['prod', '400'],
  ],
  professions: [
    { key: 'pm', category: 'labor', capacityPerDay: 8, calc: { wageKc: 72_000, overheadPct: 15 } },
    { key: 'designer', category: 'labor', capacityPerDay: 8, calc: { wageKc: 60_000, overheadPct: 15 } },
    { key: 'analyst', category: 'labor', capacityPerDay: 8, calc: { wageKc: 65_000, overheadPct: 15 } },
    { key: 'technologist', category: 'labor', capacityPerDay: 8, calc: { wageKc: 55_000, overheadPct: 12 } },
    { key: 'tester', category: 'labor', capacityPerDay: 8, calc: { wageKc: 45_000, overheadPct: 12 } },
    { key: 'machinist', category: 'labor', capacityPerDay: 8, calc: { wageKc: 42_000, overheadPct: 10 } },
  ],
  workers: [
    { key: 'w1', name: 'Kateřina Malá', profession: 'pm', department: 'dev', capacityPerDay: 8 },
    { key: 'w2', name: 'Jiří Novotný', profession: 'designer', department: 'dev', capacityPerDay: 8, calc: { wageKc: 64_000, overheadPct: 15 } },
    { key: 'w3', name: 'Ondřej Marek', profession: 'designer', department: 'dev', capacityPerDay: 8 },
    // Externí výpočtář – fakturovaná hodinová sazba.
    { key: 'w4', name: 'Lenka Pokorná', profession: 'analyst', department: 'dev', capacityPerDay: 8, manualRateKc: 850 },
    { key: 'w5', name: 'Radek Beneš', profession: 'technologist', department: 'prod', capacityPerDay: 8 },
    { key: 'w6', name: 'Michal Krejčí', profession: 'tester', department: 'test', capacityPerDay: 8 },
    { key: 'w7', name: 'Zdeněk Fiala', profession: 'machinist', department: 'prod', capacityPerDay: 8 },
  ],
  machines: [
    { key: 'cnc', category: 'services', rateKc: 1_200, rateUnit: 'hour', capacityPerDay: 8 },
    { key: 'testbench', category: 'services', rateKc: 3_000, rateUnit: 'day', capacityPerDay: 8 },
    { key: 'printer', category: 'services', rateKc: 400, rateUnit: 'hour', capacityPerDay: 8 },
  ],
  materials: [
    ['steel', 'kg', 45, '11 523'],
    ['aluminium', 'kg', 120, 'EN AW-6082'],
    ['bearing', 'pcs', 850, '6205-2RS'],
    ['seal', 'set', 450],
    ['electronics', 'pcs', 6_500],
    ['fasteners', 'set', 900],
  ],
  lines: LINES,
}
