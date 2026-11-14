/**
 * Strom činností (F-03 až F-06): fáze a jejich podřízené položky, WBS čísla,
 * odsazení, předsazení a přesuny.
 *
 * Projekt ukládá činnosti jako plochý seznam: každá má `parentId` (nadřazená fáze, nebo null)
 * a `order` (pořadí mezi sourozenci 0, 1, 2…). Tento soubor z toho skládá strom.
 *
 * Všechno jsou ČISTÉ FUNKCE: projekt dovnitř, nový projekt ven, vstup se nemění.
 * Operace vrací buď { ok: true, project }, nebo { ok: false, reason } – důvod pak UI
 * převede na srozumitelnou hlášku. Testy: hierarchy.test.ts.
 *
 * Pravidla: podřízené položky má jen fáze; nejvýš MAX_DEPTH úrovní.
 */
import type { Project, Task } from './schema'

/** Nejvíc úrovní stromu (F-03). */
export const MAX_DEPTH = 6

export type HierarchyError =
  | 'notFound'
  | 'noPreviousSibling'
  | 'noNextSibling'
  | 'topLevel'
  | 'maxDepth'
  | 'targetNotPhase'
  | 'intoOwnSubtree'

export type HierarchyResult = { ok: true; project: Project } | { ok: false; reason: HierarchyError }

type ParentKey = string | null

/**
 * Seznamy podřízených pro každého rodiče (null = nejvyšší úroveň), seřazené podle `order`.
 * Položky, ke kterým se ze stromu nedá dojít (poškozená data, např. kruh v rodičích),
 * se připojí na nejvyšší úroveň – žádný řádek se tak neztratí.
 */
function buildLists(project: Project): Map<ParentKey, string[]> {
  const byParent = new Map<ParentKey, Task[]>()
  const ids = new Set(project.tasks.map((t) => t.id))
  for (const task of project.tasks) {
    const key = task.parentId !== null && ids.has(task.parentId) ? task.parentId : null
    byParent.set(key, [...(byParent.get(key) ?? []), task])
  }
  for (const list of byParent.values()) list.sort((a, b) => a.order - b.order)

  const lists = new Map<ParentKey, string[]>()
  const reached = new Set<string>()
  const visit = (key: ParentKey) => {
    for (const task of byParent.get(key) ?? []) {
      if (reached.has(task.id)) continue
      reached.add(task.id)
      lists.set(key, [...(lists.get(key) ?? []), task.id])
      visit(task.id)
    }
  }
  visit(null)
  for (const task of project.tasks) {
    if (reached.has(task.id)) continue
    reached.add(task.id)
    lists.set(null, [...(lists.get(null) ?? []), task.id])
    visit(task.id)
  }
  return lists
}

/** Projde strom do hloubky: zavolá fn(id, hloubka, rodič) v pořadí řádků. */
function walk(lists: Map<ParentKey, string[]>, fn: (id: string, depth: number, parent: ParentKey) => void): void {
  const visit = (key: ParentKey, depth: number) => {
    for (const id of lists.get(key) ?? []) {
      fn(id, depth, key)
      visit(id, depth + 1)
    }
  }
  visit(null, 0)
}

/** Řádky v pořadí, jak je vidí uživatel: fáze, pod ní její položky (do hloubky), pak další. */
export function treeOrder(project: Project): Task[] {
  const byId = new Map(project.tasks.map((t) => [t.id, t]))
  const rows: Task[] = []
  walk(buildLists(project), (id) => rows.push(byId.get(id) as Task))
  return rows
}

/** Úroveň každé položky: 0 = nejvyšší. */
export function depthMap(project: Project): Map<string, number> {
  const depths = new Map<string, number>()
  walk(buildLists(project), (id, depth) => depths.set(id, depth))
  return depths
}

/** WBS čísla: 1, 1.1, 1.2.1 … */
export function wbsNumbers(project: Project): Map<string, string> {
  const lists = buildLists(project)
  const wbs = new Map<string, string>()
  const visit = (key: ParentKey, prefix: string) => {
    ;(lists.get(key) ?? []).forEach((id, index) => {
      const number = prefix === '' ? `${index + 1}` : `${prefix}.${index + 1}`
      wbs.set(id, number)
      visit(id, number)
    })
  }
  visit(null, '')
  return wbs
}

