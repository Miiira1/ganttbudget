/**
 * Stav aplikace (knihovna Zustand) s historií změn pro Zpět / Znovu (Undo / Redo).
 *
 * Princip: projekt je neměnný (immutable) objekt. Každá změna vytvoří NOVOU verzi projektu
 * a starou uloží do seznamu `past`. Zpět = vrátit poslední verzi z `past`,
 * Znovu = vzít verzi ze seznamu `future`.
 *
 * Všechny změny projektu MUSÍ jít přes funkci `commit()` – jen tak se dostanou do historie.
 */
import { createStore } from 'zustand/vanilla'
import { createTask, type Project, type Task, type TaskKind } from '../model/schema'

/** Kolik kroků zpět si aplikace pamatuje. */
export const HISTORY_LIMIT = 100

/** Údaje činnosti, které lze měnit v tabulce. */
export type TaskPatch = Partial<Pick<Task, 'name' | 'kind' | 'durationDays' | 'percentComplete' | 'notes'>>

export interface ProjectState {
  project: Project
  past: Project[]
  future: Project[]

  /** Přidá činnost na konec seznamu a vrátí její ID. */
  addTask: (name: string, kind?: TaskKind) => string
  updateTask: (id: string, patch: TaskPatch) => void
  /** Smaže činnost (i s podřízenými položkami) a odkazy na ni z vazeb ostatních. */
  deleteTask: (id: string) => void
  /** Nahradí celý projekt (např. vzorovým). Lze vrátit přes Zpět. */
  loadProject: (project: Project) => void
  undo: () => void
  redo: () => void
}

function newId(): string {
  return crypto.randomUUID()
}

/** Seřadí činnosti a znovu očísluje pořadí 0, 1, 2… v rámci každé nadřazené položky. */
function normalizeOrder(tasks: Task[]): Task[] {
  const counters = new Map<string | null, number>()
  return [...tasks]
    .sort((a, b) => a.order - b.order)
    .map((task) => {
      const order = counters.get(task.parentId) ?? 0
      counters.set(task.parentId, order + 1)
      return task.order === order ? task : { ...task, order }
    })
}

/** Uplatní změnu na činnost a pohlídá pravidla (milník má délku 0, % je 0–100…). */
function applyPatch(task: Task, patch: TaskPatch): Task {
  const next: Task = { ...task, ...patch }
  if (patch.kind !== undefined && patch.kind !== task.kind) {
    if (next.kind === 'milestone') next.durationDays = 0
    else if (task.kind === 'milestone' && patch.durationDays === undefined) next.durationDays = 1
  }
  if (next.kind === 'milestone') next.durationDays = 0
  next.durationDays = Math.max(0, Math.round(next.durationDays))
  next.percentComplete = Math.min(100, Math.max(0, Math.round(next.percentComplete)))
  return next
}

function sameTask(a: Task, b: Task): boolean {
  return (
    a.name === b.name &&
    a.kind === b.kind &&
    a.durationDays === b.durationDays &&
    a.percentComplete === b.percentComplete &&
    a.notes === b.notes
  )
}

/** Vytvoří úložiště stavu. Aplikace má jedno, testy si vytvářejí vlastní čistá. */
export function createProjectStore(initialProject: Project) {
  return createStore<ProjectState>()((set, get) => {
    /** Jediné místo, kde se mění projekt: stará verze jde do historie, „Znovu“ se zahodí. */
    function commit(next: Project): void {
      const { project, past } = get()
      if (next === project) return
      set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: [] })
    }

    return {
      project: initialProject,
      past: [],
      future: [],

      addTask(name, kind = 'task') {
        const { project } = get()
        const id = newId()
        const order = project.tasks.filter((t) => t.parentId === null).length
        commit({ ...project, tasks: [...project.tasks, createTask({ id, name, order, kind })] })
        return id
      },

      updateTask(id, patch) {
        const { project } = get()
        let changed = false
        const tasks = project.tasks.map((task) => {
          if (task.id !== id) return task
          const next = applyPatch(task, patch)
          if (sameTask(task, next)) return task
          changed = true
          return next
        })
        if (changed) commit({ ...project, tasks })
      },

      deleteTask(id) {
        const { project } = get()
        if (!project.tasks.some((t) => t.id === id)) return
        // Najdeme mazanou položku i všechny její podřízené (do libovolné hloubky).
        const removed = new Set<string>([id])
        let grew = true
        while (grew) {
          grew = false
          for (const task of project.tasks) {
            if (task.parentId !== null && removed.has(task.parentId) && !removed.has(task.id)) {
              removed.add(task.id)
              grew = true
            }
          }
        }
        const remaining = project.tasks
          .filter((t) => !removed.has(t.id))
          .map((t) =>
            t.dependencies.some((d) => removed.has(d.predecessorId))
              ? { ...t, dependencies: t.dependencies.filter((d) => !removed.has(d.predecessorId)) }
              : t,
          )
        commit({ ...project, tasks: normalizeOrder(remaining) })
      },

      loadProject(next) {
        commit(next)
      },

      undo() {
        const { project, past, future } = get()
        const previous = past[past.length - 1]
        if (previous === undefined) return
        set({ project: previous, past: past.slice(0, -1), future: [project, ...future] })
      },

      redo() {
        const { project, past, future } = get()
        const [next, ...rest] = future
        if (next === undefined) return
        set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: rest })
      },
    }
  })
}

export type ProjectStore = ReturnType<typeof createProjectStore>
