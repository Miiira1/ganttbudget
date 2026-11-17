/**
 * Spuštění automatické zálohy (I-02): po otevření aplikace obnoví rozpracovaný projekt
 * ze zálohy v prohlížeči a pak zálohuje 1 s po každé změně (a při zavírání záložky).
 * Záloha obsahuje i sbalené fáze (13c) – zálohuje se i po sbalení / rozbalení.
 * Čisté funkce a práce s IndexedDB jsou v autosave.ts.
 */
import type { TFunction } from 'i18next'
import { formatDateTime } from '../i18n/format'
import { attachCollapsed, detachCollapsed } from '../model/collapsedIds'
import { projectStore } from '../store/useProject'
import { showNotice } from '../ui/notice'
import { useViewState } from '../ui/viewState'
import { fromBackup, readBackup, shouldRestore, toBackup, writeBackup } from './autosave'
import { useFileState } from './fileActions'

/** Za jak dlouho po poslední změně se zálohuje (ms). */
const DELAY = 1000

let started = false

export async function startAutosave(t: TFunction, language: string): Promise<void> {
  if (started) return // jen jednou (React ve vývojovém režimu volá efekty dvakrát)
  started = true

  // --- 1. Obnova ---
  const initial = projectStore.getState().project
  const raw = await readBackup()
  if (raw !== null && raw !== undefined) {
    const restored = fromBackup(raw)
    if (!restored.ok) {
      showNotice(t('autosave.corrupted')) // poškozená záloha se nepoužije
    } else if (shouldRestore(projectStore.getState().project, initial)) {
      const { project, collapsed } = detachCollapsed(restored.project)
      projectStore.getState().resetProject(project)
      useViewState.getState().setCollapsed(collapsed)
      // Byl projekt uložený v souboru? Pak není „neuložený“; jinak zůstane označený jako neuložený.
      useFileState.setState({
        savedProject: restored.saved ? project : useFileState.getState().savedProject,
        fileName: restored.fileName,
        handle: null, // přístup k souboru prohlížeč po zavření zapomene – první Uložit se zeptá
      })
      showNotice(t('autosave.restored', { date: formatDateTime(restored.savedAt, language) }), 'info')
    }
  }

  // --- 2. Průběžné zálohování ---
  let timer = 0
  const backupNow = () => {
    window.clearTimeout(timer)
    const project = projectStore.getState().project
    const file = useFileState.getState()
    const withCollapsed = attachCollapsed(project, useViewState.getState().collapsed)
    void writeBackup(toBackup(withCollapsed, { fileName: file.fileName, saved: project === file.savedProject }))
  }
  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(backupNow, DELAY)
  }
  projectStore.subscribe((state, previous) => {
    if (state.project !== previous.project) schedule()
  })
  useFileState.subscribe(schedule)
  useViewState.subscribe((state, previous) => {
    if (state.collapsed !== previous.collapsed) schedule()
  })
  // Při zavírání záložky zálohovat hned (posledních pár vteřin práce by jinak mohlo chybět).
  window.addEventListener('pagehide', backupNow)
}