function descendantsIn(lists: Map<ParentKey, string[]>, id: string): Set<string> {
  const result = new Set<string>()
  const visit = (key: string) => {
    for (const child of lists.get(key) ?? []) {
      result.add(child)
      visit(child)
    }
  }
  visit(id)
  return result
}

/** Všechny podřízené položky (do libovolné hloubky), bez položky samotné. */
export function descendantIds(project: Project, id: string): Set<string> {
  return descendantsIn(buildLists(project), id)
}

/** Řádky, které jsou vidět, když jsou některé fáze sbalené. */
export function visibleRows(project: Project, collapsed: ReadonlySet<string>): Task[] {
  const depths = depthMap(project)
  const rows: Task[] = []
  let hideBelow: number | null = null // úroveň sbalené fáze, jejíž podřízené právě přeskakujeme
  for (const task of treeOrder(project)) {
    const depth = depths.get(task.id) ?? 0
    if (hideBelow !== null && depth > hideBelow) continue
    hideBelow = null
    rows.push(task)
    if (collapsed.has(task.id)) hideBelow = depth
  }
  return rows
}

// ---------------------------------------------------------------------------
// Operace se stromem
// ---------------------------------------------------------------------------

/** Pracovní kopie stromu pro jednu operaci. */
class Tree {
  readonly lists: Map<ParentKey, string[]>
  readonly parent = new Map<string, ParentKey>()
  readonly depth = new Map<string, number>()

  constructor(readonly project: Project) {
    this.lists = buildLists(project)
    walk(this.lists, (id, depth, parent) => {
      this.parent.set(id, parent)
      this.depth.set(id, depth)
    })
  }

  has(id: string): boolean {
    return this.parent.has(id)
  }

  siblings(id: string): string[] {
    return this.lists.get(this.parent.get(id) ?? null) ?? []
  }

  /** Kolik úrovní má položka pod sebou (0 = nemá podřízené). */
  height(id: string): number {
    const children = this.lists.get(id) ?? []
    return children.length === 0 ? 0 : 1 + Math.max(...children.map((c) => this.height(c)))
  }

  /** Vejde se položka i se svými podřízenými na úroveň `depth`? */
  fitsAt(id: string, depth: number): boolean {
    return depth + this.height(id) <= MAX_DEPTH - 1
  }

  remove(id: string): void {
    const key = this.parent.get(id) ?? null
    this.lists.set(
      key,
      (this.lists.get(key) ?? []).filter((x) => x !== id),
    )
  }

  insert(id: string, parent: ParentKey, index: number): void {
    const list = [...(this.lists.get(parent) ?? [])]
    list.splice(index, 0, id)
    this.lists.set(parent, list)
  }

  /** Nový projekt podle upravených seznamů (parentId a order); nezměněné činnosti zůstanou stejné objekty. */
  result(transform: (task: Task) => Task = (t) => t): HierarchyResult {
    const placement = new Map<string, { parentId: ParentKey; order: number }>()
    for (const [parentId, ids] of this.lists) ids.forEach((id, order) => placement.set(id, { parentId, order }))
    const tasks = this.project.tasks.map((task) => {
      const place = placement.get(task.id) ?? { parentId: task.parentId, order: task.order }
      const placed = place.parentId === task.parentId && place.order === task.order ? task : { ...task, ...place }
      return transform(placed)
    })
    return { ok: true, project: { ...this.project, tasks } }
  }
}

const fail = (reason: HierarchyError): HierarchyResult => ({ ok: false, reason })

/** Převod činnosti na fázi: fáze zatím nesmí mít vazby ani být předchůdcem (fáze 2–4b). */
function convertToPhase(phaseId: string) {
  return (task: Task): Task => {
    if (task.id === phaseId) return { ...task, kind: 'phase', dependencies: [] }
    return task.dependencies.some((d) => d.predecessorId === phaseId)
      ? { ...task, dependencies: task.dependencies.filter((d) => d.predecessorId !== phaseId) }
      : task
  }
}

/** Odsadit: položka se stane poslední podřízenou předchozího sourozence (ten se případně změní na fázi). */
export function indent(project: Project, id: string): HierarchyResult {
  const tree = new Tree(project)
  if (!tree.has(id)) return fail('notFound')
  const siblings = tree.siblings(id)
  const previous = siblings[siblings.indexOf(id) - 1]
  if (previous === undefined) return fail('noPreviousSibling')
  if (!tree.fitsAt(id, (tree.depth.get(previous) ?? 0) + 1)) return fail('maxDepth')

  tree.remove(id)
  tree.insert(id, previous, (tree.lists.get(previous) ?? []).length)
  const previousTask = project.tasks.find((t) => t.id === previous)
  return tree.result(previousTask?.kind === 'phase' ? undefined : convertToPhase(previous))
}

