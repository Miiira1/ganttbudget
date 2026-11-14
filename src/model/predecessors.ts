/**
 * Zápis předchůdců textem ve sloupci „Předchůdci“ (F-07, základ pro fázi 2).
 *
 * Formát: čísla řádků oddělená středníkem (nebo čárkou), volitelně s prodlevou v pracovních dnech:
 *   "2"        navazuje na řádek 2
 *   "2; 5+3"   navazuje na řádek 2 a na řádek 5 s prodlevou 3 dny
 *   "4-2"      začne 2 dny před koncem řádku 4 (předstih)
 * Zatím jen vazba FS (konec → začátek). Zápis "3SS+2" a další typy přidá fáze 4c.
 */
import { treeOrder } from './hierarchy'
import type { Dependency, Project, Task } from './schema'

export interface PredecessorItem {
  row: number
  lagDays: number
}

export type PredecessorError =
  | { code: 'syntax'; token: string }
  | { code: 'unsupportedType'; token: string }
  | { code: 'duplicate'; row: number }
  | { code: 'unknownRow'; row: number }
  | { code: 'self' }
  | { code: 'phase'; row: number }
  | { code: 'phaseSuccessor' }
  | { code: 'cycle'; rows: number[] }

const TOKEN = /^(\d+)\s*(fs)?\s*(?:([+-])\s*(\d+))?$/i
const OTHER_TYPE = /^\d+\s*(ss|ff|sf)/i

/** Rozebere text na seznam [řádek, prodleva]. Nekontroluje, zda řádky existují. */
export function parsePredecessors(
  text: string,
): { ok: true; items: PredecessorItem[] } | { ok: false; error: PredecessorError } {
  const tokens = text
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter((t) => t !== '')
  const items: PredecessorItem[] = []
  for (const token of tokens) {
    if (OTHER_TYPE.test(token)) return { ok: false, error: { code: 'unsupportedType', token } }
    const match = TOKEN.exec(token)
    const row = match ? Number(match[1]) : 0
    if (!match || row < 1 || row > 100000) return { ok: false, error: { code: 'syntax', token } }
    const lag = match[4] === undefined ? 0 : Number(match[4]) * (match[3] === '-' ? -1 : 1)
    if (Math.abs(lag) > 1000) return { ok: false, error: { code: 'syntax', token } }
    if (items.some((i) => i.row === row)) return { ok: false, error: { code: 'duplicate', row } }
    items.push({ row, lagDays: lag })
  }
  return { ok: true, items }
}

/**
 * Pořadí řádků tak, jak je vidí uživatel v tabulce (číslo řádku = pozice + 1).
 * Je to průchod stromem fází (model/hierarchy.ts); počítají se i řádky ve sbalených fázích,
 * takže se čísla řádků sbalením nemění.
 */
export function rowOrder(project: Project): Task[] {
  return treeOrder(project)
}

/** ID činnosti → číslo řádku. */
export function rowNumbers(project: Project): Map<string, number> {
  return new Map(rowOrder(project).map((t, index) => [t.id, index + 1]))
}

/**
 * Hledá kruh: kdyby činnost `taskId` čekala na `predecessorIds`, vznikl by kruh?
 * Vrátí cestu ID [taskId, …, předchůdce, taskId], nebo null.
 */
export function findCycle(project: Project, taskId: string, predecessorIds: string[]): string[] | null {
  // successors: kdo čeká na koho (předchůdce → následníci)
  const successors = new Map<string, string[]>()
  for (const t of project.tasks) {
    if (t.id === taskId) continue // vlastní vazby činnosti se právě nahrazují
    for (const d of t.dependencies) {
      const list = successors.get(d.predecessorId) ?? []
      list.push(t.id)
      successors.set(d.predecessorId, list)
    }
  }
  const targets = new Set(predecessorIds)
  // Hledání do šířky od taskId po následnících – najde nejkratší kruh.
  const cameFrom = new Map<string, string | null>([[taskId, null]])
  const queue = [taskId]
  while (queue.length > 0) {
    const current = queue.shift() as string
    if (current !== taskId && targets.has(current)) {
      const path: string[] = []
      for (let node: string | null = current; node !== null; node = cameFrom.get(node) ?? null) path.unshift(node)
      return [...path, taskId]
    }
    for (const next of successors.get(current) ?? []) {
      if (!cameFrom.has(next)) {
        cameFrom.set(next, current)
        queue.push(next)
      }
    }
  }
  return null
}

/** Převede čísla řádků na vazby a zkontroluje je (existence, fáze, kruh). */
export function resolvePredecessors(
  project: Project,
  taskId: string,
  items: PredecessorItem[],
): { ok: true; dependencies: Dependency[] } | { ok: false; error: PredecessorError } {
  const rows = rowOrder(project)
  const task = project.tasks.find((t) => t.id === taskId)
  if (task?.kind === 'phase' && items.length > 0) return { ok: false, error: { code: 'phaseSuccessor' } }

  const dependencies: Dependency[] = []
  for (const item of items) {
    const pred = rows[item.row - 1]
    if (!pred) return { ok: false, error: { code: 'unknownRow', row: item.row } }
    if (pred.id === taskId) return { ok: false, error: { code: 'self' } }
    if (pred.kind === 'phase') return { ok: false, error: { code: 'phase', row: item.row } }
    dependencies.push({ predecessorId: pred.id, type: 'FS', lagDays: item.lagDays })
  }

  const cycle = findCycle(project, taskId, dependencies.map((d) => d.predecessorId))
  if (cycle) {
    const numbers = rowNumbers(project)
    return { ok: false, error: { code: 'cycle', rows: cycle.map((id) => numbers.get(id) ?? 0) } }
  }
  return { ok: true, dependencies }
}

/** Vazby činnosti → text pro tabulku, např. "1; 2+3". */
export function formatPredecessors(project: Project, task: Task): string {
  const numbers = rowNumbers(project)
  return task.dependencies
    .map((d) => {
      const row = numbers.get(d.predecessorId)
      if (row === undefined) return null
      const lag = d.lagDays === 0 ? '' : d.lagDays > 0 ? `+${d.lagDays}` : `${d.lagDays}`
      return `${row}${lag}`
    })
    .filter((s) => s !== null)
    .join('; ')
}
