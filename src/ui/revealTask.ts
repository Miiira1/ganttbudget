/**
 * Ukázat položku v plánu: rozbalí sbalené nadřazené fáze, vybere řádek a po vykreslení na něj najede
 * (v tabulce i v grafu). Přepnutí na pohled Plán dělá volající (onShowPlan) – stav pohledu drží App.
 * Používá pohled Vytížení (fáze 6c) a Kontrola plánu (fáze 10).
 */
import { projectStore } from '../store/useProject'
import { useViewState } from './viewState'

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
    requestAnimationFrame(() => {
      const selector = `[data-task-id="${CSS.escape(id)}"]`
      document.querySelector(`tr${selector}`)?.scrollIntoView({ block: 'center' })
      document.querySelector(`g${selector}`)?.scrollIntoView({ block: 'nearest', inline: 'center' })
    }),
  )
}
