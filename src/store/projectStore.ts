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
import {
  deleteMany,
  duplicate,
  duplicateMany,
  indent,
  indentMany,
  moveDown,
  moveDownMany,
  moveManyTo,
  moveTo,
  moveUp,
  moveUpMany,
  outdent,
  outdentMany,
  type DropPosition,
  type HierarchyError,
  type HierarchyResult,
} from '../model/hierarchy'
import type { CatalogItem } from '../model/catalogs'
import { createTask, type Calendar, type CatalogKey, type Dependency, type Project, type Task, type TaskKind } from '../model/schema'

/** Kolik kroků zpět si aplikace pamatuje. */
export const HISTORY_LIMIT = 100

/** Údaje činnosti, které lze měnit v tabulce. */
export type TaskPatch = Partial<Pick<Task, 'name' | 'kind' | 'durationDays' | 'percentComplete' | 'notes'>>

export interface ProjectState {
  project: Project
  past: Project[]
  future: Project[]

  /**
   * Přidá činnost a vrátí její ID. S `afterId` ji vloží hned pod tento řádek (za jeho podřízené)
   * na stejnou úroveň; bez něj (nebo když řádek neexistuje) na konec.
   */
  addTask: (name: string, kind?: TaskKind, afterId?: string | null) => string
  /** Odsadit / předsadit / nahoru / dolů / přesun tažením (model/hierarchy.ts). Vrací null, nebo důvod, proč to nejde. */
  indentTask: (id: string) => HierarchyError | null
  outdentTask: (id: string) => HierarchyError | null
  moveTaskUp: (id: string) => HierarchyError | null
  moveTaskDown: (id: string) => HierarchyError | null
  moveTask: (id: string, targetId: string, position: DropPosition) => HierarchyError | null
  /**
   * Totéž pro více vybraných řádků najednou (jeden krok Zpět). Když akce nejde u některého
   * z nich, nezmění se nic a vrátí se důvod (model/hierarchy.ts – hromadné operace).
   */
  indentTasks: (ids: string[]) => HierarchyError | null
  outdentTasks: (ids: string[]) => HierarchyError | null
  moveTasksUp: (ids: string[]) => HierarchyError | null
  moveTasksDown: (ids: string[]) => HierarchyError | null
  moveTasks: (ids: string[], targetId: string, position: DropPosition) => HierarchyError | null
  /** Duplikuje vybrané řádky; vrátí ID kopií, nebo null. */
  duplicateTasks: (ids: string[], nameSuffix: string) => string[] | null
  /** Smaže vybrané řádky i s podřízenými a vazby na ně. */
  deleteTasks: (ids: string[]) => void
  /**
   * Termín z tažení nebo z tabulky (fáze 4b): omezení „začít nejdříve“ (null = zrušit) a/nebo délka.
   * Obojí najednou = jeden krok Zpět. Fáze se nemění (počítá se ze svých položek).
   */
  setTaskTiming: (id: string, timing: { constraintStart?: string | null; durationDays?: number }) => void
  /** Totéž pro více činností najednou (posun skupiny úseček) – jeden krok Zpět. */
  setTasksTiming: (updates: { id: string; constraintStart?: string | null; durationDays?: number }[]) => void
  /** Duplikuje řádek (i s podřízenými) pod originál; vrátí ID kopie, nebo null. */
  duplicateTask: (id: string, nameSuffix: string) => string | null
  updateTask: (id: string, patch: TaskPatch) => void
  /** Smaže činnost (i s podřízenými položkami) a odkazy na ni z vazeb ostatních. */
  deleteTask: (id: string) => void
  /** Nastaví vazby činnosti (už zkontrolované – viz model/predecessors.ts). */
  setDependencies: (id: string, dependencies: Dependency[]) => void
  /** Změní nastavení kalendáře projektu. */
  updateCalendar: (patch: Partial<Calendar>) => void
  /** Změní datum začátku projektu ("YYYY-MM-DD"). */
  setProjectStart: (startDate: string) => void
  /**
   * Databáze zdrojů (fáze 6a): přidat / upravit / smazat položku číselníku – vždy jeden krok Zpět.
   * Hodnota undefined v úpravě nepovinný údaj odstraní. Pravidla mazání (používaná profese,
   * kategorie) hlídá UI před voláním (model/catalogs.ts).
   */
  addCatalogItem: <K extends CatalogKey>(key: K, item: CatalogItem<K>) => void
  updateCatalogItem: <K extends CatalogKey>(key: K, id: string, patch: Partial<CatalogItem<K>>) => void
  deleteCatalogItem: (key: CatalogKey, id: string) => void
  /**
   * Smaže kategorii nákladů; položky, které ji používají, přejdou do kategorie `replacementId`
   * (jeden krok Zpět). Používanou kategorii bez platné náhrady nesmaže.
   */
  deleteCategory: (id: string, replacementId: string | null) => void
  /** Přejmenuje projekt (ořízne mezery, max. 200 znaků; prázdný název se ignoruje). */
  renameProject: (name: string) => void
  /** Nahradí celý projekt (např. vzorovým). Lze vrátit přes Zpět. */
  loadProject: (project: Project) => void
  /** Nahradí projekt a smaže historii (obnova ze zálohy po otevření aplikace – není co vracet). */
  resetProject: (project: Project) => void
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

