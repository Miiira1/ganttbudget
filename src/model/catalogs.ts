/**
 * Databáze (číselníky) zdrojů – pomocné čisté funkce, testy v catalogs.test.ts.
 * Tvar číselníků určuje schema.ts (CategorySchema, ProfessionSchema…).
 */
import { MILESTONE_LINE_KINDS, nameKey, type CatalogKey, type Project, type TaskLine } from './schema'

/** Položka daného číselníku (např. CatalogItem<'materials'> = Material). */
export type CatalogItem<K extends CatalogKey> = Project[K][number]

/** Název pro novou položku, který v číselníku ještě není: „Nový materiál“, „Nový materiál 2“… */
export function uniqueName(base: string, existing: readonly string[]): string {
  const taken = new Set(existing.map(nameKey))
  if (!taken.has(nameKey(base))) return base
  for (let i = 2; ; i++) if (!taken.has(nameKey(`${base} ${i}`))) return `${base} ${i}`
}

/** Kde všude se kategorie používá (názvy položek) – před smazáním. */
export function categoryUsage(project: Project, categoryId: string) {
  const names = (items: { name: string; categoryId: string }[]) => items.filter((x) => x.categoryId === categoryId).map((x) => x.name)
  const professions = names(project.professions)
  const machines = names(project.machines)
  const materials = names(project.materials)
  // Činnosti, jejichž řádky mají tuto kategorii (každá činnost jednou).
  const tasks = project.tasks.filter((t) => t.lines.some((l) => l.categoryId === categoryId)).map((t) => t.name)
  return { professions, machines, materials, tasks, total: professions.length + machines.length + materials.length + tasks.length }
}

/** Jména pracovníků ve středisku – středisko pak nejde smazat. */
export function departmentUsage(project: Project, departmentId: string): string[] {
  return project.workers.filter((w) => w.departmentId === departmentId).map((w) => w.name)
}

/** Jména pracovníků s danou profesí – profesi pak nejde smazat. */
export function professionUsage(project: Project, professionId: string): string[] {
  return project.workers.filter((w) => w.professionId === professionId).map((w) => w.name)
}

/** Pole řádku činnosti, které odkazuje na položku daného číselníku. */
const LINE_REF: Partial<Record<CatalogKey, string>> = {
  professions: 'professionId',
  workers: 'workerId',
  machines: 'machineId',
  materials: 'materialId',
}

/** Názvy činností, jejichž řádky používají položku databáze – před smazáním (fáze 6b). */
export function lineUsage(project: Project, catalog: CatalogKey, id: string): string[] {
  const field = LINE_REF[catalog]
  if (!field) return []
  return project.tasks.filter((t) => t.lines.some((l) => (l as Record<string, unknown>)[field] === id)).map((t) => t.name)
}

/**
 * Řádky „člověk“ s konkrétním pracovníkem převezmou jeho aktuální profesi (např. po změně
 * profese pracovníka nebo po načtení knihovny). Beze změny vrátí stejný objekt projektu.
 */
export function syncLaborLines(project: Project): Project {
  const professionOf = new Map(project.workers.map((w) => [w.id, w.professionId]))
  let changed = false
  const tasks = project.tasks.map((task) => {
    let taskChanged = false
    const lines = task.lines.map((line) => {
      if (line.kind !== 'labor' || line.workerId === undefined) return line
      const professionId = professionOf.get(line.workerId)
      if (professionId === undefined || professionId === line.professionId) return line
      taskChanged = true
      return { ...line, professionId }
    })
    if (!taskChanged) return task
    changed = true
    return { ...task, lines }
  })
  return changed ? { ...project, tasks } : project
}

/** Smí milník mít tento typ řádku? (nulová délka – jen jednorázový náklad a materiál) */
export const milestoneAllows = (line: TaskLine) => (MILESTONE_LINE_KINDS as readonly string[]).includes(line.kind)
