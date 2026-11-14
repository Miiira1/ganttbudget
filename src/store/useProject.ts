/**
 * Jedno úložiště stavu pro celou aplikaci a „háčky“ (hooks) pro komponenty Reactu.
 * Komponenta si vybere jen to, co potřebuje: useProject((s) => s.project.tasks)
 */
import { useStore } from 'zustand'
import i18n from '../i18n'
import { schedule, type ScheduleResult } from '../engine/schedule'
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

/** Spočítané termíny aktuálního projektu (výsledek plánovacího jádra). */
export function useSchedule(): ScheduleResult {
  const project = useProject((s) => s.project)
  let result = scheduleCache.get(project)
  if (!result) {
    result = schedule(project)
    scheduleCache.set(project, result)
  }
  return result
}