    /** Výsledek operace se stromem: platný se zapíše (jeden krok Zpět), jinak vrátí důvod. */
    function applyHierarchy(result: HierarchyResult): HierarchyError | null {
      if (!result.ok) return result.reason
      commit(result.project)
      return null
    }

    return {
      project: initialProject,
      past: [],
      future: [],

      addTask(name, kind = 'task', afterId = null) {
        const { project } = get()
        const id = newId()
        const order = project.tasks.filter((t) => t.parentId === null).length
        const added = { ...project, tasks: [...project.tasks, createTask({ id, name, order, kind })] }
        // Pod vybraný řádek: přidat na konec a hned přesunout za něj – v historii je to jeden krok.
        const placed = afterId ? moveTo(added, id, afterId, 'after') : null
        commit(placed?.ok ? placed.project : added)
        return id
      },

      indentTask: (id) => applyHierarchy(indent(get().project, id)),
      outdentTask: (id) => applyHierarchy(outdent(get().project, id)),
      moveTaskUp: (id) => applyHierarchy(moveUp(get().project, id)),
      moveTaskDown: (id) => applyHierarchy(moveDown(get().project, id)),
      moveTask: (id, targetId, position) => applyHierarchy(moveTo(get().project, id, targetId, position)),

      indentTasks: (ids) => applyHierarchy(indentMany(get().project, ids)),
      outdentTasks: (ids) => applyHierarchy(outdentMany(get().project, ids)),
      moveTasksUp: (ids) => applyHierarchy(moveUpMany(get().project, ids)),
      moveTasksDown: (ids) => applyHierarchy(moveDownMany(get().project, ids)),
      moveTasks: (ids, targetId, position) => applyHierarchy(moveManyTo(get().project, ids, targetId, position)),

      duplicateTasks(ids, nameSuffix) {
        const result = duplicateMany(get().project, ids, newId, nameSuffix)
        if (!result.ok) return null
        commit(result.project)
        return result.newIds
      },

      deleteTasks(ids) {
        applyHierarchy(deleteMany(get().project, ids))
      },

      setTaskTiming(id, timing) {
        get().setTasksTiming([{ id, ...timing }])
      },

      setTasksTiming(updates) {
        const { project } = get()
        const byId = new Map(updates.map((u) => [u.id, u]))
        let changed = false
        const tasks = project.tasks.map((task) => {
          const timing = byId.get(task.id)
          if (!timing || task.kind === 'phase') return task
          const next: Task = { ...task }
          if (timing.constraintStart === null) delete next.constraintStart
          else if (timing.constraintStart !== undefined) next.constraintStart = timing.constraintStart
          if (timing.durationDays !== undefined && task.kind !== 'milestone') {
            next.durationDays = Math.max(1, Math.round(timing.durationDays))
          }
          if (next.constraintStart === task.constraintStart && next.durationDays === task.durationDays) return task
          changed = true
          return next
        })
        if (changed) commit({ ...project, tasks })
      },

      duplicateTask(id, nameSuffix) {
        const result = duplicate(get().project, id, newId, nameSuffix)
        if (!result.ok) return null
        commit(result.project)
        return result.newId
      },

      updateTask(id, patch) {
        const { project } = get()
        // Fáze s podřízenými položkami musí zůstat fází (jinak by se její činnosti „ztratily“).
        if (patch.kind !== undefined && patch.kind !== 'phase' && project.tasks.some((t) => t.parentId === id)) return
        let changed = false
        let tasks = project.tasks.map((task) => {
          if (task.id !== id) return task
          const next = applyPatch(task, patch)
          if (sameTask(task, next)) return task
          changed = true
          return next
        })
        if (!changed) return
        // Fáze zatím nemůže mít vazby (fáze 2–4b): při změně na fázi se její vazby odeberou.
        if (patch.kind === 'phase') {
          tasks = tasks.map((t) => {
            if (t.id === id) return t.dependencies.length > 0 ? { ...t, dependencies: [] } : t
            return t.dependencies.some((d) => d.predecessorId === id)
              ? { ...t, dependencies: t.dependencies.filter((d) => d.predecessorId !== id) }
              : t
          })
        }
        commit({ ...project, tasks })
      },

      setDependencies(id, dependencies) {
        const { project } = get()
        const task = project.tasks.find((t) => t.id === id)
        if (!task || JSON.stringify(task.dependencies) === JSON.stringify(dependencies)) return
        commit({ ...project, tasks: project.tasks.map((t) => (t.id === id ? { ...t, dependencies } : t)) })
      },

      updateCalendar(patch) {
        const { project } = get()
        const calendar = { ...project.calendar, ...patch }
        if (JSON.stringify(calendar) === JSON.stringify(project.calendar)) return
        commit({ ...project, calendar })
      },

      setProjectStart(startDate) {
        const { project } = get()
        if (startDate === project.startDate) return
        commit({ ...project, startDate })
      },

      addCatalogItem(key, item) {
        const { project } = get()
        commit({ ...project, [key]: [...project[key], item] })
      },

      updateCatalogItem(key, id, patch) {
        const { project } = get()
        const list = project[key] as CatalogItem<typeof key>[]
        const index = list.findIndex((x) => x.id === id)
        const current = list[index]
        if (!current) return
        const next: Record<string, unknown> = { ...current }
        for (const [field, value] of Object.entries(patch)) {
          if (value === undefined) delete next[field]
          else next[field] = value
        }
        if (JSON.stringify(next) === JSON.stringify(current)) return
        commit({ ...project, [key]: list.map((x, i) => (i === index ? next : x)) })
      },

      deleteCatalogItem(key, id) {
        const { project } = get()
        const list = project[key] as { id: string }[]
        if (!list.some((x) => x.id === id)) return
        commit({ ...project, [key]: list.filter((x) => x.id !== id) })
      },

      deleteCategory(id, replacementId) {
        const { project } = get()
        if (!project.costCategories.some((c) => c.id === id)) return
        const used = [...project.professions, ...project.machines, ...project.materials].some((x) => x.categoryId === id)
        const replacementOk = replacementId !== null && replacementId !== id && project.costCategories.some((c) => c.id === replacementId)
        if (used && !replacementOk) return
        const move = <T extends { categoryId: string }>(items: T[]): T[] =>
          items.map((x) => (x.categoryId === id ? { ...x, categoryId: replacementId as string } : x))
        commit({
          ...project,
          costCategories: project.costCategories.filter((c) => c.id !== id),
          professions: move(project.professions),
          machines: move(project.machines),
          materials: move(project.materials),
        })
      },

      renameProject(rawName) {
        const { project } = get()
        const name = rawName.trim().slice(0, 200).trim()
        if (name === '' || name === project.name) return
        commit({ ...project, name })
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

      resetProject(next) {
        set({ project: next, past: [], future: [] })
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
