/**
 * Práce se soubory projektu (I-01, N-08): Nový, Otevřít, Uložit, Uložit jako.
 *
 * - V Chrome a Edge se použije přímý zápis do souboru (File System Access API):
 *   „Uložit“ se zeptá na místo jen poprvé, pak zapisuje do stejného souboru.
 * - Jinde (Firefox, Safari) se soubor stáhne a otevírá se výběrem souboru.
 * - Každý otevíraný soubor se před použitím ověří (projectFile.ts → schéma Zod).
 * - Aplikace si pamatuje verzi projektu z posledního uložení / otevření; jiná verze = „neuloženo“.
 * - Sbalené fáze se uloží se souborem a po otevření obnoví (13c, model/collapsedIds.ts); samotné
 *   sbalení projekt „neuloženým“ nedělá – je to jen zobrazení.
 *   Nový a Otevřít se před zahozením neuložených změn zeptají.
 *
 * Nic se neposílá na server – soubor zůstává v počítači uživatele.
 */
import type { TFunction } from 'i18next'
import { create } from 'zustand'
import { attachCollapsed, detachCollapsed } from '../model/collapsedIds'
import { createEmptyProject, type Project } from '../model/schema'
import { projectStore } from '../store/useProject'
import { showNotice } from '../ui/notice'
import { useViewState } from '../ui/viewState'
import { trackFileSessions } from './fileSession'
import { issueWhere } from './issueWhere'
import {
  fileNameFor,
  MAX_PROJECT_FILE_CHARS,
  parseProjectFile,
  projectFileFits,
  serializeProject,
  type ProjectFileError,
} from './projectFile'

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

/** Hlídá, aby Zpět / Znovu přes „Otevřít“, „Nový“ a vzorový projekt vrátilo i napojení na soubor. */
const fileSessions = trackFileSessions(projectStore, useFileState)

/** Nahradí celý projekt (jeden krok Zpět) a nastaví, ke kterému souboru patří. */
function switchProject(next: Project, file: Partial<FileState>): void {
  fileSessions.switchProject(() => projectStore.getState().loadProject(next), file)
}

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

/** „u činnosti č. 4“ místo technické cesty „tasks.3.durationDays“ (audit U2). */
export function issueWhereText(path: string, t: TFunction): string {
  const { key, number } = issueWhere(path)
  return t(`file.where.${key}`, { number })
}

/** Text srozumitelné chyby souboru. */
export function fileErrorText(error: ProjectFileError, t: TFunction): string {
  switch (error.code) {
    case 'invalid':
      return t('file.error.invalid', { count: error.issues.length, where: issueWhereText(error.issues[0]?.path ?? '', t) })
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
  switchProject(next, { savedProject: next, fileName: null, handle: null })
  useViewState.getState().setCollapsed(new Set())
  return true
}

/**
 * Načte vzorový projekt (dotaz na nahrazení plánu dělá volající). Odpojí ho od otevřeného
 * souboru, aby Ctrl+S nepřepsalo původní soubor vzorem – první Uložit se zeptá na místo.
 * Vzor zůstane označený jako neuložený. Jde vrátit Ctrl+Z (i s napojením na soubor).
 */
export function loadSampleProject(sample: Project): void {
  switchProject(sample, { fileName: null, handle: null })
  useViewState.getState().setCollapsed(new Set())
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
  const text = serializeProject(attachCollapsed(project, useViewState.getState().collapsed))
  const blob = new Blob([text], { type: 'application/json' })
  try {
    const previous = asNew ? null : useFileState.getState().handle
    const saved = await saveBlob(blob, fileNameFor(project), pickerTypes(t)[0]!, previous)
    useFileState.setState({ savedProject: project, fileName: saved.name, handle: saved.handle })
    // Firefox / Safari soubor jen stáhnou – začátečník by nevěděl kam (audit U8). Chrome/Edge mají vlastní okno.
    if (saved.handle === null) showNotice(t('file.savedDownload', { name: saved.name }), 'info')
    // Pojistka (audit R1): uložit vždy (data se neztratí), ale varovat, když soubor nepůjde otevřít.
    if (!projectFileFits(text)) showNotice(t('file.error.tooLargeToReopen'))
  } catch (error) {
    if (!isAbort(error)) showNotice(t('file.error.saveFailed'))
  }
}

/** Načte text vybraného souboru, ověří ho a otevře projekt (jde vrátit Ctrl+Z). */
async function openFromFile(file: File, handle: FileHandle | null, t: TFunction): Promise<void> {
  if (file.size > MAX_PROJECT_FILE_CHARS) {
    showNotice(fileErrorText({ code: 'tooLarge' }, t))
    return
  }
  const result = parseProjectFile(await file.text())
  if (!result.ok) {
    showNotice(fileErrorText(result.error, t)) // nic se nemění
    return
  }
  const { project, collapsed } = detachCollapsed(result.project)
  switchProject(project, { savedProject: project, fileName: file.name, handle })
  useViewState.getState().setCollapsed(collapsed)
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
