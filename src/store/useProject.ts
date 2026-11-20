/**
 * Jedno úložiště stavu pro celou aplikaci a „háčky“ (hooks) pro komponenty Reactu.
 * Komponenta si vybere jen to, co potřebuje: useProject((s) => s.project.tasks)
 *
 * Spočítané výsledky (termíny, náklady, vytížení…) se pamatují jen pro poslední 3 verze
 * projektu (versionCache.ts, audit R2) – počítají se jen po změně, ale historie Zpět
 * kvůli nim nedrží v paměti stovky MB.
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
import { checkPlan, type PlanIssue } from '../model/planCheck'
import { isoToDay } from '../engine/calendar'
import { todayIso } from '../model/dates'
import { createEmptyProject, type Project } from '../model/schema'
import { createProjectStore, type ProjectState } from './projectStore'
import { createVersionCache } from './versionCache'

export const projectStore = createProjectStore(
  createEmptyProject({ name: i18n.t('project.defaultName'), language: i18n.language }),
)

export function useProject<T>(selector: (state: ProjectState) => T): T {
  return useStore(projectStore, selector)
}

// Spočítané termíny se pamatují pro poslední verze projektu – počítají se jen po změně.
const scheduleCache = createVersionCache<Project, ScheduleResult>()

/** Spočítané termíny dané verze projektu (z paměti, pokud už byly spočítané). */
export function getSchedule(project: Project): ScheduleResult {
  return scheduleCache.get(project, () => schedule(project))
}

/** Spočítané termíny aktuálního projektu (výsledek plánovacího jádra). */
export function useSchedule(): ScheduleResult {
  return getSchedule(useProject((s) => s.project))
}

// Náklady (fáze 6b) se také počítají jen jednou pro každou verzi projektu.
const costsCache = createVersionCache<Project, CostsResult>()

/** Náklady řádků, položek a projektu pro danou verzi projektu (z paměti, pokud už byly spočítané). */
export function getCosts(project: Project): CostsResult {
  return costsCache.get(project, () => computeCosts(project, getSchedule(project)))
}

/** Náklady aktuálního projektu. */
export function useCosts(): CostsResult {
  return getCosts(useProject((s) => s.project))
}

// Vytížení zdrojů (fáze 6c) – také jen jednou pro každou verzi projektu.
const loadCache = createVersionCache<Project, LoadResult>()

/** Vytížení pracovníků, profesí a strojů pro danou verzi projektu. */
export function getLoad(project: Project): LoadResult {
  return loadCache.get(project, () => computeLoad(project, getSchedule(project)))
}

/** Vytížení aktuálního projektu. */
export function useLoad(): LoadResult {
  return getLoad(useProject((s) => s.project))
}

// Časový náběh nákladů (fáze 7) – také jen jednou pro každou verzi projektu.
const costTimelineCache = createVersionCache<Project, CostTimeline>()

/** Rozpad nákladů projektu do dnů (pro pohled Náklady, limity a export). */
export function getCostTimeline(project: Project): CostTimeline {
  return costTimelineCache.get(project, () => computeCostTimeline(project, getSchedule(project), getCosts(project)))
}

/** Časový náběh nákladů aktuálního projektu. */
export function useCostTimeline(): CostTimeline {
  return getCostTimeline(useProject((s) => s.project))
}

// Stav limitů rozpočtu (fáze 7) – pro záhlaví, pohled Náklady a dialog limitů.
const budgetCache = createVersionCache<Project, BudgetStatus>()

export function getBudgetStatus(project: Project): BudgetStatus {
  return budgetCache.get(project, () => budgetStatus(project, getCostTimeline(project)))
}

export function useBudgetStatus(): BudgetStatus {
  return getBudgetStatus(useProject((s) => s.project))
}

// Fakta pro analýzu (fáze 8) – řádky činností s rozpadem nákladu a hodin po dnech.
const factsCache = createVersionCache<Project, Facts>()

export function getFacts(project: Project): Facts {
  return factsCache.get(project, () => buildFacts(project, getSchedule(project), getCostTimeline(project)))
}

export function useFacts(): Facts {
  return getFacts(useProject((s) => s.project))
}

// % hotovo (fáze 9) – fáze spočítaná z činností, vážená plánovaným nákladem vybrané baseline (jinak délkou).
const percentCache = createVersionCache<Project, Map<string, number>>()

export function getPercents(project: Project): Map<string, number> {
  return percentCache.get(project, () => {
    const baseline = activeBaseline(project)
    return rollupPercent(project, baseline ? baselineBac(baseline) : null)
  })
}

export function usePercents(): Map<string, number> {
  return getPercents(useProject((s) => s.project))
}

// Earned Value (fáze 9) k datu stavu (bez něj dnes) a vybrané baseline; null = baseline není.
const evCache = createVersionCache<Project, { day: number; result: EarnedValueResult | null }>()

export function getEarnedValue(project: Project): EarnedValueResult | null {
  const day = isoToDay(project.statusDate ?? todayIso())
  const compute = () => {
    const baseline = activeBaseline(project)
    return baseline ? earnedValue(project, getSchedule(project), baseline, day) : null
  }
  const cached = evCache.get(project, () => ({ day, result: compute() }))
  if (cached.day !== day) {
    // Přes půlnoc se změnil dnešek (datum stavu není zadané) → spočítat znovu.
    cached.day = day
    cached.result = compute()
  }
  return cached.result
}

export function useEarnedValue(): EarnedValueResult | null {
  return getEarnedValue(useProject((s) => s.project))
}

// Kontrola kvality plánu (fáze 10, U-04) – závisí i na dnešku (kontrola „mělo začít“).
const issuesCache = createVersionCache<Project, { today: string; result: PlanIssue[] }>()

export function getPlanIssues(project: Project): PlanIssue[] {
  const today = todayIso()
  const compute = () => checkPlan({ project, scheduled: getSchedule(project), load: getLoad(project), budget: getBudgetStatus(project), today })
  const cached = issuesCache.get(project, () => ({ today, result: compute() }))
  if (cached.today !== today) {
    cached.today = today
    cached.result = compute()
  }
  return cached.result
}

export function usePlanIssues(): PlanIssue[] {
  return getPlanIssues(useProject((s) => s.project))
}
