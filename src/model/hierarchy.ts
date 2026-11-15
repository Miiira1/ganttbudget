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
import { MAX_TREE_DEPTH, type Project, type Task } from './schema'

/** Nejvíc úrovní stromu (F-03) – hlídá ho i schéma při načtení souboru. */
export const MAX_DEPTH = MAX_TREE_DEPTH

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
    const list = byParent.get(key)
    if (list) list.push(task)
    else byParent.set(key, [task])
  }
  for (const list of byParent.values()) list.sort((a, b) => a.order - b.order)

  const lists = new Map<ParentKey, string[]>()
  const reached = new Set<string>()
  const append = (key: ParentKey, id: string) => {
    const list = lists.get(key)
    if (list) list.push(id)
    else lists.set(key, [id])
  }
  const visit = (key: ParentKey) => {
    for (const task of byParent.get(key) ?? []) {
      if (reached.has(task.id)) continue
      reached.add(task.id)
      append(key, task.id)
      visit(task.id)
    }
  }
  visit(null)
  for (const task of project.tasks) {
    if (reached.has(task.id)) continue
    reached.add(task.id)
    append(null, task.id)
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
    this.parent.set(id, parent)
  }

  /** Aktuální úroveň položky i po přesunech v této operaci (`depth` platí jen pro výchozí stav). */
  depthOf(id: string): number {
    let depth = 0
    for (let p = this.parent.get(id) ?? null; p !== null; p = this.parent.get(p) ?? null) depth++
    return depth
  }

  /** Leží `id` v podstromu položky `root` (nebo je to ona)? */
  isWithin(id: string, root: string): boolean {
    for (let p: ParentKey = id; p !== null; p = this.parent.get(p) ?? null) if (p === root) return true
    return false
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

/** Nejdelší povolený název (stejně jako ve schématu). */
const MAX_NAME_LENGTH = 200

/**
 * Duplikovat řádek (G-06, Ctrl+D): kopie hned pod originál, fáze i se všemi svými položkami.
 * Kopie dostanou nová ID (`makeId`), název kopírovaného řádku příponu (`nameSuffix`, např. " (kopie)").
 * Vazby uvnitř kopírované skupiny vedou na kopie, vazby ven zůstanou na původní činnosti.
 */
export function duplicate(
  project: Project,
  id: string,
  makeId: () => string,
  nameSuffix: string,
): { ok: true; project: Project; newId: string } | { ok: false; reason: HierarchyError } {
  const result = duplicateMany(project, [id], makeId, nameSuffix)
  return result.ok ? { ok: true, project: result.project, newId: result.newIds[0] as string } : result
}

/**
 * Duplikovat více řádků najednou (jeden krok Zpět). Souvislý blok sourozenců se zkopíruje
 * za svůj konec ve stejném pořadí (A, B → A, B, A′, B′); osamocený řádek dostane kopii hned pod sebe.
 * Vazby mezi kopírovanými položkami vedou na kopie, vazby ven zůstanou. Vrací ID kopií vybraných řádků.
 */
export function duplicateMany(
  project: Project,
  ids: Iterable<string>,
  makeId: () => string,
  nameSuffix: string,
): { ok: true; project: Project; newIds: string[] } | { ok: false; reason: HierarchyError } {
  const roots = selectionRoots(project, ids)
  if (roots.length === 0) return { ok: false, reason: 'notFound' }
  const original = new Tree(project)
  const rootSet = new Set(roots)

  // Kopírované položky v pořadí řádků (kořeny i jejich podřízené) → nová ID.
  const copied = new Set(roots)
  for (const root of roots) for (const d of descendantsIn(original.lists, root)) copied.add(d)
  const order = treeOrder(project).filter((t) => copied.has(t.id))
  const newIds = new Map(order.map((t) => [t.id, makeId()]))

  const copies: Task[] = order.map((task) => {
    const isRoot = rootSet.has(task.id)
    const name = isRoot ? `${task.name}${nameSuffix}`.slice(0, MAX_NAME_LENGTH).trimEnd() || task.name : task.name
    return {
      ...task,
      id: newIds.get(task.id) as string,
      name,
      parentId: isRoot ? task.parentId : (newIds.get(task.parentId as string) ?? task.parentId),
      dependencies: task.dependencies.map((d) => ({ ...d, predecessorId: newIds.get(d.predecessorId) ?? d.predecessorId })),
      lines: task.lines.map((line) => ({ ...line, id: makeId() })), // řádky dostanou nová ID (musí být v projektu jedinečná)
    }
  })

  // Podřízené kopií jsou díky parentId a order rovnou správně; kopie vybraných řádků se umístí.
  const tree = new Tree({ ...project, tasks: [...project.tasks, ...copies] })
  for (const run of siblingRuns(original, roots)) {
    let anchor = run[run.length - 1] as string
    for (const root of run) {
      const copy = newIds.get(root) as string
      const parent = original.parent.get(root) ?? null
      tree.remove(copy)
      tree.insert(copy, parent, (tree.lists.get(parent) ?? []).indexOf(anchor) + 1)
      anchor = copy
    }
  }
  const result = tree.result()
  if (!result.ok) return result
  return { ok: true, project: result.project, newIds: roots.map((r) => newIds.get(r) as string) }
}

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

// ---------------------------------------------------------------------------
// Hromadné operace (výběr více řádků Ctrl / Shift)
//
// Pravidla: s vybranou fází jdou i její položky (vybrané podřízené se nepočítají zvlášť).
// Každá operace platí pro všechny vybrané řádky, nebo pro žádný: když nejde u jednoho,
// vrátí důvod a projekt se nezmění.
// ---------------------------------------------------------------------------

/** Vybrané řádky, se kterými se opravdu pracuje: existující, bez podřízených vybrané fáze, v pořadí řádků. */
export function selectionRoots(project: Project, ids: Iterable<string>): string[] {
  const selected = new Set(ids)
  if (selected.size === 0) return []
  const tree = new Tree(project)
  return treeOrder(project)
    .map((t) => t.id)
    .filter((id) => {
      if (!selected.has(id)) return false
      for (let p = tree.parent.get(id) ?? null; p !== null; p = tree.parent.get(p) ?? null) if (selected.has(p)) return false
      return true
    })
}

/** Rozdělí vybrané řádky na souvislé bloky sourozenců (v pořadí řádků). */
function siblingRuns(tree: Tree, roots: string[]): string[][] {
  const runs: string[][] = []
  let previous: string | null = null
  for (const id of roots) {
    const siblings = tree.siblings(id)
    const last = runs[runs.length - 1]
    if (last && previous !== null && siblings[siblings.indexOf(id) - 1] === previous) last.push(id)
    else runs.push([id])
    previous = id
  }
  return runs
}

/** Odsadit vybrané: každý pod řádek nad sebou (souvislý blok tak skončí pod řádkem nad prvním). */
export function indentMany(project: Project, ids: Iterable<string>): HierarchyResult {
  const roots = selectionRoots(project, ids)
  if (roots.length === 0) return fail('notFound')
  const tree = new Tree(project)
  const converted = new Set<string>()
  const kinds = new Map(project.tasks.map((t) => [t.id, t.kind]))
  for (const id of roots) {
    const siblings = tree.siblings(id)
    const previous = siblings[siblings.indexOf(id) - 1]
    if (previous === undefined) return fail('noPreviousSibling')
    if (!tree.fitsAt(id, tree.depthOf(previous) + 1)) return fail('maxDepth')
    tree.remove(id)
    tree.insert(id, previous, (tree.lists.get(previous) ?? []).length)
    if (kinds.get(previous) !== 'phase') converted.add(previous)
  }
  return tree.result((task) => [...converted].reduce((t, phaseId) => convertToPhase(phaseId)(t), task))
}

const dependencyCount = (project: Project) => project.tasks.reduce((sum, t) => sum + t.dependencies.length, 0)

/** Kolik vazeb by hromadné odsazení odebralo (řádky nad se změní na fáze). 0, když odsazení nejde. */
export function dependenciesRemovedByIndentMany(project: Project, ids: Iterable<string>): number {
  const result = indentMany(project, ids)
  return result.ok ? dependencyCount(project) - dependencyCount(result.project) : 0
}

/** Předsadit vybrané: každý za konec své fáze; pořadí vybraných zůstane. */
export function outdentMany(project: Project, ids: Iterable<string>): HierarchyResult {
  const roots = selectionRoots(project, ids)
  if (roots.length === 0) return fail('notFound')
  const tree = new Tree(project)
  // Odzadu: každý další předsazený se vloží PŘED ty, které už za fází jsou.
  for (const id of [...roots].reverse()) {
    const parent = tree.parent.get(id) ?? null
    if (parent === null) return fail('topLevel')
    const grandparent = tree.parent.get(parent) ?? null
    tree.remove(id)
    tree.insert(id, grandparent, (tree.lists.get(grandparent) ?? []).indexOf(parent) + 1)
  }
  return tree.result()
}

function shiftMany(project: Project, ids: Iterable<string>, offset: -1 | 1): HierarchyResult {
  const roots = selectionRoots(project, ids)
  if (roots.length === 0) return fail('notFound')
  const tree = new Tree(project)
  // Nahoru zepředu, dolů odzadu – blok se tak posune celý o jedno místo.
  for (const id of offset < 0 ? roots : [...roots].reverse()) {
    const parent = tree.parent.get(id) ?? null
    const list = [...tree.siblings(id)]
    const index = list.indexOf(id)
    const other = index + offset
    if (other < 0) return fail('noPreviousSibling')
    if (other >= list.length) return fail('noNextSibling')
    ;[list[index], list[other]] = [list[other] as string, id]
    tree.lists.set(parent, list)
  }
  return tree.result()
}

/** Posunout vybrané o jedno místo nahoru mezi sourozenci. */
export const moveUpMany = (project: Project, ids: Iterable<string>) => shiftMany(project, ids, -1)
/** Posunout vybrané o jedno místo dolů mezi sourozenci. */
export const moveDownMany = (project: Project, ids: Iterable<string>) => shiftMany(project, ids, 1)

/** Přesun tažením více řádků: všechny před / za cílový řádek nebo dovnitř cílové fáze, ve stejném pořadí. */
export function moveManyTo(project: Project, ids: Iterable<string>, targetId: string, position: DropPosition): HierarchyResult {
  const roots = selectionRoots(project, ids)
  const tree = new Tree(project)
  if (roots.length === 0 || !tree.has(targetId)) return fail('notFound')
  if (roots.some((root) => tree.isWithin(targetId, root))) return fail('intoOwnSubtree')
  const target = project.tasks.find((t) => t.id === targetId) as Task
  if (position === 'inside' && target.kind !== 'phase') return fail('targetNotPhase')

  const newParent = position === 'inside' ? targetId : (tree.parent.get(targetId) ?? null)
  const newDepth = newParent === null ? 0 : tree.depthOf(newParent) + 1
  if (roots.some((id) => !tree.fitsAt(id, newDepth))) return fail('maxDepth')

  for (const id of roots) tree.remove(id)
  const list = tree.lists.get(newParent) ?? []
  const index = position === 'inside' ? list.length : list.indexOf(targetId) + (position === 'after' ? 1 : 0)
  roots.forEach((id, i) => tree.insert(id, newParent, index + i))
  return tree.result()
}

/** Kolik řádků by hromadné smazání odstranilo: vybrané + jejich podřízené (pro potvrzení). */
export function removalCount(project: Project, ids: Iterable<string>): { selected: number; descendants: number } {
  const roots = selectionRoots(project, ids)
  const lists = buildLists(project)
  const descendants = roots.reduce((sum, id) => sum + descendantsIn(lists, id).size, 0)
  return { selected: roots.length, descendants }
}

/** Smazat vybrané i s podřízenými; vazby na smazané se odeberou. */
export function deleteMany(project: Project, ids: Iterable<string>): HierarchyResult {
  const roots = selectionRoots(project, ids)
  if (roots.length === 0) return fail('notFound')
  const tree = new Tree(project)
  const removed = new Set(roots)
  for (const id of roots) {
    for (const d of descendantsIn(tree.lists, id)) removed.add(d)
    tree.remove(id)
  }
  const result = tree.result((task) =>
    task.dependencies.some((d) => removed.has(d.predecessorId))
      ? { ...task, dependencies: task.dependencies.filter((d) => !removed.has(d.predecessorId)) }
      : task,
  )
  if (!result.ok) return result
  return { ok: true, project: { ...result.project, tasks: result.project.tasks.filter((t) => !removed.has(t.id)) } }
}
