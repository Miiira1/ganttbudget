/**
 * Soubor projektu (I-01): uložení do JSON a bezpečné načtení zpět.
 *
 * Načítaný soubor může být cokoli (poškozený, cizí, z novější verze, upravený ručně).
 * Proto se před použitím VŽDY ověří schématem Zod (N-10). Neplatná data se nepoužijí
 * ani částečně – výsledkem je buď celý platný projekt, nebo chyba se srozumitelným kódem.
 * Testy: projectFile.test.ts.
 */
import { createDefaultCategories } from '../model/defaultCategories'
import { ProjectSchema, SCHEMA_VERSION, type Project } from '../model/schema'

/**
 * Nejdelší soubor pro IMPORT (CSV, XLSX, MS Project, GanttProject, knihovna zdrojů): 5 MB
 * (znaky ≈ bajty). Souvisí s ochranou proti „bombovým“ souborům, viz ZADANI I-04 až I-07.
 */
export const MAX_FILE_CHARS = 5 * 1024 * 1024

/**
 * Nejdelší SOUBOR PROJEKTU (.ganttbudget.json) a záloha v prohlížeči: 50 MB.
 * Schéma dovolí 5 000 činností a 10 baseline – takový projekt má s odsazením až ~35 MB.
 * Dřív tu byl společný limit 5 MB a velký projekt šel uložit, ale ne znovu otevřít (audit R1).
 */
export const MAX_PROJECT_FILE_CHARS = 50 * 1024 * 1024

/** Přípona souborů projektu. */
export const FILE_EXTENSION = '.ganttbudget.json'

export interface FileIssue {
  /** Kde je problém, např. "tasks.3.name". */
  path: string
  /** Kód problému ze schématu (překládá ho UI). */
  message: string
}

export type ProjectFileError =
  | { code: 'tooLarge' }
  | { code: 'notJson' }
  | { code: 'notProject' }
  | { code: 'newerVersion'; version: number }
  | { code: 'invalid'; issues: FileIssue[] }

/**
 * Projekt → text souboru. Soubor je čitelný JSON s odsazením (na konci nový řádek).
 * `compact` = bez odsazení, asi poloviční velikost – pro zálohu v prohlížeči.
 */
export function serializeProject(project: Project, options: { compact?: boolean } = {}): string {
  return options.compact ? JSON.stringify(project) : `${JSON.stringify(project, null, 2)}\n`
}

/** Vejde se text do limitu souboru projektu, aby šel znovu otevřít? (Počítá bajty v UTF-8.) */
export function projectFileFits(text: string): boolean {
  if (text.length > MAX_PROJECT_FILE_CHARS) return false
  return new TextEncoder().encode(text).length <= MAX_PROJECT_FILE_CHARS
}

/** Text souboru → ověřený projekt, nebo chyba. */
export function parseProjectFile(text: string): { ok: true; project: Project } | { ok: false; error: ProjectFileError } {
  if (text.length > MAX_PROJECT_FILE_CHARS) return { ok: false, error: { code: 'tooLarge' } }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: { code: 'notJson' } }
  }

  // Je to vůbec soubor projektu? (objekt s číselnou verzí formátu)
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, error: { code: 'notProject' } }
  const version = (data as { schemaVersion?: unknown }).schemaVersion
  if (typeof version !== 'number') return { ok: false, error: { code: 'notProject' } }
  if (version > SCHEMA_VERSION) return { ok: false, error: { code: 'newerVersion', version } }

  const result = ProjectSchema.safeParse(version < SCHEMA_VERSION ? migrate(data as Record<string, unknown>, version) : data)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    return { ok: false, error: { code: 'invalid', issues } }
  }
  return { ok: true, project: result.data }
}

/**
 * Převod staršího formátu na aktuální (výsledek se pak ověří schématem jako každý jiný soubor).
 *  - 1 → 2 (fáze 6a): pryč resources, costItems a Task.assignments (byly vždy prázdné);
 *    přibydou výchozí kategorie nákladů podle jazyka projektu, prázdné číselníky a Task.lines.
 */
function migrate(data: Record<string, unknown>, version: number): unknown {
  let current = data
  if (version <= 1) {
    const { resources, costItems, ...rest } = current
    void [resources, costItems]
    const tasks = Array.isArray(rest.tasks) ? rest.tasks : []
    current = {
      ...rest,
      schemaVersion: 2,
      costCategories: createDefaultCategories(typeof rest.language === 'string' ? rest.language : 'en'),
      departments: [],
      professions: [],
      workers: [],
      machines: [],
      materials: [],
      tasks: tasks.map((task: unknown) => {
        if (typeof task !== 'object' || task === null) return task
        const { assignments, ...taskRest } = task as Record<string, unknown>
        void assignments
        return { ...taskRest, lines: [] }
      }),
    }
  }
  return current
}

/** Název souboru z názvu projektu – bez znaků, které Windows v názvu souboru nepovolí. */
export function fileNameFor(project: Project): string {
  const base = project.name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
  return `${base || 'projekt'}${FILE_EXTENSION}`
}
