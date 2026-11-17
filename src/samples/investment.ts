/**
 * Šablona „Investiční akce – výstavba skladové haly“ (U-02, fáze 10): od investičního záměru
 * a financování přes projektovou dokumentaci, stavební povolení a výběr zhotovitele až po výstavbu,
 * kolaudaci a zahájení provozu.
 *
 * Ukázky: souběh SS s prodlevou (inženýrská činnost, prováděcí dokumentace během povolování,
 * technika budovy během konstrukce), předstih FS−5 (podlahy se překrývají s opláštěním), dvě větve
 * před podpisem smlouvy (povolení a výběr zhotovitele); průběžná měsíční fakturace stavby na fázi,
 * záloha, pozastávka a rezerva na vícepráce; externí technický dozor s ruční sazbou.
 *
 * Texty jsou v překladech pod templates.investment. Jména lidí jsou smyšlená. Peníze v Kč.
 */
import type { TemplateDef, TemplateLine, TemplateRow } from './template'

const ROWS: TemplateRow[] = [
  ['p1', 'phase', 0],
  ['t1a', 'task', 10],
  ['t1b', 'task', 15, [['t1a', 0]]],
  ['m1', 'milestone', 0, [['t1b', 0]]],
  ['p2', 'phase', 0],
  ['t2a', 'task', 30, [['m1', 0]]],
  // Stanoviska úřadů se začnou sbírat, když je dokumentace rozpracovaná.
  ['t2b', 'task', 20, [['t2a', 15, 'SS']]],
  ['t2c', 'task', 40, [['t2a', 0], ['t2b', 0]]],
  ['m2', 'milestone', 0, [['t2c', 0]]],
  // Prováděcí dokumentace se dělá souběžně s povolováním (10 dní po jeho zahájení).
  ['t2d', 'task', 25, [['t2c', 10, 'SS']]],
  ['p3', 'phase', 0],
  ['t3a', 'task', 20, [['t2d', 0]]],
  // Smlouvu jde podepsat, až je vybraný zhotovitel a povolení nabylo právní moci.
  ['m3', 'milestone', 0, [['t3a', 0], ['m2', 0]]],
  ['p4', 'phase', 0],
  ['t4a', 'task', 5, [['m3', 0]]],
  ['t4b', 'task', 20, [['t4a', 0]]],
  ['t4c', 'task', 30, [['t4b', 0]]],
  // Podlahy začnou 5 pracovních dnů před dokončením opláštění (předstih).
  ['t4d', 'task', 15, [['t4c', -5]]],
  // Technika budovy (TZB) souběžně s konstrukcí, 15 dní po jejím zahájení.
  ['t4e', 'task', 25, [['t4c', 15, 'SS']]],
  ['m4', 'milestone', 0, [['t4d', 0], ['t4e', 0]]],
  ['p5', 'phase', 0],
  ['t5a', 'task', 10, [['m4', 0]]],
  ['t5b', 'task', 15, [['t5a', 0]]],
  ['m5', 'milestone', 0, [['t5b', 0]]],
  ['t5c', 'task', 5, [['m5', 0]]],
  ['m6', 'milestone', 0, [['t5c', 0]]],
]

