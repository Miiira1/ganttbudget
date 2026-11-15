/**
 * Databáze (číselníky) zdrojů – pomocné čisté funkce, testy v catalogs.test.ts.
 * Tvar číselníků určuje schema.ts (CategorySchema, ProfessionSchema…).
 */
import { nameKey, type CatalogKey, type Project } from './schema'

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
  return { professions, machines, materials, total: professions.length + machines.length + materials.length }
}

/** Jména pracovníků ve středisku – středisko pak nejde smazat. */
export function departmentUsage(project: Project, departmentId: string): string[] {
  return project.workers.filter((w) => w.departmentId === departmentId).map((w) => w.name)
}

/** Jména pracovníků s danou profesí – profesi pak nejde smazat. */
export function professionUsage(project: Project, professionId: string): string[] {
  return project.workers.filter((w) => w.professionId === professionId).map((w) => w.name)
}
