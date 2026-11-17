/**
 * Rozložení myšlenkové mapy do dvou stran (fáze 12, MM-01) – ČISTÁ FUNKCE s testy (mindMapLayout.test.ts).
 *
 * Střední téma leží uprostřed (střed v bodě 0, 0). Hlavní větve se postupně přidělují té straně,
 * která je zatím nižší (při shodě vpravo) – mapa tak zůstane vyvážená a pořadí větví na každé straně
 * shora dolů odpovídá pořadí v mapě. Podřízené uzly pokračují směrem ven.
 * Každá větev dostane svislý pás výšky svého podstromu, takže se uzly nikdy nepřekrývají;
 * rodič je svisle uprostřed svých podřízených. Sbalené větve se nekreslí.
 *
 * Šířka textu se odhaduje počtem znaků (bez měření v prohlížeči) – text se zalamuje po slovech.
 * Souřadnice jsou v obrazových bodech SVG; výška řádku a písmo odpovídají kreslení v MindMapView.
 */
import { childrenOf, rootOf, subtreeIds } from './mindMap'
import type { MindMap } from './schema'

/** Rozměry kreslení (sdílí je i SVG v MindMapView, aby text seděl do rámečku). */
export const MIND_MAP_METRICS = {
  /** Odhad šířky znaku pro písmo 14 px (střední téma 16 px). */
  charWidth: 7.2,
  rootCharWidth: 8.4,
  lineHeight: 18,
  rootLineHeight: 21,
  padX: 12,
  padY: 8,
  /** Nejvíc znaků na řádku (pak se text zalomí). */
  maxChars: 28,
  rootMaxChars: 24,
  /** Mezera mezi rodičem a podřízenými (vodorovně) a mezi větvemi (svisle). */
  gapX: 44,
  gapY: 10,
  minWidth: 48,
} as const

export type MindMapSide = 'root' | 'left' | 'right'

export interface LaidOutNode {
  id: string
  parentId: string | null
  text: string
  lines: string[]
  /** Levý horní roh a rozměry rámečku. */
  x: number
  y: number
  width: number
  height: number
  side: MindMapSide
  depth: number
  /** Index hlavní větve (pro barvu větve); střední téma -1. */
  branch: number
  childCount: number
  collapsed: boolean
}

export interface LaidOutEdge {
  fromId: string
  toId: string
  /** Začátek na vnějším okraji rodiče, konec na vnitřním okraji podřízeného. */
  x1: number
  y1: number
  x2: number
  y2: number
  side: 'left' | 'right'
  branch: number
}

