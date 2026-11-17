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
import { milestoneAllows, syncLaborLines, uniqueName, type CatalogItem } from '../model/catalogs'
import { isValidIsoDate } from '../model/dates'
import { createTask, MAX_ACTUALS, MAX_BASELINES, MAX_VIEWS, type ActualCost, type Baseline, type Calendar, type CatalogKey, type Dependency, type MindMap, type Project, type SavedView, type Task, type TaskKind, type TaskLine } from '../model/schema'

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
   * na stejnou úroveň; bez něj (nebo když řádek neexistuje) na konec. `timing` = rovnou délka
   * a omezení „začít nejdříve“ (nová činnost tažením v grafu) – pořád jeden krok Zpět.
   */
  addTask: (name: string, kind?: TaskKind, afterId?: string | null, timing?: { durationDays: number; constraintStart?: string }) => string
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
  /**
   * Řádky zdrojů a nákladů činnosti (fáze 6b) – vždy jeden krok Zpět.
   * Hodnota undefined v úpravě nepovinný údaj odstraní. Platnost (odkazy, milník) hlídá UI a schéma.
   */
  addTaskLine: (taskId: string, line: TaskLine) => void
  updateTaskLine: (taskId: string, lineId: string, patch: Partial<Record<string, unknown>>) => void
  deleteTaskLine: (taskId: string, lineId: string) => void
  /** Přejmenuje projekt (ořízne mezery, max. 200 znaků; prázdný název se ignoruje). */
  renameProject: (name: string) => void
  /** Uloží baseline (snímek plánu); nová se vybere ke srovnání. Vrátí ID, nebo null (prázdný název, limit). */
  saveBaseline: (name: string, data: Pick<Baseline, 'savedAt' | 'tasks'>) => string | null
  renameBaseline: (id: string, name: string) => void
  setActiveBaseline: (id: string) => void
  /** Smaže baseline; byla-li vybraná, vybere se poslední zbývající. */
  deleteBaseline: (id: string) => void
  /** Přidá skutečný náklad k činnosti (seřazeno podle data). Vrátí ID, nebo null (neplatné hodnoty). */
  addActual: (taskId: string, actual: Omit<ActualCost, 'id'>) => string | null
  updateActual: (taskId: string, actualId: string, patch: Partial<Omit<ActualCost, 'id'>>) => void
  deleteActual: (taskId: string, actualId: string) => void
  /** Datum stavu pro Earned Value; null = dnes. */
  setStatusDate: (date: string | null) => void
  /** Limit rozpočtu projektu v haléřích; null = zrušit (fáze 7). */
  setBudgetLimit: (limit: number | null) => void
  /** Limit kategorie nákladů v haléřích; null = zrušit. */
  setCategoryLimit: (categoryId: string, limit: number | null) => void
  /** Uložit nastavení analýzy jako nový pohled; vrátí jeho ID (null = prázdný název nebo plno). Fáze 8. */
  saveView: (name: string, config: SavedView['config']) => string | null
  /** Přepsat nastavení uloženého pohledu. */
  updateView: (id: string, config: SavedView['config']) => void
  renameView: (id: string, name: string) => void
  deleteView: (id: string) => void
  /** Uloží novou podobu myšlenkové mapy (fáze 12) – jeden krok Zpět; úpravy počítá model/mindMap.ts. */
  setMindMap: (mindMap: MindMap) => void
  /** Nahradí celý projekt (např. vzorovým). Lze vrátit přes Zpět. */
  loadProject: (project: Project) => void
  /** Nahradí projekt a smaže historii (obnova ze zálohy po otevření aplikace – není co vracet). */
  resetProject: (project: Project) => void
  undo: () => void
  redo: () => void
}

/** Skutečný náklad v platném tvaru (oříznutá poznámka, prázdná vynechaná), nebo null. */
function cleanActual(actual: ActualCost): ActualCost | null {
  if (!isValidIsoDate(actual.date) || !Number.isInteger(actual.amount) || actual.amount < 0 || actual.amount > 1_000_000_000_000) return null
  const note = (actual.note ?? '').trim().slice(0, 500).trim()
  const { note: _old, ...rest } = actual
  void _old
  return note === '' ? rest : { ...rest, note }
}

