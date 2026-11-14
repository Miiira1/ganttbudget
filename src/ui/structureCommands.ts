/**
 * Příkazy pro strukturu plánu (F-05): Odsadit, Předsadit, Nahoru, Dolů – na vybraném řádku.
 * Používají je tlačítka v liště (StructureToolbar.tsx) i klávesové zkratky Alt+Shift+šipky (App.tsx).
 *
 * Postará se o potvrzení (odsazení pod činnost s vazbami) a o srozumitelnou hlášku,
 * když příkaz nejde provést. Samotnou změnu dělá úložiště (každá = jeden krok Zpět).
 */
import type { TFunction } from 'i18next'
import { dependenciesRemovedByIndent, MAX_DEPTH } from '../model/hierarchy'
import { projectStore } from '../store/useProject'
import { showNotice } from './notice'
import { useViewState } from './viewState'

export type StructureCommand = 'indent' | 'outdent' | 'moveUp' | 'moveDown'
export const STRUCTURE_COMMANDS: StructureCommand[] = ['outdent', 'indent', 'moveUp', 'moveDown']

/** Klávesová zkratka každého příkazu (jako v MS Projectu). */
export const STRUCTURE_SHORTCUTS: Record<StructureCommand, string> = {
  indent: 'ArrowRight',
  outdent: 'ArrowLeft',
  moveUp: 'ArrowUp',
  moveDown: 'ArrowDown',
}

export function runStructureCommand(command: StructureCommand, t: TFunction): void {
  const store = projectStore.getState()
  const { project } = store
  const id = useViewState.getState().selectedId
  const task = project.tasks.find((x) => x.id === id)
  if (!id || !task) {
    showNotice(t('structure.noSelection'))
    return
  }

  if (command === 'indent') {
    // Odsazení pod činnost ji změní na fázi; má-li vazby, nejdřív se zeptáme (N-08).
    const removed = dependenciesRemovedByIndent(project, id)
    if (removed > 0) {
      const siblings = project.tasks.filter((x) => x.parentId === task.parentId).sort((a, b) => a.order - b.order)
      const previous = siblings[siblings.findIndex((x) => x.id === id) - 1]
      if (!window.confirm(t('structure.confirmConvert', { name: previous?.name ?? '', count: removed }))) return
    }
  }

  const actions = {
    indent: store.indentTask,
    outdent: store.outdentTask,
    moveUp: store.moveTaskUp,
    moveDown: store.moveTaskDown,
  }
  const error = actions[command](id)
  if (error) showNotice(t(`structure.error.${error}`, { max: MAX_DEPTH }))
}
