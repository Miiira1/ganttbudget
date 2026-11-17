/**
 * Vzorový projekt „Zavedení automatizace do výroby“ (ZADANI.md, kap. 11) – zjednodušená verze.
 * Názvy, typy, délky v pracovních dnech, vazby všech typů FS, SS, FF, SF (s prodlevou, fáze 4c)
 * a hierarchie: činnosti a milníky patří do fáze, která je v seznamu nad nimi.
 * Obsahuje i vzorovou databázi zdrojů (fáze 6a): střediska, profese a pracovníky se sazbami
 * (ruční, kalkulace, podle profese), stroje a materiály, a zdroje a náklady na činnostech (fáze 6b).
 *
 * Fáze 9: addSampleTracking z něj udělá rozběhnutý projekt (baseline, % hotovo, skutečné náklady).
 *
 * Fáze 10: popis dat je šablona (AUTOMATION_TEMPLATE), projekt z ní staví společný buildTemplate (template.ts).
 *
 * Názvy jsou v překladových souborech (sample.tasks.*, sample.resources.*), aby šel projekt
 * vytvořit v každém jazyce. Jména lidí jsou smyšlená. Peníze v Kč, převádějí se na haléře.
 */
import { dayToIso, isoToDay } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import { baselineBac, createBaseline } from '../model/baseline'
import { rollupPercent } from '../model/earnedValue'
import { computeCostTimeline } from '../model/costTimeline'
import { computeCosts } from '../model/costs'
import type { Project } from '../model/schema'
import { buildTemplate, type TemplateDef, type TemplateLine, type TemplateRow } from './template'

