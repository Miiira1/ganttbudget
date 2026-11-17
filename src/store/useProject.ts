/**
 * Jedno úložiště stavu pro celou aplikaci a „háčky“ (hooks) pro komponenty Reactu.
 * Komponenta si vybere jen to, co potřebuje: useProject((s) => s.project.tasks)
 */
import { useStore } from 'zustand'
import i18n from '../i18n'
import { schedule, type ScheduleResult } from '../engine/schedule'
import { computeCosts, type CostsResult } from '../model/costs'
import { computeLoad, type LoadResult } from '../model/load'
import { budgetStatus, computeCostTimeline, type BudgetStatus, type CostTimeline } from '../model/costTimeline'
import { buildFacts, type Facts } from '../model/facts'
import { activeBaseline, baselineBac } from '../model/baseline'
import { earnedValue, rollupPercent, type EarnedValueResult } from '../model/earnedValue'
import { isoToDay } from '../engine/calendar'
import { todayIso } from '../model/dates'
import { createEmptyProject, type Project } from '../model/schema'
import { createProjectStore, type ProjectState } from './projectStore'

export const projectStore = createProjectStore(
  createEmptyProject({ name: i18n.t('project.defaultName'), language: i18n.language }),
)

export function useProject<T>(selector: (state: ProjectState) => T): T {
  return useStore(projectStore, selector)
}

// Spočítané termíny se pamatují pro každou verzi projektu – počítají se jen po změně.
const scheduleCache = new WeakMap<Project, ScheduleResult>()

/** Spočítané termíny dané verze projektu (z paměti, pokud už byly spočítané). */
export function getSchedule(project: Project): ScheduleResult {
  let result = scheduleCache.get(project)
  if (!result) {
    result = schedule(project)
    scheduleCache.set(project, result)
  }
  return result
}

/** Spočítané termíny aktuálního projektu (výsledek plánovacího jádra). */
export function useSchedule(): ScheduleResult {
  return getSchedule(useProject((s) => s.project))
}

// Náklady (fáze 6b) se také počítají jen jednou pro každou verzi projektu.
const costsCache = new WeakMap<Project, CostsResult>()

/** Náklady řádků, položek a projektu pro danou verzi projektu (z paměti, pokud už byly spočítané). */
export function getCosts(project: Project): CostsResult {
  let result = costsCache.get(project)
  if (!result) {
    result = computeCosts(project, getSchedule(project))
    costsCache.set(project, result)
  }
  return result
}

/** Náklady aktuálního projektu. */
export function useCosts(): CostsResult {
  return getCosts(useProject((s) => s.project))
}

// Vytížení zdrojů (fáze 6c) – také jen jednou pro každou verzi projektu.
const loadCache = new WeakMap<Project, LoadResult>()

/** Vytížení pracovníků, profesí a strojů pro danou verzi projektu. */
export function getLoad(project: Project): LoadResult {
  let result = loadCache.get(project)
  if (!result) {
    result = computeLoad(project, getSchedule(project))
    loadCache.set(project, result)
  }
  return result
}

/** Vytížení aktuálního projektu. */
export function useLoad(): LoadResult {
  return getLoad(useProject((s) => s.project))
}

// Časový náběh nákladů (fáze 7) – také jen jednou pro každou verzi projektu.
const costTimelineCache = new WeakMap<Project, CostTimeline>()

/** Rozpad nákladů projektu do dnů (pro pohled Náklady, limity a export). */
export function getCostTimeline(project: Project): CostTimeline {
  let result = costTimelineCache.get(project)
  if (!result) {
    result = computeCostTimeline(project, getSchedule(project), getCosts(project))
    costTimelineCache.set(project, result)
  }
  return result
}

/** Časový náběh nákladů aktuálního projektu. */
export function useCostTimeline(): CostTimeline {
  return getCostTimeline(useProject((s) => s.project))
}

// Stav limitů rozpočtu (fáze 7) – pro záhlaví, pohled Náklady a dialog limitů.
const budgetCache = new WeakMap<Project, BudgetStatus>()

export function getBudgetStatus(project: Project): BudgetStatus {
  let result = budgetCache.get(project)
  if (!result) {
    result = budgetStatus(project, getCostTimeline(project))
    budgetCache.set(project, result)
  }
  return result
}

export function useBudgetStatus(): BudgetStatus {
  return getBudgetStatus(useProject((s) => s.project))
}

// Fakta pro analýzu (fáze 8) – řádky činností s rozpadem nákladu a hodin po dnech.
const factsCache = new WeakMap<Project, Facts>()

export function getFacts(project: Project): Facts {
  let result = factsCache.get(project)
  if (!result) {
    result = buildFacts(project, getSchedule(project), getCostTimeline(project))
    factsCache.set(project, result)
  }
  return result
}

export function useFacts(): Facts {
  return getFacts(useProject((s) => s.project))
}

// % hotovo (fáze 9) – fáze spočítaná z činností, vážená plánovaným nákladem vybrané baseline (jinak délkou).
const percentCache = new WeakMap<Project, Map<string, number>>()

export function getPercents(project: Project): Map<string, number> {
  let result = percentCache.get(project)
  if (!result) {
    const baseline = activeBaseline(project)
    result = rollupPercent(project, baseline ? baselineBac(baseline) : null)
    percentCache.set(project, result)
  }
  return result
}

export function usePercents(): Map<string, number> {
  return getPercents(useProject((s) => s.project))
}

// Earned Value (fáze 9) k datu stavu (bez něj dnes) a vybrané baseline; null = baseline není.
const evCache = new WeakMap<Project, { day: number; result: EarnedValueResult | null }>()

export function getEarnedValue(project: Project): EarnedValueResult | null {
  const day = isoToDay(project.statusDate ?? todayIso())
  const cached = evCache.get(project)
  if (cached && cached.day === day) return cached.result
  const baseline = activeBaseline(project)
  const result = baseline ? earnedValue(project, getSchedule(project), baseline, day) : null
  evCache.set(project, { day, result })
  return result
}

export function useEarnedValue(): EarnedValueResult | null {
  return getEarnedValue(useProject((s) => s.project))
}
