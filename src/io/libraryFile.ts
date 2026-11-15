/**
 * Knihovna zdrojů (Z-05): číselníky projektu jako samostatný soubor `název.ganttbudget-lib.json`,
 * který jde načíst do jiného projektu. Testy: libraryFile.test.ts.
 *
 * Načítaný soubor se před použitím ověří schématem Zod (N-10). Sloučení do projektu:
 *  - položky se párují podle NÁZVU v číselníku (bez ohledu na velikost písmen a mezery),
 *  - chybějící se přidají s novým ID, změněné převezmou hodnoty z knihovny (ID zůstane),
 *  - nic se nemaže; odkazy (profese, kategorie, středisko) se přemapují podle názvů.
 */
import { z } from 'zod'
import {
  CATALOG_KEYS,
  CategorySchema,
  checkCatalogs,
  DepartmentSchema,
  MachineSchema,
  MAX_CATALOG_ITEMS,
  MaterialSchema,
  nameKey,
  ProfessionSchema,
  WorkerSchema,
  type CatalogKey,
  type Project,
} from '../model/schema'
import { FILE_EXTENSION, fileNameFor, MAX_FILE_CHARS, type FileIssue } from './projectFile'

export const LIBRARY_VERSION = 1
export const LIBRARY_EXTENSION = '.ganttbudget-lib.json'

export const LibrarySchema = z
  .object({
    kind: z.literal('ganttbudget-library'),
    libraryVersion: z.literal(LIBRARY_VERSION),
    /** Měna cen v knihovně – musí sedět s měnou projektu. */
    currency: z.string().regex(/^[A-Z]{3}$/),
    costCategories: z.array(CategorySchema).max(MAX_CATALOG_ITEMS),
    departments: z.array(DepartmentSchema).max(MAX_CATALOG_ITEMS).default([]),
    professions: z.array(ProfessionSchema).max(MAX_CATALOG_ITEMS),
    workers: z.array(WorkerSchema).max(MAX_CATALOG_ITEMS),
    machines: z.array(MachineSchema).max(MAX_CATALOG_ITEMS),
    materials: z.array(MaterialSchema).max(MAX_CATALOG_ITEMS),
  })
  .superRefine((library, ctx) => checkCatalogs(library, ctx))

export type Library = z.infer<typeof LibrarySchema>

export type LibraryFileError =
  | { code: 'tooLarge' }
  | { code: 'notJson' }
  | { code: 'notLibrary' }
  | { code: 'newerVersion'; version: number }
  | { code: 'invalid'; issues: FileIssue[] }

/** Číselníky projektu → knihovna. */
export function buildLibrary(project: Project): Library {
  const library: Library = {
    kind: 'ganttbudget-library',
    libraryVersion: LIBRARY_VERSION,
    currency: project.currency,
    costCategories: project.costCategories,
    departments: project.departments,
    professions: project.professions,
    workers: project.workers,
    machines: project.machines,
    materials: project.materials,
  }
  return library
}

export function serializeLibrary(library: Library): string {
  return `${JSON.stringify(library, null, 2)}\n`
}

/** Název souboru knihovny podle názvu projektu. */
export function libraryFileName(project: Project): string {
  return fileNameFor(project).slice(0, -FILE_EXTENSION.length) + LIBRARY_EXTENSION
}

export function parseLibraryFile(text: string): { ok: true; library: Library } | { ok: false; error: LibraryFileError } {
  if (text.length > MAX_FILE_CHARS) return { ok: false, error: { code: 'tooLarge' } }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: { code: 'notJson' } }
  }
  if (typeof data !== 'object' || data === null || (data as { kind?: unknown }).kind !== 'ganttbudget-library') {
    return { ok: false, error: { code: 'notLibrary' } }
  }
  const version = (data as { libraryVersion?: unknown }).libraryVersion
  if (typeof version !== 'number') return { ok: false, error: { code: 'notLibrary' } }
  if (version > LIBRARY_VERSION) return { ok: false, error: { code: 'newerVersion', version } }
  const result = LibrarySchema.safeParse(data)
  if (!result.success) {
    return { ok: false, error: { code: 'invalid', issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } }
  }
  return { ok: true, library: result.data }
}

