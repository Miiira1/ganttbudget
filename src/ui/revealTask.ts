/**
 * Ukázat položku v plánu: rozbalí sbalené nadřazené fáze, vybere řádek a po vykreslení na něj najede
 * (v tabulce i v grafu). Přepnutí na pohled Plán dělá volající (onShowPlan) – stav pohledu drží App.
 * Používá pohled Vytížení (fáze 6c) a Kontrola plánu (fáze 10).
 *
 * U velkého plánu se kreslí jen řádky v okně (virtualRows.ts, audit R3) – řádek mimo okno na stránce
 * vůbec není. Proto se nejdřív posune panel podle pořadí řádku a teprve potom se řádek hledá.
 */
import { visibleRows } from '../model/hierarchy'
import { projectStore } from '../store/useProject'
import { useViewState } from './viewState'
import { scrollRowIntoView } from './virtualRows'

/** Posune tabulku (a s ní graf) tak, aby byl řádek činnosti v okně – i když ještě není vykreslený. */
export function scrollTaskIntoView(id: string): void {
  const rows = visibleRows(projectStore.getState().project, useViewState.getState().collapsed)
  scrollRowIntoView(rows.findIndex((task) => task.id === id))
}

/** Spustí `action` až po posunu k řádku a jeho vykreslení (dva snímky + chvilka na událost scroll). */
export function afterTaskShown(id: string, action: () => void): void {
  requestAnimationFrame(() => {
    scrollTaskIntoView(id)
    setTimeout(() => requestAnimationFrame(action), 30)
  })
}

export function revealTask(id: string, onShowPlan: () => void): void {
  const tasks = new Map(projectStore.getState().project.tasks.map((t) => [t.id, t]))
  const view = useViewState.getState()
  let parent = tasks.get(id)?.parentId ?? null
  for (let guard = 0; parent !== null && guard < 100; guard++) {
    if (view.collapsed.has(parent)) view.toggleCollapsed(parent)
    parent = tasks.get(parent)?.parentId ?? null
  }
  view.select(id)
  onShowPlan()
  // Po vykreslení plánu najet na řádek činnosti a v grafu na její úsečku.
  requestAnimationFrame(() =>
    afterTaskShown(id, () => {
      const selector = `[data-task-id="${CSS.escape(id)}"]`
      document.querySelector(`tr${selector}`)?.scrollIntoView({ block: 'center' })
      document.querySelector(`g${selector}`)?.scrollIntoView({ block: 'nearest', inline: 'center' })
    }),
  )
}
