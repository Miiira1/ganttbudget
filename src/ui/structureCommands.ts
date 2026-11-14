/**
 * Příkazy pro vybrané řádky: Odsadit, Předsadit, Nahoru, Dolů (F-05), Smazat a Duplikovat (G-06).
 * Používají je tlačítka v liště (StructureToolbar.tsx), tabulka i klávesové zkratky (App.tsx).
 * S více vybranými řádky (Ctrl / Shift) pracují hromadně – jeden krok Zpět; když příkaz
 * nejde u některého z nich, nezmění se nic (model/hierarchy.ts).
 *
 * Postará se o potvrzení (odsazení pod činnost s vazbami, mazání) a o srozumitelnou hlášku,
 * když příkaz nejde provést. Samotnou změnu dělá úložiště.
 */
import type { TFunction } from 'i18next'
import { dependenciesRemovedByIndent, dependenciesRemovedByIndentMany, descendantIds, MAX_DEPTH, removalCount } from '../model/hierarchy'
import { projectStore } from '../store/useProject'
import { showNotice } from './notice'
import { currentSelection, useViewState } from './viewState'

export type StructureCommand = 'indent' | 'outdent' | 'moveUp' | 'moveDown'
export const STRUCTURE_COMMANDS: StructureCommand[] = ['outdent', 'indent', 'moveUp', 'moveDown']

/** Klávesová zkratka každého příkazu (jako v MS Projectu). */
export const STRUCTURE_SHORTCUTS: Record<StructureCommand, string> = {
  indent: 'ArrowRight',
  outdent: 'ArrowLeft',
  moveUp: 'ArrowUp',
  moveDown: 'ArrowDown',
}

/** Vybrané řádky; žádný → hláška a prázdný seznam. */
function selectionOrNotice(t: TFunction): string[] {
  const ids = currentSelection(projectStore.getState().project)
  if (ids.length === 0) showNotice(t('structure.noSelection'))
  return ids
}

/**
 * Smazat řádek po potvrzení (N-08). U fáze řekne, kolik podřízených položek zmizí s ní.
 * Používá křížek v tabulce i zkratka Ctrl+Delete.
 */
export function confirmAndDelete(taskId: string, t: TFunction): void {
  const store = projectStore.getState()
  const task = store.project.tasks.find((x) => x.id === taskId)
  if (!task) return
  const children = descendantIds(store.project, taskId).size
  const question =
    children > 0
      ? t('table.confirmDeleteWithChildren', { name: task.name, count: children })
      : t('table.confirmDelete', { name: task.name })
  if (window.confirm(question)) store.deleteTask(taskId)
}

/** Ctrl+Delete: smazat vybrané řádky (jedno potvrzení pro všechny). */
export function deleteSelected(t: TFunction): void {
  const ids = selectionOrNotice(t)
  if (ids.length === 0) return
  if (ids.length === 1) return confirmAndDelete(ids[0] as string, t)
  const store = projectStore.getState()
  const { selected, descendants } = removalCount(store.project, ids)
  if (window.confirm(t('table.confirmDeleteMany', { count: selected + descendants }))) store.deleteTasks(ids)
}

/** Ctrl+D: duplikovat vybrané řádky (fáze i s činnostmi) a vybrat kopie. */
export function duplicateSelected(t: TFunction): void {
  const ids = selectionOrNotice(t)
  if (ids.length === 0) return
  const copies = projectStore.getState().duplicateTasks(ids, t('task.copySuffix'))
  if (copies && copies.length > 0) useViewState.getState().selectMany(copies, copies[copies.length - 1] as string)
}

/** Zeptá se, když odsazení změní řádek nad na fázi a ta přijde o vazby (N-08). */
function confirmIndent(ids: string[], t: TFunction): boolean {
  const { project } = projectStore.getState()
  if (ids.length > 1) {
    const removed = dependenciesRemovedByIndentMany(project, ids)
    return removed === 0 || window.confirm(t('structure.confirmConvertMany', { count: removed }))
  }
  const id = ids[0] as string
  const removed = dependenciesRemovedByIndent(project, id)
  if (removed === 0) return true
  const task = project.tasks.find((x) => x.id === id)
  const siblings = project.tasks.filter((x) => x.parentId === task?.parentId).sort((a, b) => a.order - b.order)
  const previous = siblings[siblings.findIndex((x) => x.id === id) - 1]
  return window.confirm(t('structure.confirmConvert', { name: previous?.name ?? '', count: removed }))
}

export function runStructureCommand(command: StructureCommand, t: TFunction): void {
  const ids = selectionOrNotice(t)
  if (ids.length === 0) return
  if (command === 'indent' && !confirmIndent(ids, t)) return

  const store = projectStore.getState()
  const actions = {
    indent: store.indentTasks,
    outdent: store.outdentTasks,
    moveUp: store.moveTasksUp,
    moveDown: store.moveTasksDown,
  }
  const error = actions[command](ids)
  if (error) showNotice(t(`structure.error.${error}`, { max: MAX_DEPTH }))
}