/** Plán: [klíč, typ, délka v pracovních dnech, předchůdci] (viz TemplateRow). */
const ROWS: TemplateRow[] = [
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

/**
 * Zdroje a náklady činností (fáze 6b), zápis viz TemplateLine v template.ts.
 * Smlouva s dodavatelem pracoviště 4,5 mil. Kč: záloha 30 % při podpisu, doplatek při předání.
 */
const LINES: Record<string, TemplateLine[]> = {
  p1: [['labor', 'pm', 'w1', 20]],
  t1a: [['labor', 'designer', 'w2', 50]],
  t1b: [['labor', 'pm', 'w1', 50], ['labor', 'designer', 'w2', 30]],
  t2a: [['labor', 'pm', 'w1', 50]],
  t2b: [['labor', 'pm', 'w1', 30], ['oneTime', 'consultant', 45_000, 'end', 'services']],
  m2: [['oneTime', 'deposit', 1_350_000, 'start', 'investment']],
  t3a: [['labor', 'designer', 'w2', 100]],
  t3b: [['labor', 'designer', 'w2', 100], ['labor', 'plc', 'w3', 50]],
  t4a: [
    ['material', 'sensor', 24],
    ['material', 'lightCurtain', 2],
    ['material', 'cabinet', 1],
    ['material', 'profile', 60],
    ['material', 'cylinder', 8],
    ['material', 'fasteners', 10],
  ],
  t4b: [['labor', 'plc', 'w3', 100]],
  m4: [['oneTime', 'travel', 18_000, 'start', 'services']],
  t5a: [['oneTime', 'floor', 280_000, 'end', 'services']],
  t5b: [
    ['labor', 'electrician', 'w4', 100],
    ['labor', 'fitter', 'w5', 50],
    ['machine', 'platform', 50],
    ['material', 'cablePower', 180],
    ['material', 'cableSignal', 120],
    ['material', 'tray', 45],
  ],
  t5c: [['labor', 'fitter', 'w5', 100], ['machine', 'welder', 50], ['material', 'profile', 40], ['material', 'fasteners', 5]],
  t6a: [
    ['labor', 'fitter', 'w5', 100],
    ['labor', 'fitter', 'w6', 100],
    ['labor', 'electrician', 'w4', 50],
    ['machine', 'crane', 25],
    ['recurring', 'container', 6_000, 'week'],
  ],
  t6b: [['labor', 'plc', 'w3', 100], ['labor', 'electrician', 'w4', 50]],
  t6c: [['labor', 'operator', 'w7', 100], ['labor', 'operator', null, 100]],
  t7a: [['oneTime', 'training', 35_000, 'end', 'services'], ['labor', 'operator', 'w7', 50]],
  t7b: [['labor', 'operator', 'w7', 100], ['labor', 'pm', 'w1', 20], ['recurring', 'support', 25_000, 'month']],
  t8a: [['labor', 'pm', 'w1', 50]],
  m8: [['oneTime', 'finalPayment', 3_150_000, 'start', 'investment']],
}

/** Šablona „Zavedení automatizace do výroby“ (texty v překladech pod `sample`). */
export const AUTOMATION_TEMPLATE: TemplateDef = {
  keyPrefix: 'sample',
  idPrefix: 'sample',
  rows: ROWS,
  departments: [
    ['pm', '100'],
    ['eng', '210'],
    ['maint', '310'],
    ['prod', '400'],
  ],
  professions: [
    { key: 'pm', category: 'labor', capacityPerDay: 8, calc: { wageKc: 75_000, overheadPct: 15 } },
    { key: 'designer', category: 'labor', capacityPerDay: 8, calc: { wageKc: 62_000, overheadPct: 15 } },
    { key: 'plc', category: 'labor', capacityPerDay: 8, calc: { wageKc: 68_000, overheadPct: 15 } },
    // Externí elektrikáři – fakturovaná hodinová sazba dodavatele.
    { key: 'electrician', category: 'services', capacityPerDay: 8, manualRateKc: 520 },
    { key: 'fitter', category: 'labor', capacityPerDay: 8, calc: { wageKc: 42_000, overheadPct: 10 } },
    { key: 'operator', category: 'labor', capacityPerDay: 8, calc: { wageKc: 38_000, overheadPct: 10 } },
  ],
  workers: [
    { key: 'w1', name: 'Jana Dvořáková', profession: 'pm', department: 'pm', capacityPerDay: 8 },
    { key: 'w2', name: 'Petr Svoboda', profession: 'designer', department: 'eng', capacityPerDay: 8, calc: { wageKc: 66_000, overheadPct: 15 } },
    { key: 'w3', name: 'Lukáš Černý', profession: 'plc', department: 'eng', capacityPerDay: 8 },
    { key: 'w4', name: 'Tomáš Procházka', profession: 'electrician', department: 'maint', capacityPerDay: 8 },
    { key: 'w5', name: 'Martin Kučera', profession: 'fitter', department: 'maint', capacityPerDay: 8 },
    { key: 'w6', name: 'Pavel Veselý', profession: 'fitter', department: 'prod', capacityPerDay: 6 },
    { key: 'w7', name: 'Eva Horáková', profession: 'operator', department: 'prod', capacityPerDay: 8, manualRateKc: 330 },
  ],
  machines: [
    { key: 'crane', category: 'services', rateKc: 1_800, rateUnit: 'hour', capacityPerDay: 8 },
    { key: 'platform', category: 'services', rateKc: 2_500, rateUnit: 'day', capacityPerDay: 8 },
    { key: 'welder', category: 'services', rateKc: 150, rateUnit: 'hour', capacityPerDay: 8 },
  ],
  materials: [
    ['cablePower', 'm', 65, 'CYKY-J 5x2,5'],
    ['cableSignal', 'm', 38.5],
    ['tray', 'm', 245],
    ['sensor', 'pcs', 1_290, 'IS-M18'],
    ['lightCurtain', 'pcs', 18_900],
    ['cabinet', 'pcs', 32_500],
    ['fasteners', 'set', 1_850],
    ['profile', 'm', 420, '45x45'],
    ['cylinder', 'pcs', 3_450],
  ],
  lines: LINES,
}

/**
 * @param translate funkce překladu (t z i18next) – vrací text podle klíče
 * @param language jazyk obsahu projektu
 */
export function createSampleProject(translate: (key: string) => string, language: string, startDate?: string): Project {
  return buildTemplate(AUTOMATION_TEMPLATE, translate, language, startDate)
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
