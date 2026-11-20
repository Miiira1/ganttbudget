/**
 * Knihovna zdrojů (Z-05) – akce z menu Soubor: export číselníků do souboru a načtení
 * knihovny do projektu (po náhledu v LibraryDialog.tsx, jeden krok Zpět).
 * Soubor se nikam neposílá.
 */
import type { TFunction } from 'i18next'
import { create } from 'zustand'
import { projectStore } from '../store/useProject'
import { showNotice } from '../ui/notice'
import { issueWhereText, saveBlob } from './fileActions'
import { buildLibrary, libraryFileName, mergeLibrary, parseLibraryFile, serializeLibrary, type Library, type LibraryFileError } from './libraryFile'
import { MAX_FILE_CHARS } from './projectFile'
import { syncLaborLines } from '../model/catalogs'

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

export async function exportLibrary(t: TFunction): Promise<void> {
  const project = projectStore.getState().project
  const blob = new Blob([serializeLibrary(buildLibrary(project))], { type: 'application/json' })
  try {
    await saveBlob(blob, libraryFileName(project), { description: t('library.fileType'), accept: { 'application/json': ['.json'] } })
  } catch (error) {
    if (!isAbort(error)) showNotice(t('library.error.saveFailed'))
  }
}

interface PendingLibrary {
  fileName: string
  library: Library
}

/** Knihovna čekající na potvrzení v dialogu (null = dialog zavřený). */
export const useLibraryState = create<{ pending: PendingLibrary | null }>(() => ({ pending: null }))

export function libraryErrorText(error: LibraryFileError, t: TFunction): string {
  if (error.code === 'invalid') return t('library.error.invalid', { count: error.issues.length, where: issueWhereText(error.issues[0]?.path ?? '', t) })
  if (error.code === 'newerVersion') return t('library.error.newerVersion', { version: error.version })
  return t(`library.error.${error.code}`)
}

async function readLibrary(file: File, t: TFunction): Promise<void> {
  if (file.size > MAX_FILE_CHARS) return showNotice(t('library.error.tooLarge'))
  const result = parseLibraryFile(await file.text())
  if (!result.ok) return showNotice(libraryErrorText(result.error, t)) // nic se nemění
  useLibraryState.setState({ pending: { fileName: file.name, library: result.library } })
}

/** Načíst knihovnu zdrojů… – výběr souboru, pak náhled. */
export function startLibraryImport(t: TFunction): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) void readLibrary(file, t)
  }
  input.click()
}

/** Potvrzení v dialogu: sloučit knihovnu do projektu (jeden krok Zpět). */
export function confirmLibrary(library: Library): void {
  const store = projectStore.getState()
  // Pracovník mohl v knihovně dostat jinou profesi – řádky činností s ním ji převezmou.
  const merged = syncLaborLines(mergeLibrary(store.project, library, () => crypto.randomUUID()))
  if (merged !== store.project) store.loadProject(merged)
  useLibraryState.setState({ pending: null })
}

export function cancelLibrary(): void {
  useLibraryState.setState({ pending: null })
}