// ---------------------------------------------------------------------------
// Sloučení do projektu
// ---------------------------------------------------------------------------

export interface MergeCount {
  added: number
  changed: number
  unchanged: number
}

/** Pořadí sloučení: nejdřív číselníky, na které ostatní odkazují. */
const ORDER = ['costCategories', 'departments', 'professions', 'workers', 'machines', 'materials'] as const satisfies readonly CatalogKey[]

/** Které údaje položky jsou odkazy a do kterého číselníku. */
const REFERENCES: Record<CatalogKey, [field: string, catalog: CatalogKey][]> = {
  costCategories: [],
  departments: [],
  professions: [['categoryId', 'costCategories']],
  workers: [
    ['professionId', 'professions'],
    ['departmentId', 'departments'],
  ],
  machines: [['categoryId', 'costCategories']],
  materials: [['categoryId', 'costCategories']],
}

/** Porovnání bez ohledu na pořadí klíčů v objektu. */
function sameContent(a: unknown, b: unknown): boolean {
  const sorted = (value: unknown): unknown =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .sort(([x], [y]) => x.localeCompare(y))
            .map(([k, v]) => [k, sorted(v)]),
        )
      : value
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))
}

type Item = { id: string; name: string } & Record<string, unknown>

function computeMerge(project: Project, library: Library, makeId: () => string) {
  const idMap = Object.fromEntries(CATALOG_KEYS.map((k) => [k, new Map<string, string>()])) as Record<CatalogKey, Map<string, string>>
  const counts = Object.fromEntries(CATALOG_KEYS.map((k) => [k, { added: 0, changed: 0, unchanged: 0 }])) as Record<CatalogKey, MergeCount>
  const next: Project = { ...project }
  let changedAny = false

  for (const key of ORDER) {
    const list = [...(project[key] as Item[])]
    const byName = new Map(list.map((x, i) => [nameKey(x.name), i]))
    for (const libraryItem of library[key] as Item[]) {
      const mapped: Item = { ...libraryItem }
      for (const [field, catalog] of REFERENCES[key]) {
        const ref = mapped[field]
        if (typeof ref === 'string') mapped[field] = idMap[catalog].get(ref) ?? ref
      }
      const index = byName.get(nameKey(libraryItem.name))
      if (index === undefined) {
        const id = makeId()
        list.push({ ...mapped, id })
        byName.set(nameKey(libraryItem.name), list.length - 1)
        idMap[key].set(libraryItem.id, id)
        counts[key].added++
        continue
      }
      const existing = list[index] as Item
      idMap[key].set(libraryItem.id, existing.id)
      const candidate = { ...mapped, id: existing.id }
      if (sameContent(candidate, existing)) {
        counts[key].unchanged++
      } else {
        list[index] = candidate
        counts[key].changed++
      }
    }
    if (counts[key].added + counts[key].changed > 0) {
      ;(next as Record<CatalogKey, unknown>)[key] = list
      changedAny = true
    }
  }
  return { project: changedAny ? next : project, counts }
}

/** Náhled: kolik položek v každém číselníku přibude / změní se / zůstane; nesedí měna? */
export function planMerge(project: Project, library: Library): { counts: Record<CatalogKey, MergeCount>; currencyMismatch: boolean } {
  return { counts: computeMerge(project, library, () => 'preview').counts, currencyMismatch: project.currency !== library.currency }
}

/** Sloučení knihovny do projektu (volající ověří měnu – viz planMerge). */
export function mergeLibrary(project: Project, library: Library, makeId: () => string): Project {
  return computeMerge(project, library, makeId).project
}
