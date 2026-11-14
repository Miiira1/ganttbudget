/**
 * Vzorový projekt „Zavedení automatizace do výroby“ (ZADANI.md, kap. 11) – zjednodušená verze.
 * Fáze 2: názvy, typy, délky v pracovních dnech a vazby FS (s prodlevou), vše na jedné úrovni.
 * Hierarchie fází, další typy vazeb, zdroje a rozpočet se doplní v dalších fázích.
 *
 * Názvy jsou v překladových souborech (sample.tasks.*), aby šel projekt vytvořit v každém jazyce.
 */
import { createEmptyProject, createTask, type Project, type TaskKind } from '../model/schema'

/** [klíč, typ, délka v pracovních dnech, předchůdci jako [klíč, prodleva]] */
type Row = [key: string, kind: TaskKind, durationDays: number, predecessors?: [string, number][]]

const ROWS: Row[] = [
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
  ['t4b', 'task', 20, [['t3b', 5]]], // programování začne týden po dokončení konstrukce
  ['m4', 'milestone', 0, [['t4a', 0], ['t4b', 0]]],
  ['p5', 'phase', 0],
  ['t5a', 'task', 10, [['t3b', 10]]], // hala se připravuje souběžně s výrobou zařízení
  ['t5b', 'task', 8, [['t5a', 0]]],
  ['t5c', 'task', 5, [['t5b', 0]]],
  ['p6', 'phase', 0],
  ['t6a', 'task', 10, [['m4', 0], ['t5c', 0]]],
  ['t6b', 'task', 8, [['t6a', 0]]],
  ['m6', 'milestone', 0, [['t6b', 0]]],
  ['p7', 'phase', 0],
  ['t7a', 'task', 5, [['m6', 0]]],
  ['t7b', 'task', 20, [['t7a', 0]]],
  ['p8', 'phase', 0],
  ['t8a', 'task', 5, [['t7b', 0]]],
  ['m8', 'milestone', 0, [['t8a', 0]]],
]

const idOf = (key: string) => `sample-${key}`

/**
 * @param translate funkce překladu (t z i18next) – vrací text podle klíče
 * @param language jazyk obsahu projektu
 */
export function createSampleProject(translate: (key: string) => string, language: string, startDate?: string): Project {
  const project = createEmptyProject({ name: translate('sample.projectName'), language, startDate })
  project.tasks = ROWS.map(([key, kind, durationDays, predecessors = []], order) => ({
    ...createTask({ id: idOf(key), name: translate(`sample.tasks.${key}`), order, kind, durationDays }),
    dependencies: predecessors.map(([pred, lagDays]) => ({ predecessorId: idOf(pred), type: 'FS' as const, lagDays })),
  }))
  return project
}
