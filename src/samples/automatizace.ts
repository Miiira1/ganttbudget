/**
 * Vzorový projekt „Zavedení automatizace do výroby“ (ZADANI.md, kap. 11) – zjednodušená verze pro fázi 1.
 * Zatím jen názvy, typy a délky v pracovních dnech, vše na jedné úrovni.
 * Hierarchie, vazby, zdroje a rozpočet se doplní v dalších fázích.
 *
 * Názvy jsou v překladových souborech (sample.tasks.*), aby šel projekt vytvořit v každém jazyce.
 */
import { createEmptyProject, createTask, type Project, type TaskKind } from '../model/schema'

type Row = [key: string, kind: TaskKind, durationDays: number]

const ROWS: Row[] = [
  ['p1', 'phase', 0],
  ['t1a', 'task', 10],
  ['t1b', 'task', 15],
  ['p2', 'phase', 0],
  ['t2a', 'task', 10],
  ['t2b', 'task', 20],
  ['m2', 'milestone', 0],
  ['p3', 'phase', 0],
  ['t3a', 'task', 15],
  ['t3b', 'task', 25],
  ['p4', 'phase', 0],
  ['t4a', 'task', 40],
  ['t4b', 'task', 20],
  ['m4', 'milestone', 0],
  ['p5', 'phase', 0],
  ['t5a', 'task', 10],
  ['t5b', 'task', 8],
  ['t5c', 'task', 5],
  ['p6', 'phase', 0],
  ['t6a', 'task', 10],
  ['t6b', 'task', 8],
  ['m6', 'milestone', 0],
  ['p7', 'phase', 0],
  ['t7a', 'task', 5],
  ['t7b', 'task', 20],
  ['p8', 'phase', 0],
  ['t8a', 'task', 5],
  ['m8', 'milestone', 0],
]

/**
 * @param translate funkce překladu (t z i18next) – vrací text podle klíče
 * @param language jazyk obsahu projektu
 */
export function createSampleProject(translate: (key: string) => string, language: string, startDate?: string): Project {
  const project = createEmptyProject({ name: translate('sample.projectName'), language, startDate })
  project.tasks = ROWS.map(([key, kind, durationDays], order) =>
    createTask({ id: `sample-${key}`, name: translate(`sample.tasks.${key}`), order, kind, durationDays }),
  )
  return project
}