/** Smlouva o dílo zhruba 20 mil. Kč: záloha, měsíční fakturace podle postupu prací, pozastávka po kolaudaci. */
const LINES: Record<string, TemplateLine[]> = {
  p4: [
    ['labor', 'pm', 'w1', 20],
    ['labor', 'engineer', 'w2', 50],
    ['labor', 'tdi', 'w3', 25],
    ['recurring', 'progressInvoices', 3_600_000, 'month'],
  ],
  t1a: [['labor', 'pm', 'w1', 50], ['labor', 'engineer', 'w2', 50], ['oneTime', 'study', 120_000, 'end', 'services']],
  t1b: [['labor', 'pm', 'w1', 50], ['oneTime', 'loanFee', 35_000, 'end', 'services']],
  t2a: [['labor', 'engineer', 'w2', 25], ['oneTime', 'designPermit', 380_000, 'end', 'services']],
  t2b: [['labor', 'engineer', 'w2', 50], ['oneTime', 'fees', 25_000, 'end', 'services']],
  t2c: [['labor', 'pm', 'w1', 10], ['labor', 'engineer', 'w2', 25]],
  t2d: [['labor', 'engineer', 'w2', 25], ['oneTime', 'designExecution', 290_000, 'end', 'services']],
  t3a: [['labor', 'pm', 'w1', 50], ['labor', 'engineer', 'w2', 50], ['oneTime', 'tenderAdmin', 60_000, 'end', 'services']],
  m3: [['oneTime', 'advance', 2_800_000, 'start', 'investment'], ['oneTime', 'reserve', 1_500_000, 'start', 'reserve']],
  t4a: [['labor', 'tdi', 'w3', 25]],
  t5a: [['labor', 'engineer', 'w2', 100], ['labor', 'tdi', 'w3', 50], ['labor', 'pm', 'w1', 30]],
  t5b: [['labor', 'pm', 'w1', 30], ['oneTime', 'approvalFees', 45_000, 'start', 'services']],
  m5: [['oneTime', 'retention', 1_400_000, 'start', 'investment']],
  t5c: [
    ['labor', 'logistics', 'w4', 100],
    ['labor', 'warehouse', 'w5', 100],
    ['labor', 'warehouse', 'w6', 100],
    ['machine', 'forklift', 100],
    ['machine', 'truck', 50],
    ['material', 'shelving', 40],
    ['material', 'pallet', 200],
    ['material', 'signage', 6],
    ['material', 'fireExtinguisher', 12],
  ],
}

export const INVESTMENT_TEMPLATE: TemplateDef = {
  keyPrefix: 'templates.investment',
  idPrefix: 'inv',
  rows: ROWS,
  departments: [
    ['inv', '120'],
    ['maint', '310'],
    ['log', '450'],
  ],
  professions: [
    { key: 'pm', category: 'labor', capacityPerDay: 8, calc: { wageKc: 78_000, overheadPct: 15 } },
    { key: 'engineer', category: 'labor', capacityPerDay: 8, calc: { wageKc: 58_000, overheadPct: 12 } },
    // Externí technický dozor investora – fakturovaná hodinová sazba.
    { key: 'tdi', category: 'services', capacityPerDay: 8, manualRateKc: 900 },
    { key: 'logistics', category: 'labor', capacityPerDay: 8, calc: { wageKc: 45_000, overheadPct: 10 } },
    { key: 'warehouse', category: 'labor', capacityPerDay: 8, calc: { wageKc: 34_000, overheadPct: 10 } },
  ],
  workers: [
    { key: 'w1', name: 'Tereza Vlčková', profession: 'pm', department: 'inv', capacityPerDay: 8 },
    { key: 'w2', name: 'Roman Šimek', profession: 'engineer', department: 'maint', capacityPerDay: 8 },
    { key: 'w3', name: 'Karel Moravec', profession: 'tdi', capacityPerDay: 8 },
    { key: 'w4', name: 'Petra Sýkorová', profession: 'logistics', department: 'log', capacityPerDay: 8 },
    { key: 'w5', name: 'Josef Kopecký', profession: 'warehouse', department: 'log', capacityPerDay: 8 },
    { key: 'w6', name: 'Marek Hruška', profession: 'warehouse', department: 'log', capacityPerDay: 8, calc: { wageKc: 36_000, overheadPct: 10 } },
  ],
  machines: [
    { key: 'forklift', category: 'services', rateKc: 450, rateUnit: 'hour', capacityPerDay: 8 },
    { key: 'truck', category: 'services', rateKc: 3_500, rateUnit: 'day', capacityPerDay: 8 },
  ],
  materials: [
    ['shelving', 'bay', 18_000],
    ['pallet', 'pcs', 350, 'EUR 1200x800'],
    ['signage', 'set', 4_500],
    ['fireExtinguisher', 'pcs', 1_100, 'PG6'],
  ],
  lines: LINES,
}
