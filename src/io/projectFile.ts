/**
 * Soubor projektu (I-01): uložení do JSON a bezpečné načtení zpět.
 *
 * Načítaný soubor může být cokoli (poškozený, cizí, z novější verze, upravený ručně).
 * Proto se před použitím VŽDY ověří schématem Zod (N-10). Neplatná data se nepoužijí
 * ani částečně – výsledkem je buď celý platný projekt, nebo chyba se srozumitelným kódem.
 * Testy: projectFile.test.ts.
 */
import { ProjectSchema, SCHEMA_VERSION, type Project } from '../model/schema'

/** Nejdelší soubor, který aplikace přečte (znaky ≈ bajty; 5 MB je pro 5 000 činností víc než dost). */
export const MAX_FILE_CHARS = 5 * 1024 * 1024

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

/** Projekt → text souboru (čitelný JSON s odsazením, na konci nový řádek). */
export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`
}

/** Text souboru → ověřený projekt, nebo chyba. */
export function parseProjectFile(text: string): { ok: true; project: Project } | { ok: false; error: ProjectFileError } {
  if (text.length > MAX_FILE_CHARS) return { ok: false, error: { code: 'tooLarge' } }

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

  const result = ProjectSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    return { ok: false, error: { code: 'invalid', issues } }
  }
  return { ok: true, project: result.data }
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