/**
 * Kolik vazeb by odsazení odebralo (když se řádek nad změní z činnosti na fázi).
 * UI se podle toho rozhodne, jestli se má uživatele nejdřív zeptat.
 */
export function dependenciesRemovedByIndent(project: Project, id: string): number {
  const tree = new Tree(project)
  if (!tree.has(id)) return 0
  const siblings = tree.siblings(id)
  const previous = project.tasks.find((t) => t.id === siblings[siblings.indexOf(id) - 1])
  if (!previous || previous.kind === 'phase') return 0
  const incoming = project.tasks.reduce(
    (sum, t) => sum + t.dependencies.filter((d) => d.predecessorId === previous.id).length,
    0,
  )
  return previous.dependencies.length + incoming
}

/** Předsadit: položka se přesune hned za svou dosavadní fázi, o úroveň výš. */
export function outdent(project: Project, id: string): HierarchyResult {
  const tree = new Tree(project)
  if (!tree.has(id)) return fail('notFound')
  const parent = tree.parent.get(id) ?? null
  if (parent === null) return fail('topLevel')
  const grandparent = tree.parent.get(parent) ?? null
  tree.remove(id)
  tree.insert(id, grandparent, (tree.lists.get(grandparent) ?? []).indexOf(parent) + 1)
  return tree.result()
}

function swapWithSibling(project: Project, id: string, offset: -1 | 1): HierarchyResult {
  const tree = new Tree(project)
  if (!tree.has(id)) return fail('notFound')
  const parent = tree.parent.get(id) ?? null
  const list = [...tree.siblings(id)]
  const index = list.indexOf(id)
  const other = index + offset
  if (other < 0) return fail('noPreviousSibling')
  if (other >= list.length) return fail('noNextSibling')
  ;[list[index], list[other]] = [list[other] as string, id]
  tree.lists.set(parent, list)
  return tree.result()
}

/** Prohodí položku s předchozím sourozencem (i s podřízenými). */
export const moveUp = (project: Project, id: string) => swapWithSibling(project, id, -1)
/** Prohodí položku s dalším sourozencem (i s podřízenými). */
export const moveDown = (project: Project, id: string) => swapWithSibling(project, id, 1)

export type DropPosition = 'before' | 'after' | 'inside'

/**
 * Kam se řádek vloží podle toho, kde nad cílovým řádkem je myš (`offsetY` od horního okraje).
 * Nad činností: horní polovina = před, spodní = za. Nad fází: horní třetina = před,
 * prostřední = dovnitř (jako poslední), spodní třetina = za.
 */
export function dropPositionAt(offsetY: number, rowHeight: number, targetIsPhase: boolean): DropPosition {
  if (!targetIsPhase) return offsetY < rowHeight / 2 ? 'before' : 'after'
  if (offsetY < rowHeight / 3) return 'before'
  return offsetY < (rowHeight * 2) / 3 ? 'inside' : 'after'
}

/** Přesun tažením: před / za cílový řádek (na jeho úroveň), nebo dovnitř cílové fáze jako poslední. */
export function moveTo(project: Project, id: string, targetId: string, position: DropPosition): HierarchyResult {
  const tree = new Tree(project)
  if (!tree.has(id) || !tree.has(targetId)) return fail('notFound')
  if (id === targetId || descendantsIn(tree.lists, id).has(targetId)) return fail('intoOwnSubtree')
  const target = project.tasks.find((t) => t.id === targetId) as Task
  if (position === 'inside' && target.kind !== 'phase') return fail('targetNotPhase')

  const newParent = position === 'inside' ? targetId : (tree.parent.get(targetId) ?? null)
  const newDepth = newParent === null ? 0 : (tree.depth.get(newParent) ?? 0) + 1
  if (!tree.fitsAt(id, newDepth)) return fail('maxDepth')

  tree.remove(id)
  const list = tree.lists.get(newParent) ?? []
  const index = position === 'inside' ? list.length : list.indexOf(targetId) + (position === 'after' ? 1 : 0)
  tree.insert(id, newParent, index)
  return tree.result()
}