export interface MindMapLayout {
  nodes: LaidOutNode[]
  byId: Map<string, LaidOutNode>
  edges: LaidOutEdge[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

/** Zalomí text po slovech na řádky nejvýš `maxChars` znaků; příliš dlouhé slovo se rozdělí. */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = []
  let line = ''
  for (let word of text.trim().split(/\s+/)) {
    while (word.length > maxChars) {
      if (line) {
        lines.push(line)
        line = ''
      }
      lines.push(word.slice(0, maxChars))
      word = word.slice(maxChars)
    }
    if (!word) continue
    if (!line) line = word
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

export function layoutMindMap(map: MindMap): MindMapLayout {
  const M = MIND_MAP_METRICS
  const root = rootOf(map)

  /** Rozměry uzlu podle textu. */
  const size = (text: string, isRoot: boolean) => {
    const lines = wrapText(text, isRoot ? M.rootMaxChars : M.maxChars)
    const longest = Math.max(...lines.map((l) => l.length))
    const width = Math.max(M.minWidth, Math.ceil(longest * (isRoot ? M.rootCharWidth : M.charWidth)) + 2 * M.padX)
    const height = lines.length * (isRoot ? M.rootLineHeight : M.lineHeight) + 2 * M.padY
    return { lines, width, height }
  }

  /** Viditelní podřízení (u sbalené větve žádní). */
  const visibleChildren = (id: string, collapsed: boolean | undefined) => (collapsed ? [] : childrenOf(map, id))

  // Výška podstromu (pásu) pro každý uzel – počítá se jednou, odspodu.
  const sizes = new Map<string, ReturnType<typeof size>>()
  const bandHeight = new Map<string, number>()
  const measure = (id: string, text: string, collapsed: boolean | undefined, isRoot: boolean): number => {
    const s = size(text, isRoot)
    sizes.set(id, s)
    const kids = visibleChildren(id, collapsed)
    const kidsHeight = kids.reduce((sum, k) => sum + measure(k.id, k.text, k.collapsed, false), 0) + Math.max(0, kids.length - 1) * M.gapY
    const band = Math.max(s.height, kidsHeight)
    bandHeight.set(id, band)
    return band
  }
  measure(root.id, root.text, false, true)

  const nodes: LaidOutNode[] = []
  const edges: LaidOutEdge[] = []

  const rootSize = sizes.get(root.id)!
  const rootNode: LaidOutNode = {
    id: root.id,
    parentId: null,
    text: root.text,
    lines: rootSize.lines,
    x: -rootSize.width / 2,
    y: -rootSize.height / 2,
    width: rootSize.width,
    height: rootSize.height,
    side: 'root',
    depth: 0,
    branch: -1,
    childCount: childrenOf(map, root.id).length,
    collapsed: false,
  }
  nodes.push(rootNode)

  /** Rozmístí podřízené uzly rodiče do pásu na dané straně, svisle kolem středu rodiče. */
  const placeChildren = (parent: LaidOutNode, kids: ReturnType<typeof childrenOf>, side: 'left' | 'right', branchOf: (index: number) => number) => {
    const total = kids.reduce((sum, k) => sum + bandHeight.get(k.id)!, 0) + Math.max(0, kids.length - 1) * M.gapY
    let top = parent.y + parent.height / 2 - total / 2
    kids.forEach((kid, index) => {
      const s = sizes.get(kid.id)!
      const band = bandHeight.get(kid.id)!
      const centerY = top + band / 2
      const x = side === 'right' ? parent.x + parent.width + M.gapX : parent.x - M.gapX - s.width
      const node: LaidOutNode = {
        id: kid.id,
        parentId: parent.id,
        text: kid.text,
        lines: s.lines,
        x,
        y: centerY - s.height / 2,
        width: s.width,
        height: s.height,
        side,
        depth: parent.depth + 1,
        branch: branchOf(index),
        childCount: childrenOf(map, kid.id).length,
        collapsed: !!kid.collapsed && childrenOf(map, kid.id).length > 0,
      }
      nodes.push(node)
      edges.push({
        fromId: parent.id,
        toId: kid.id,
        x1: side === 'right' ? parent.x + parent.width : parent.x,
        y1: parent.y + parent.height / 2,
        x2: side === 'right' ? node.x : node.x + node.width,
        y2: centerY,
        side,
        branch: node.branch,
      })
      placeChildren(node, visibleChildren(kid.id, kid.collapsed), side, () => node.branch)
      top += band + M.gapY
    })
  }

  // Hlavní větve: každá na stranu, která je zatím nižší (při shodě vpravo).
  const branches = childrenOf(map, root.id)
  const right: typeof branches = []
  const left: typeof branches = []
  let rightHeight = 0
  let leftHeight = 0
  for (const b of branches) {
    const h = bandHeight.get(b.id)! + M.gapY
    if (rightHeight <= leftHeight) {
      right.push(b)
      rightHeight += h
    } else {
      left.push(b)
      leftHeight += h
    }
  }
  const branchIndex = new Map(branches.map((b, i) => [b.id, i]))
  placeChildren(rootNode, right, 'right', (i) => branchIndex.get(right[i]!.id)!)
  placeChildren(rootNode, left, 'left', (i) => branchIndex.get(left[i]!.id)!)

  const bounds = {
    minX: Math.min(...nodes.map((n) => n.x)),
    minY: Math.min(...nodes.map((n) => n.y)),
    maxX: Math.max(...nodes.map((n) => n.x + n.width)),
    maxY: Math.max(...nodes.map((n) => n.y + n.height)),
  }
  return { nodes, byId: new Map(nodes.map((n) => [n.id, n])), edges, bounds }
}

export type MindMapDirection = 'up' | 'down' | 'left' | 'right'

/**
 * Pohyb výběru šipkami (MM-01, klávesnice): nahoru / dolů na sourozence na stejné straně,
 * doleva / doprava k rodiči nebo k podřízenému (podle strany, na které uzel leží).
 * U středního tématu šipka doprava / doleva vybere hlavní větev na té straně nejblíž středu.
 * Vrátí ID cílového uzlu, nebo null, když tím směrem nic není.
 */
export function navigate(layout: MindMapLayout, id: string, direction: MindMapDirection): string | null {
  const node = layout.byId.get(id)
  if (!node) return null
  const centerY = (n: LaidOutNode) => n.y + n.height / 2
  const nearest = (candidates: LaidOutNode[]) =>
    candidates.length === 0 ? null : candidates.reduce((best, n) => (Math.abs(centerY(n) - centerY(node)) < Math.abs(centerY(best) - centerY(node)) ? n : best)).id

  if (direction === 'up' || direction === 'down') {
    if (node.side === 'root') return null
    const siblings = layout.nodes.filter((n) => n.parentId === node.parentId && n.side === node.side).sort((a, b) => a.y - b.y)
    const index = siblings.findIndex((n) => n.id === id)
    return siblings[index + (direction === 'up' ? -1 : 1)]?.id ?? null
  }
  const children = layout.nodes.filter((n) => n.parentId === id)
  if (node.side === 'root') return nearest(children.filter((n) => n.side === direction))
  const outward = direction === node.side
  return outward ? nearest(children) : node.parentId
}

/** Kam se uzel přesune po puštění (MM-01, tažení): dovnitř cíle, nebo před / za něj mezi sourozence. */
export interface DropTarget {
  targetId: string
  mode: 'inside' | 'before' | 'after'
  /** Nový rodič a pořadí mezi jeho podřízenými (bez taženého uzlu) – přímo pro moveNode. */
  parentId: string
  index: number
}

/**
 * Cíl puštění taženého uzlu v bodě (x, y) v souřadnicích mapy. Horní a dolní čtvrtina cíle = před / za
 * (mezi sourozence), prostředek = dovnitř (na konec jeho podřízených). Střední téma bere jen „dovnitř“.
 * Mimo uzly, na taženém uzlu nebo v jeho větvi vrátí null (puštění nic nezmění).
 */
export function dropTarget(map: MindMap, layout: MindMapLayout, draggedId: string, x: number, y: number): DropTarget | null {
  // Tažený uzel ani jeho větev nemůžou být cílem.
  const excluded = subtreeIds(map, draggedId)
  const target = layout.nodes.find((n) => !excluded.has(n.id) && x >= n.x && x <= n.x + n.width && y >= n.y && y <= n.y + n.height)
  if (!target) return null
  // Pořadí sourozenců podle mapy (u hlavních větví se strany střídají, poloha shora dolů by nestačila).
  const childrenIds = (parentId: string) =>
    childrenOf(map, parentId)
      .filter((n) => n.id !== draggedId)
      .map((n) => n.id)
  const relative = (y - target.y) / target.height
  if (target.side === 'root' || target.parentId === null || (relative > 0.25 && relative < 0.75)) {
    return { targetId: target.id, mode: 'inside', parentId: target.id, index: Number.MAX_SAFE_INTEGER }
  }
  const siblings = childrenIds(target.parentId)
  const position = siblings.indexOf(target.id)
  return relative <= 0.25
    ? { targetId: target.id, mode: 'before', parentId: target.parentId, index: position }
    : { targetId: target.id, mode: 'after', parentId: target.parentId, index: position + 1 }
}
