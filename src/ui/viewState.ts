/**
 * Stav zobrazení, který NENÍ součástí projektu: které fáze jsou sbalené a které řádky jsou vybrané.
 * Nejde do historie Zpět/Znovu a neukládá se (ukládání sbalení řeší fáze 13).
 *
 * Výběr: klik vybere jeden řádek, Ctrl+klik řádek přidá / odebere, Shift+klik vybere rozsah
 * od kotvy (posledního kliknutého řádku). Esc nechá vybraný jen aktuální řádek.
 */
import { useMemo } from 'react'
import { create } from 'zustand'
import { visibleRows } from '../model/hierarchy'
import { rangeIds, toggleId } from '../model/selection'
import type { Project, Task } from '../model/schema'
import { projectStore } from '../store/useProject'

interface ViewState {
  /** ID sbalených fází. */
  collapsed: ReadonlySet<string>
  toggleCollapsed: (id: string) => void
  /** Aktuální řádek (kde je kurzor) – sem se např. vloží nová činnost. */
  selectedId: string | null
  /** Všechny vybrané řádky (aktuální mezi nimi, pokud není null). */
  selectedIds: ReadonlySet<string>
  /** Kotva pro Shift+klik. */
  anchorId: string | null
  /** Vybrat jen tento řádek. */
  select: (id: string | null) => void
  /** Vybrat tyto řádky; `current` bude aktuální. */
  selectMany: (ids: Iterable<string>, current: string | null) => void
  /** Ctrl+klik. */
  toggleSelect: (id: string) => void
  /** Shift+klik: rozsah od kotvy v pořadí řádků, jak jsou vidět. */
  selectRange: (rows: readonly { id: string }[], id: string) => void
  /** Esc: zrušit hromadný výběr (zůstane aktuální řádek). */
  clearMultiSelection: () => void
}

const single = (id: string | null) => ({
  selectedId: id,
  selectedIds: new Set(id === null ? [] : [id]) as ReadonlySet<string>,
  anchorId: id,
})

export const useViewState = create<ViewState>((set) => ({
  ...single(null),
  select: (id) => set((s) => (s.selectedId === id && s.selectedIds.size === (id === null ? 0 : 1) ? s : single(id))),
  selectMany: (ids, current) => set({ selectedIds: new Set(ids), selectedId: current, anchorId: current }),
  toggleSelect: (id) =>
    set((s) => {
      const selectedIds = toggleId(s.selectedIds, id)
      const selectedId = selectedIds.has(id) ? id : s.selectedId === id ? ([...selectedIds].at(-1) ?? null) : s.selectedId
      return { selectedIds, selectedId, anchorId: id }
    }),
  selectRange: (rows, id) =>
    set((s) => ({ selectedIds: new Set(rangeIds(rows, s.anchorId ?? s.selectedId, id)), selectedId: id })),
  clearMultiSelection: () => set((s) => (s.selectedIds.size <= 1 ? s : single(s.selectedId))),
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

/** Vybrané řádky, které jsou právě vidět (v pořadí řádků). */
export function useSelectedIds(project: Project): string[] {
  const selectedIds = useViewState((s) => s.selectedIds)
  const rows = useVisibleRows(project)
  return useMemo(() => rows.filter((t) => selectedIds.has(t.id)).map((t) => t.id), [rows, selectedIds])
}

/** Vybrané řádky pro příkazy (mimo React): existující a viditelné, v pořadí řádků. */
export function currentSelection(project: Project): string[] {
  const { selectedIds, collapsed } = useViewState.getState()
  return visibleRows(project, collapsed)
    .filter((t) => selectedIds.has(t.id))
    .map((t) => t.id)
}

/** Řádky, které jsou právě vidět (bez položek ve sbalených fázích) – stejné pro tabulku i graf. */
export function useVisibleRows(project: Project): Task[] {
  const collapsed = useViewState((s) => s.collapsed)
  return useMemo(() => visibleRows(project, collapsed), [project, collapsed])
}

/**
 * Výběr myší podle kláves: Ctrl/⌘ = přidat / odebrat, Shift = rozsah, jinak jen tento řádek.
 * Vrátí true, když šlo o hromadný výběr (volající pak nemá dělat nic dalšího, např. psaní nebo tažení).
 */
export function selectWithModifiers(
  event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  id: string,
): boolean {
  const state = useViewState.getState()
  if (event.ctrlKey || event.metaKey) {
    state.toggleSelect(id)
    return true
  }
  if (event.shiftKey) {
    state.selectRange(visibleRows(projectStore.getState().project, state.collapsed), id)
    return true
  }
  // Klik na už vybraný řádek hromadný výběr nezruší hned – mohl by to být začátek tažení skupiny.
  if (!state.selectedIds.has(id) || state.selectedIds.size <= 1) state.select(id)
  return false
}

/** Obyčejné kliknutí (bez tažení) na řádek z hromadného výběru: teď už vybrat jen tento řádek. */
export function finishPlainClick(event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }, id: string): void {
  if (event.ctrlKey || event.metaKey || event.shiftKey) return
  const state = useViewState.getState()
  if (state.selectedIds.size > 1) state.select(id)
}
