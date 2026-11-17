/**
 * Práce se soubory projektu (I-01, N-08): Nový, Otevřít, Uložit, Uložit jako.
 *
 * - V Chrome a Edge se použije přímý zápis do souboru (File System Access API):
 *   „Uložit“ se zeptá na místo jen poprvé, pak zapisuje do stejného souboru.
 * - Jinde (Firefox, Safari) se soubor stáhne a otevírá se výběrem souboru.
 * - Každý otevíraný soubor se před použitím ověří (projectFile.ts → schéma Zod).
 * - Aplikace si pamatuje verzi projektu z posledního uložení / otevření; jiná verze = „neuloženo“.
 *   Nový a Otevřít se před zahozením neuložených změn zeptají.
 *
 * Nic se neposílá na server – soubor zůstává v počítači uživatele.
 */
import type { TFunction } from 'i18next'
import { create } from 'zustand'
import { createEmptyProject, type Project } from '../model/schema'
import { projectStore } from '../store/useProject'
import { showNotice } from '../ui/notice'
import { fileNameFor, MAX_FILE_CHARS, parseProjectFile, serializeProject, type ProjectFileError } from './projectFile'

// --- Minimální popis File System Access API (není ve všech prohlížečích ani v typech TypeScriptu) ---
export interface FileHandle {
  name: string
  getFile(): Promise<File>
  createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void> }>
}
interface PickerOptions {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
}
interface FileSystemAccessWindow {
  showSaveFilePicker?: (options: PickerOptions) => Promise<FileHandle>
  showOpenFilePicker?: (options: PickerOptions) => Promise<FileHandle[]>
}
const fsa = window as unknown as FileSystemAccessWindow

const pickerTypes = (t: TFunction) => [{ description: t('file.fileType'), accept: { 'application/json': ['.json'] } }]

interface FileState {
  /** Verze projektu, která je uložená v souboru (nebo nový prázdný projekt). */
  savedProject: Project
  /** Název otevřeného / uloženého souboru (null = ještě neuloženo). */
  fileName: string | null
  /** Soubor, do kterého jde „Uložit“ zapisovat přímo (jen Chrome/Edge). */
  handle: FileHandle | null
}

export const useFileState = create<FileState>(() => ({
  savedProject: projectStore.getState().project,
  fileName: null,
  handle: null,
}))

/** Má projekt změny, které nejsou v souboru? (Zpět až k uložené verzi = zase uloženo.) */
export function isDirty(project: Project = projectStore.getState().project): boolean {
  return project !== useFileState.getState().savedProject
}

/** Zeptá se, jestli zahodit neuložené změny. Bez změn se neptá. */
function confirmDiscard(t: TFunction): boolean {
  return !isDirty() || window.confirm(t('file.confirmDiscard'))
}

/** Uživatel výběr souboru zavřel (Storno) – to není chyba. */
function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Text srozumitelné chyby souboru. */
export function fileErrorText(error: ProjectFileError, t: TFunction): string {
  switch (error.code) {
    case 'invalid':
      return t('file.error.invalid', { count: error.issues.length, where: error.issues[0]?.path ?? '' })
    case 'newerVersion':
      return t('file.error.newerVersion', { version: error.version })
    default:
      return t(`file.error.${error.code}`)
  }
}

/**
 * Nový projekt (po potvrzení, pokud jsou neuložené změny). Jde vrátit Ctrl+Z.
 * Bez `project` prázdný; s ním projekt připravený jinde (šablona, fáze 10). Vrátí false, když uživatel zrušil.
 */
export function newProject(t: TFunction, language: string, project?: Project): boolean {
  if (!confirmDiscard(t)) return false
  const next = project ?? createEmptyProject({ name: t('project.defaultName'), language })
  projectStore.getState().loadProject(next)
  useFileState.setState({ savedProject: next, fileName: null, handle: null })
  return true
}

/**
 * Uloží obsah do souboru: v Chrome/Edge přes okno pro uložení (do `handle`, pokud je zadaný),
 * jinde stažením. Vrátí soubor, do kterého se zapisovalo (jen Chrome/Edge), nebo null.
 * Zrušení okna uživatelem vyhodí AbortError (volající ho ignoruje).
 */
export async function saveBlob(
  blob: Blob,
  suggestedName: string,
  type: { description: string; accept: Record<string, string[]> },
  handle: FileHandle | null = null,
): Promise<{ handle: FileHandle | null; name: string }> {
  if (fsa.showSaveFilePicker) {
    const target = handle ?? (await fsa.showSaveFilePicker({ suggestedName, types: [type] }))
    const writable = await target.createWritable()
    await writable.write(blob)
    await writable.close()
    return { handle: target, name: target.name }
  }
  // Náhrada: soubor se stáhne do složky Stažené soubory.
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = suggestedName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { handle: null, name: suggestedName }
}

/** Uložit (asNew = Uložit jako… – vždy se zeptá na místo a název). */
export async function saveProject(t: TFunction, asNew = false): Promise<void> {
  const project = projectStore.getState().project
  const blob = new Blob([serializeProject(project)], { type: 'application/json' })
  try {
    const previous = asNew ? null : useFileState.getState().handle
    const saved = await saveBlob(blob, fileNameFor(project), pickerTypes(t)[0]!, previous)
    useFileState.setState({ savedProject: project, fileName: saved.name, handle: saved.handle })
  } catch (error) {
    if (!isAbort(error)) showNotice(t('file.error.saveFailed'))
  }
}

/** Načte text vybraného souboru, ověří ho a otevře projekt (jde vrátit Ctrl+Z). */
async function openFromFile(file: File, handle: FileHandle | null, t: TFunction): Promise<void> {
  if (file.size > MAX_FILE_CHARS) {
    showNotice(fileErrorText({ code: 'tooLarge' }, t))
    return
  }
  const result = parseProjectFile(await file.text())
  if (!result.ok) {
    showNotice(fileErrorText(result.error, t)) // nic se nemění
    return
  }
  projectStore.getState().loadProject(result.project)
  useFileState.setState({ savedProject: result.project, fileName: file.name, handle })
}

/** Otevřít… (po potvrzení, pokud jsou neuložené změny). */
export async function openProject(t: TFunction): Promise<void> {
  if (!confirmDiscard(t)) return
  try {
    if (fsa.showOpenFilePicker) {
      const [handle] = await fsa.showOpenFilePicker({ types: pickerTypes(t) })
      if (handle) await openFromFile(await handle.getFile(), handle, t)
      return
    }
    // Náhrada: skrytý výběr souboru.
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) void openFromFile(file, null, t)
    }
    input.click()
  } catch (error) {
    if (!isAbort(error)) showNotice(t('file.error.openFailed'))
  }
}
