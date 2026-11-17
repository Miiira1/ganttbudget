/**
 * Myšlenková mapa (fáze 12, MM-01): úpravy stromu uzlů – ČISTÉ FUNKCE s testy (mindMap.test.ts).
 * Každá úprava vrací novou mapu (původní se nemění), nebo důvod, proč nejde provést.
 * Pořadí sourozenců se po každé úpravě přečísluje na 0, 1, 2…
 * Limity: MAX_MIND_MAP_NODES uzlů, MAX_MIND_MAP_DEPTH úrovní pod středním tématem (schema.ts).
 */
import { MAX_MIND_MAP_DEPTH, MAX_MIND_MAP_NODES, MAX_MIND_MAP_TEXT, type MindMap, type MindMapNode } from './schema'

export type MindMapError = 'root' | 'tooDeep' | 'tooMany' | 'cycle' | 'emptyText' | 'tooLong' | 'notFound'
export type MapResult = { ok: true; map: MindMap; id?: string } | { ok: false; reason: MindMapError }

const fail = (reason: MindMapError): MapResult => ({ ok: false, reason })

/** Nová mapa jen se středním tématem. */
export function createMindMap(rootText: string, newId: () => string): MindMap {
  return { nodes: [{ id: newId(), parentId: null, order: 0, text: rootText.trim().slice(0, MAX_MIND_MAP_TEXT) || '…' }] }
}

export function rootOf(map: MindMap): MindMapNode {
  return map.nodes.find((n) => n.parentId === null)!
}

export function nodeOf(map: MindMap, id: string): MindMapNode | undefined {
  return map.nodes.find((n) => n.id === id)
}

/** Podřízené uzly v pořadí. */
export function childrenOf(map: MindMap, id: string): MindMapNode[] {
  return map.nodes.filter((n) => n.parentId === id).sort((a, b) => a.order - b.order)
}

/** Hloubka uzlu: střední téma 0, hlavní větve 1… */
export function depthOf(map: MindMap, id: string): number {
  let depth = 0
  for (let n = nodeOf(map, id); n && n.parentId !== null && depth <= MAX_MIND_MAP_NODES; n = nodeOf(map, n.parentId)) depth++
  return depth
}

/** ID uzlu a všech jeho podřízených (do hloubky). */
export function subtreeIds(map: MindMap, id: string): Set<string> {
  const ids = new Set([id])
  const stack = [id]
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const child of map.nodes) {
      if (child.parentId === current && !ids.has(child.id)) {
        ids.add(child.id)
        stack.push(child.id)
      }
    }
  }
  return ids
}

/** Kolik úrovní má větev pod uzlem (list = 0). */
function heightOf(map: MindMap, id: string): number {
  const children = childrenOf(map, id)
  return children.length === 0 ? 0 : 1 + Math.max(...children.map((c) => heightOf(map, c.id)))
}

/** Přečísluje pořadí sourozenců pod daným rodičem podle zadaného seznamu ID. */
function withOrder(nodes: MindMapNode[], parentId: string, orderedIds: string[]): MindMapNode[] {
  const position = new Map(orderedIds.map((id, i) => [id, i]))
  return nodes.map((n) => (n.parentId === parentId && position.has(n.id) ? { ...n, order: position.get(n.id)! } : n))
}

/** Vloží nový uzel pod rodiče na dané místo (index v pořadí sourozenců). */
function insert(map: MindMap, parentId: string, index: number, text: string, newId: () => string): MapResult {
  const parent = nodeOf(map, parentId)
  if (!parent) return fail('notFound')
  if (map.nodes.length >= MAX_MIND_MAP_NODES) return fail('tooMany')
  if (depthOf(map, parentId) + 1 > MAX_MIND_MAP_DEPTH) return fail('tooDeep')
  const clean = text.trim()
  if (clean === '') return fail('emptyText')
  const id = newId()
  const siblings = childrenOf(map, parentId).map((n) => n.id)
  siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, id)
  // Přidání do sbalené větve ji rozbalí, ať je nový uzel vidět.
  const nodes = map.nodes.map((n) => (n.id === parentId && n.collapsed ? { ...n, collapsed: false } : n))
  nodes.push({ id, parentId, order: 0, text: clean.slice(0, MAX_MIND_MAP_TEXT) })
  return { ok: true, map: { nodes: withOrder(nodes, parentId, siblings) }, id }
}

