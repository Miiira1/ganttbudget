/**
 * Jedno úložiště stavu pro celou aplikaci a „háčky“ (hooks) pro komponenty Reactu.
 * Komponenta si vybere jen to, co potřebuje: useProject((s) => s.project.tasks)
 */
import { useStore } from 'zustand'
import i18n from '../i18n'
import { schedule, type ScheduleResult } from '../engine/schedule'
import { computeCosts, type CostsResult } from '../model/costs'
import { computeLoad, type LoadResult } from '../model/load'
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
