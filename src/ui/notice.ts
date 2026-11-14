/**
 * Upozornění pro uživatele (např. chybný zápis předchůdců) zobrazené v liště nahoře.
 * Není součástí projektu, proto nejde do historie Zpět / Znovu.
 *
 * Upozornění si pamatuje verzi projektu, ke které patří. Při další změně projektu zmizí,
 * ale ne hned po změně, která ho vyvolala (např. „začátek drží vazba“ po tažení úsečky).
 * Druh: 'warning' (žluté ⚠, výchozí) nebo 'info' (modré ℹ, např. obnovení ze zálohy).
 */
import { create } from 'zustand'
import type { Project } from '../model/schema'
import { projectStore } from '../store/useProject'

export type NoticeKind = 'warning' | 'info'

interface NoticeState {
  message: string | null
  kind: NoticeKind
  /** Verze projektu, ke které upozornění patří. */
  shownFor: Project | null
  show: (message: string, kind?: NoticeKind) => void
  clear: () => void
  /** Smaže upozornění, pokud patří ke starší verzi projektu. */
  clearIfStale: (project: Project) => void
}

export const useNotice = create<NoticeState>()((set, get) => ({
  message: null,
  kind: 'warning',
  shownFor: null,
  show: (message, kind = 'warning') => set({ message, kind, shownFor: projectStore.getState().project }),
  clear: () => set({ message: null, shownFor: null }),
  clearIfStale: (project) => {
    if (get().message !== null && get().shownFor !== project) set({ message: null, shownFor: null })
  },
}))

export const showNotice = (message: string, kind?: NoticeKind): void => useNotice.getState().show(message, kind)