/** Seznam skutečných nákladů seřazený podle data; prázdný = pole se vynechá. */
function withActuals(task: Task, actuals: ActualCost[]): Task {
  const { actuals: _old, ...rest } = task
  void _old
  return actuals.length === 0 ? rest : { ...rest, actuals: [...actuals].sort((a, b) => a.date.localeCompare(b.date)) }
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

      addTask(name, kind = 'task', afterId = null, timing) {
        const { project } = get()
        const id = newId()
        const order = project.tasks.filter((t) => t.parentId === null).length
        const task = createTask({ id, name, order, kind, durationDays: timing?.durationDays })
        if (timing?.constraintStart) task.constraintStart = timing.constraintStart
        const added = { ...project, tasks: [...project.tasks, task] }
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
        // Milník smí mít jen jednorázový náklad a materiál – ostatní řádky se odeberou (UI se předem zeptá).
        if (patch.kind === 'milestone') {
          tasks = tasks.map((t) => (t.id === id && !t.lines.every(milestoneAllows) ? { ...t, lines: t.lines.filter(milestoneAllows) } : t))
        }
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
        const updated = { ...project, [key]: list.map((x, i) => (i === index ? next : x)) }
        // Změna profese pracovníka se propíše do řádků činností s tímto pracovníkem (stejný krok Zpět).
        commit(key === 'workers' ? syncLaborLines(updated) : updated)
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
        const used =
          [...project.professions, ...project.machines, ...project.materials].some((x) => x.categoryId === id) ||
          project.tasks.some((t) => t.lines.some((l) => l.categoryId === id))
        const replacementOk = replacementId !== null && replacementId !== id && project.costCategories.some((c) => c.id === replacementId)
        if (used && !replacementOk) return
        const move = <T extends { categoryId: string }>(items: T[]): T[] =>
          items.map((x) => (x.categoryId === id ? { ...x, categoryId: replacementId as string } : x))
        commit({
          ...withBudget(project, {
            ...(project.budget ?? { categoryLimits: [] }),
            categoryLimits: (project.budget?.categoryLimits ?? []).filter((c) => c.categoryId !== id),
          }),
          costCategories: project.costCategories.filter((c) => c.id !== id),
          professions: move(project.professions),
          machines: move(project.machines),
          materials: move(project.materials),
          tasks: project.tasks.map((t) => (t.lines.some((l) => l.categoryId === id) ? { ...t, lines: move(t.lines) } : t)),
        })
      },

      addTaskLine(taskId, line) {
        const { project } = get()
        if (!project.tasks.some((t) => t.id === taskId)) return
        commit({ ...project, tasks: project.tasks.map((t) => (t.id === taskId ? { ...t, lines: [...t.lines, line] } : t)) })
      },

      updateTaskLine(taskId, lineId, patch) {
        const { project } = get()
        const task = project.tasks.find((t) => t.id === taskId)
        const current = task?.lines.find((l) => l.id === lineId)
        if (!task || !current) return
        const next: Record<string, unknown> = { ...current }
        for (const [field, value] of Object.entries(patch)) {
          if (value === undefined) delete next[field]
          else next[field] = value
        }
        if (JSON.stringify(next) === JSON.stringify(current)) return
        const lines = task.lines.map((l) => (l.id === lineId ? (next as TaskLine) : l))
        commit({ ...project, tasks: project.tasks.map((t) => (t.id === taskId ? { ...t, lines } : t)) })
      },

      deleteTaskLine(taskId, lineId) {
        const { project } = get()
        const task = project.tasks.find((t) => t.id === taskId)
        if (!task || !task.lines.some((l) => l.id === lineId)) return
        const lines = task.lines.filter((l) => l.id !== lineId)
        commit({ ...project, tasks: project.tasks.map((t) => (t.id === taskId ? { ...t, lines } : t)) })
      },

      setBudgetLimit(limit) {
        const { project } = get()
        if (limit !== null && !validLimit(limit)) return
        const current = project.budget ?? { categoryLimits: [] }
        if ((current.limit ?? null) === limit) return
        const { limit: _old, ...rest } = current
        void _old
        commit(withBudget(project, limit === null ? rest : { ...rest, limit }))
      },

      setCategoryLimit(categoryId, limit) {
        const { project } = get()
        if (!project.costCategories.some((c) => c.id === categoryId)) return
        if (limit !== null && !validLimit(limit)) return
        const current = project.budget ?? { categoryLimits: [] }
        const exists = current.categoryLimits.some((c) => c.categoryId === categoryId)
        let categoryLimits = current.categoryLimits
        if (limit === null) {
          if (!exists) return
          categoryLimits = categoryLimits.filter((c) => c.categoryId !== categoryId)
        } else if (exists) {
          if (categoryLimits.some((c) => c.categoryId === categoryId && c.limit === limit)) return
          categoryLimits = categoryLimits.map((c) => (c.categoryId === categoryId ? { categoryId, limit } : c))
        } else categoryLimits = [...categoryLimits, { categoryId, limit }]
        commit(withBudget(project, { ...current, categoryLimits }))
      },

      saveView(rawName, config) {
        const { project } = get()
        const views = project.views ?? []
        const name = rawName.trim().slice(0, 100).trim()
        if (name === '' || views.length >= MAX_VIEWS) return null
        const id = newId()
        commit({ ...project, views: [...views, { id, name: uniqueName(name, views.map((v) => v.name)), config }] })
        return id
      },

      updateView(id, config) {
        const { project } = get()
        const view = project.views?.find((v) => v.id === id)
        if (!view || JSON.stringify(view.config) === JSON.stringify(config)) return
        commit({ ...project, views: project.views!.map((v) => (v.id === id ? { ...v, config } : v)) })
      },

      renameView(id, rawName) {
        const { project } = get()
        const view = project.views?.find((v) => v.id === id)
        const name = rawName.trim().slice(0, 100).trim()
        if (!view || name === '' || name === view.name) return
        const others = project.views!.filter((v) => v.id !== id).map((v) => v.name)
        commit({ ...project, views: project.views!.map((v) => (v.id === id ? { ...v, name: uniqueName(name, others) } : v)) })
      },

      deleteView(id) {
        const { project } = get()
        if (!project.views?.some((v) => v.id === id)) return
        const views = project.views.filter((v) => v.id !== id)
        const { views: _old, ...rest } = project
        void _old
        commit(views.length > 0 ? { ...rest, views } : (rest as Project))
      },

      setMindMap(mindMap) {
        const { project } = get()
        if (project.mindMap === mindMap) return
        commit({ ...project, mindMap })
      },

      saveBaseline(rawName, data) {
        const { project } = get()
        const name = rawName.trim().slice(0, 100).trim()
        if (name === '' || project.baselines.length >= MAX_BASELINES) return null
        const id = newId()
        const baseline: Baseline = { id, name: uniqueName(name, project.baselines.map((b) => b.name)), savedAt: data.savedAt, tasks: data.tasks }
        commit({ ...project, baselines: [...project.baselines, baseline], activeBaselineId: id })
        return id
      },

      renameBaseline(id, rawName) {
        const { project } = get()
        const baseline = project.baselines.find((b) => b.id === id)
        const name = rawName.trim().slice(0, 100).trim()
        if (!baseline || name === '' || name === baseline.name) return
        const others = project.baselines.filter((b) => b.id !== id).map((b) => b.name)
        commit({ ...project, baselines: project.baselines.map((b) => (b.id === id ? { ...b, name: uniqueName(name, others) } : b)) })
      },

      setActiveBaseline(id) {
        const { project } = get()
        if (project.activeBaselineId === id || !project.baselines.some((b) => b.id === id)) return
        commit({ ...project, activeBaselineId: id })
      },

      deleteBaseline(id) {
        const { project } = get()
        if (!project.baselines.some((b) => b.id === id)) return
        const baselines = project.baselines.filter((b) => b.id !== id)
        const { activeBaselineId, ...rest } = project
        const active = activeBaselineId === id || activeBaselineId === undefined ? baselines.at(-1)?.id : activeBaselineId
        commit(active === undefined ? { ...rest, baselines } : { ...rest, baselines, activeBaselineId: active })
      },

      addActual(taskId, input) {
        const { project } = get()
        const task = project.tasks.find((t) => t.id === taskId)
        const id = newId()
        const actual = cleanActual({ ...input, id })
        if (!task || !actual || (task.actuals?.length ?? 0) >= MAX_ACTUALS) return null
        commit({ ...project, tasks: project.tasks.map((t) => (t.id === taskId ? withActuals(t, [...(t.actuals ?? []), actual]) : t)) })
        return id
      },

      updateActual(taskId, actualId, patch) {
        const { project } = get()
        const task = project.tasks.find((t) => t.id === taskId)
        const current = task?.actuals?.find((a) => a.id === actualId)
        if (!task || !current) return
        const next = cleanActual({ ...current, ...patch, id: actualId })
        if (!next || JSON.stringify(next) === JSON.stringify(current)) return
        commit({ ...project, tasks: project.tasks.map((t) => (t.id === taskId ? withActuals(t, t.actuals!.map((a) => (a.id === actualId ? next : a))) : t)) })
      },

      deleteActual(taskId, actualId) {
        const { project } = get()
        const task = project.tasks.find((t) => t.id === taskId)
        if (!task?.actuals?.some((a) => a.id === actualId)) return
        commit({ ...project, tasks: project.tasks.map((t) => (t.id === taskId ? withActuals(t, t.actuals!.filter((a) => a.id !== actualId)) : t)) })
      },

      setStatusDate(date) {
        const { project } = get()
        if (date !== null && !isValidIsoDate(date)) return
        if ((project.statusDate ?? null) === date) return
        const { statusDate: _old, ...rest } = project
        void _old
        commit(date === null ? rest : { ...rest, statusDate: date })
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

/** Platný limit rozpočtu: kladné celé číslo haléřů. */
const validLimit = (limit: number) => Number.isInteger(limit) && limit >= 1 && limit <= 1_000_000_000_000

/** Projekt s novými limity; bez jakéhokoli limitu pole `budget` zmizí (soubor zůstane jako dřív). */
function withBudget(project: Project, budget: NonNullable<Project['budget']>): Project {
  const { budget: _old, ...rest } = project
  void _old
  return budget.limit === undefined && budget.categoryLimits.length === 0 ? (rest as Project) : { ...rest, budget }
}