/** Nový podřízený uzel na konec větve. */
export function addChild(map: MindMap, parentId: string, text: string, newId: () => string): MapResult {
  return insert(map, parentId, Number.MAX_SAFE_INTEGER, text, newId)
}

/** Nový sourozenec hned za uzel (střední téma sourozence nemá). */
export function addSibling(map: MindMap, id: string, text: string, newId: () => string): MapResult {
  const node = nodeOf(map, id)
  if (!node) return fail('notFound')
  if (node.parentId === null) return fail('root')
  const index = childrenOf(map, node.parentId).findIndex((n) => n.id === id)
  return insert(map, node.parentId, index + 1, text, newId)
}

/** Smaže uzel i s celou větví (střední téma smazat nejde). */
export function removeNode(map: MindMap, id: string): MapResult {
  const node = nodeOf(map, id)
  if (!node) return fail('notFound')
  if (node.parentId === null) return fail('root')
  const removed = subtreeIds(map, id)
  const nodes = map.nodes.filter((n) => !removed.has(n.id))
  const rest = nodes.filter((n) => n.parentId === node.parentId).sort((a, b) => a.order - b.order)
  return { ok: true, map: { nodes: withOrder(nodes, node.parentId, rest.map((n) => n.id)) } }
}

export function renameNode(map: MindMap, id: string, text: string): MapResult {
  if (!nodeOf(map, id)) return fail('notFound')
  const clean = text.trim()
  if (clean === '') return fail('emptyText')
  if (clean.length > MAX_MIND_MAP_TEXT) return fail('tooLong')
  return { ok: true, map: { nodes: map.nodes.map((n) => (n.id === id ? { ...n, text: clean } : n)) } }
}

/** Sbalí / rozbalí větev (uzel bez podřízených se nemění). */
export function toggleCollapsed(map: MindMap, id: string): MapResult {
  if (!nodeOf(map, id)) return fail('notFound')
  if (childrenOf(map, id).length === 0) return { ok: true, map }
  return { ok: true, map: { nodes: map.nodes.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n)) } }
}

/** Přesune uzel (i s větví) pod nového rodiče na dané místo v pořadí jeho podřízených. */
export function moveNode(map: MindMap, id: string, newParentId: string, index: number): MapResult {
  const node = nodeOf(map, id)
  if (!node || !nodeOf(map, newParentId)) return fail('notFound')
  if (node.parentId === null) return fail('root')
  if (subtreeIds(map, id).has(newParentId)) return fail('cycle')
  if (depthOf(map, newParentId) + 1 + heightOf(map, id) > MAX_MIND_MAP_DEPTH) return fail('tooDeep')
  const oldParentId = node.parentId
  const without = childrenOf(map, newParentId)
    .map((n) => n.id)
    .filter((x) => x !== id)
  without.splice(Math.max(0, Math.min(index, without.length)), 0, id)
  let nodes = map.nodes.map((n) => (n.id === id ? { ...n, parentId: newParentId } : n.id === newParentId && n.collapsed ? { ...n, collapsed: false } : n))
  nodes = withOrder(nodes, newParentId, without)
  if (oldParentId !== newParentId) {
    const old = nodes.filter((n) => n.parentId === oldParentId).sort((a, b) => a.order - b.order)
    nodes = withOrder(nodes, oldParentId, old.map((n) => n.id))
  }
  return { ok: true, map: { nodes }, id }
}
