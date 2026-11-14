/**
 * Jedno úložiště stavu pro celou aplikaci a „háček“ (hook) pro komponenty Reactu.
 * Komponenta si vybere jen to, co potřebuje: useProject((s) => s.project.tasks)
 */
import { useStore } from 'zustand'
import i18n from '../i18n'
import { createEmptyProject } from '../model/schema'
import { createProjectStore, type ProjectState } from './projectStore'

export const projectStore = createProjectStore(
  createEmptyProject({ name: i18n.t('project.defaultName'), language: i18n.language }),
)

export function useProject<T>(selector: (state: ProjectState) => T): T {
  return useStore(projectStore, selector)
}
