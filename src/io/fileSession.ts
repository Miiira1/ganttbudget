/**
 * Napojení na soubor při Zpět / Znovu (audit 2026-11, nález V1 a V2).
 *
 * „Otevřít“, „Nový“ a „Vzorový projekt“ nahradí celý projekt a jde je vrátit Ctrl+Z.
 * Aplikace si ale zvlášť pamatuje, do kterého souboru má Ctrl+S ukládat (název a odkaz
 * na soubor). Bez tohoto modulu by Zpět vrátilo starý projekt, ale napojení by zůstalo
 * na novém souboru – a Ctrl+S by do něj zapsalo cizí obsah.
 *
 * Řešení: při každé takové výměně si zapamatujeme dvojici „projekt před → projekt po“
 * a stav souboru na obou stranách. Když pak Zpět nebo Znovu přejde přesně přes tuto
 * hranici, vrátí se i napojení na soubor, které k dané straně patří.
 * Běžné úpravy se nijak nedotkne.
 */
import type { StoreApi } from 'zustand/vanilla'
import type { Project } from '../model/schema'

export interface FileSessions<F> {
  /**
   * Vymění projekt (`load` ho skutečně načte jako jeden krok historie) a nastaví nové
   * napojení na soubor `file`. Zapamatuje si hranici pro Zpět / Znovu.
   */
  switchProject(load: () => void, file: Partial<F>): void
}

export function trackFileSessions<F extends object>(
  projectStore: StoreApi<{ project: Project }>,
  fileStore: StoreApi<F>,
): FileSessions<F> {
  /** Stav souboru, který platí po příchodu na projekt (klíč 1) z projektu (klíč 2). */
  const arrivals = new WeakMap<Project, WeakMap<Project, F>>()

  function remember(arriveAt: Project, comingFrom: Project, file: F): void {
    let byOrigin = arrivals.get(arriveAt)
    if (!byOrigin) {
      byOrigin = new WeakMap()
      arrivals.set(arriveAt, byOrigin)
    }
    byOrigin.set(comingFrom, file)
  }

  projectStore.subscribe((state, previous) => {
    if (state.project === previous.project) return
    const file = arrivals.get(state.project)?.get(previous.project)
    if (!file) return // běžná úprava, ne přechod přes hranici
    // Opouštěná strana si uloží svůj aktuální stav (např. po „Uložit jako“) pro cestu zpátky.
    remember(previous.project, state.project, fileStore.getState())
    fileStore.setState(file, true)
  })

  return {
    switchProject(load, file) {
      const before = projectStore.getState().project
      const beforeFile = fileStore.getState()
      load()
      fileStore.setState(file)
      const after = projectStore.getState().project
      if (after === before) return // nic se nevyměnilo, žádná hranice
      remember(before, after, beforeFile)
      remember(after, before, fileStore.getState())
    },
  }
}
