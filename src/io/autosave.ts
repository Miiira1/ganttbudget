/**
 * Automatická záloha rozpracovaného projektu v prohlížeči (I-02).
 *
 * Projekt se průběžně ukládá do IndexedDB (úložiště prohlížeče, jen v tomto počítači).
 * Po zavření a znovuotevření záložky se sám obnoví. Záloha se před použitím ověří stejně
 * jako soubor projektu (projectFile.ts → schéma Zod) – poškozená se nepoužije.
 *
 * Tento soubor obsahuje čisté funkce (testy v autosave.test.ts) a malý obal IndexedDB
 * bez knihovny. Spuštění zálohování: autosaveRunner.ts.
 */
import type { Project } from '../model/schema'
import { parseProjectFile, serializeProject } from './projectFile'

/** Jeden záznam zálohy. */
export interface Backup {
  /** Kdy se zálohovalo (ISO čas). */
  savedAt: string
  /** Projekt jako text souboru (stejný formát jako .ganttbudget.json). */
  text: string
  /** Název souboru, do kterého se projekt ukládal (null = ještě nikdy). */
  fileName: string | null
  /** Byl projekt v době zálohy uložený v souboru (žádné neuložené změny)? */
  saved: boolean
}

export function toBackup(project: Project, state: { fileName: string | null; saved: boolean }, now = new Date()): Backup {
  return { savedAt: now.toISOString(), text: serializeProject(project), fileName: state.fileName, saved: state.saved }
}

/** Záznam z prohlížeče → ověřený projekt. Cokoli neplatného se nepoužije. */
export function fromBackup(
  raw: unknown,
): { ok: true; project: Project; fileName: string | null; saved: boolean; savedAt: string } | { ok: false } {
  if (typeof raw !== 'object' || raw === null) return { ok: false }
  const record = raw as Partial<Backup>
  if (typeof record.text !== 'string' || typeof record.savedAt !== 'string') return { ok: false }
  const parsed = parseProjectFile(record.text)
  if (!parsed.ok) return { ok: false }
  return {
    ok: true,
    project: parsed.project,
    fileName: typeof record.fileName === 'string' ? record.fileName : null,
    saved: record.saved === true,
    savedAt: record.savedAt,
  }
}

/** Obnovit ze zálohy jen tehdy, když uživatel mezitím nic nezměnil (nic se nepřepíše). */
export function shouldRestore(current: Project, initial: Project): boolean {
  return current === initial
}

// --- IndexedDB (úložiště prohlížeče) ---
const DB_NAME = 'ganttbudget'
const STORE = 'autosave'
const KEY = 'current'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Uloží zálohu. Když prohlížeč úložiště nedovolí (anonymní okno…), tiše nic. */
export async function writeBackup(backup: Backup): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(backup, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Záloha není k dispozici – aplikace funguje dál, jen bez ní.
  }
}

/** Přečte uloženou zálohu (neověřenou – ověří fromBackup). */
export async function readBackup(): Promise<unknown> {
  try {
    const db = await openDb()
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return value
  } catch {
    return null
  }
}
