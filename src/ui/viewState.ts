/**
 * Stav zobrazení, který NENÍ součástí projektu: které fáze jsou sbalené a který řádek je vybraný.
 * Nejde do historie Zpět/Znovu a zatím se neukládá (ukládání projektu řeší fáze 5).
 */
import { useMemo } from 'react'
import { create } from 'zustand'
import { visibleRows } from '../model/hierarchy'
import type { Project, Task } from '../model/schema'

interface ViewState {
  /** ID sbalených fází. */
  collapsed: ReadonlySet<string>
  toggleCollapsed: (id: string) => void
  /** Vybraný (aktuální) řádek – s ním pracují příkazy Odsadit, Nahoru… */
  selectedId: string | null
  select: (id: string | null) => void
}

export const useViewState = create<ViewState>((set) => ({
  selectedId: null,
  select: (id) => set((s) => (s.selectedId === id ? s : { selectedId: id })),
  collapsed: new Set(),
  toggleCollapsed: (id) =>
    set(({ collapsed }) => {
      const next = new Set(collapsed)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { collapsed: next }
    }),
}))

/**
 * Vybraný řádek, ale jen pokud v projektu opravdu je (po Zpět nebo smazání mohl zmizet)
 * a není schovaný ve sbalené fázi.
 */
export function useSelectedId(project: Project): string | null {
  const selectedId = useViewState((s) => s.selectedId)
  const rows = useVisibleRows(project)
  return selectedId !== null && rows.some((t) => t.id === selectedId) ? selectedId : null
}

/** Řádky, které jsou právě vidět (bez položek ve sbalených fázích) – stejné pro tabulku i graf. */
export function useVisibleRows(project: Project): Task[] {
  const collapsed = useViewState((s) => s.collapsed)
  return useMemo(() => visibleRows(project, collapsed), [project, collapsed])
}
