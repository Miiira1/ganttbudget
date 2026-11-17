import { describe, expect, it } from 'vitest'
import { addChild, createMindMap, rootOf, toggleCollapsed, type MapResult } from './mindMap'
import { layoutMindMap, wrapText, type LaidOutNode } from './mindMapLayout'
import type { MindMap } from './schema'

let seq = 0
const newId = () => `n${++seq}`
function ok(result: MapResult): { map: MindMap; id: string } {
  if (!result.ok) throw new Error(result.reason)
  return { map: result.map, id: result.id ?? '' }
}

/** Mapa se zadaným počtem hlavních větví, každá s `leaves` listy. */
function build(branches: number, leaves: number) {
  let map = createMindMap('Projekt', newId)
  const root = rootOf(map).id
  const ids: string[] = []
  for (let b = 0; b < branches; b++) {
    const branch = ok(addChild(map, root, `Větev ${b + 1}`, newId))
    map = branch.map
    ids.push(branch.id)
    for (let l = 0; l < leaves; l++) map = ok(addChild(map, branch.id, `Úkol ${b + 1}.${l + 1}`, newId)).map
  }
  return { map, root, branches: ids }
}

const overlaps = (a: LaidOutNode, b: LaidOutNode) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
const centerY = (n: LaidOutNode) => n.y + n.height / 2

describe('zalamování textu uzlu', () => {
  it('krátký text je na jednom řádku, dlouhý se zalomí po slovech, dlouhé slovo se rozdělí', () => {
    expect(wrapText('Analýza', 28)).toEqual(['Analýza'])
    expect(wrapText('Výběr dodavatele a podpis smlouvy o dílo', 20)).toEqual(['Výběr dodavatele a', 'podpis smlouvy o', 'dílo'])
    expect(wrapText('x'.repeat(45), 20)).toEqual(['x'.repeat(20), 'x'.repeat(20), 'x'.repeat(5)])
  })
})

describe('rozložení myšlenkové mapy', () => {
  it('samotné střední téma je uprostřed (0, 0)', () => {
    const layout = layoutMindMap(createMindMap('Projekt', newId))
    const root = layout.nodes[0]!
    expect(root.side).toBe('root')
    expect(root.x + root.width / 2).toBeCloseTo(0)
    expect(centerY(root)).toBeCloseTo(0)
    expect(layout.edges).toEqual([])
  })

  it('hlavní větve se rozdělí rovnoměrně vpravo a vlevo, pořadí shora dolů zůstane', () => {
    const { map, branches } = build(4, 2)
    const layout = layoutMindMap(map)
    const side = (id: string) => layout.byId.get(id)!.side
    expect(branches.map(side)).toEqual(['right', 'left', 'right', 'left'])
    const right = branches.filter((id) => side(id) === 'right').map((id) => centerY(layout.byId.get(id)!))
    expect(right[0]).toBeLessThan(right[1]!)
  })

  it('podřízené uzly leží směrem ven od rodiče', () => {
    const { map, branches } = build(2, 3)
    const layout = layoutMindMap(map)
    const root = layout.nodes.find((n) => n.side === 'root')!
    for (const id of branches) {
      const branch = layout.byId.get(id)!
      const children = layout.nodes.filter((n) => n.parentId === id)
      expect(children).toHaveLength(3)
      for (const child of children) {
        if (branch.side === 'right') expect(child.x).toBeGreaterThan(branch.x + branch.width)
        else expect(child.x + child.width).toBeLessThan(branch.x)
      }
      if (branch.side === 'right') expect(branch.x).toBeGreaterThan(root.x + root.width)
      else expect(branch.x + branch.width).toBeLessThan(root.x)
      // Rodič je svisle uprostřed svých podřízených.
      const ys = children.map(centerY)
      expect(centerY(branch)).toBeCloseTo((Math.min(...ys) + Math.max(...ys)) / 2)
    }
  })

  it('žádné dva uzly se nepřekrývají ani u nerovnoměrné mapy s dlouhými texty', () => {
    let { map, branches } = build(5, 0)
    for (let i = 0; i < 7; i++) map = ok(addChild(map, branches[0]!, `Dlouhý název činnosti číslo ${i + 1}, který se musí zalomit do více řádků`, newId)).map
    const deep = ok(addChild(map, branches[1]!, 'Hloubka 2', newId))
    map = deep.map
    for (let i = 0; i < 3; i++) map = ok(addChild(map, deep.id, `Hloubka 3 – ${i}`, newId)).map
    const nodes = layoutMindMap(map).nodes
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) expect(overlaps(nodes[i]!, nodes[j]!), `${nodes[i]!.text} × ${nodes[j]!.text}`).toBe(false)
  })

  it('vyvážení: velká větev dostane stranu sama, malé jdou na druhou', () => {
    let { map, branches } = build(3, 0)
    for (let i = 0; i < 6; i++) map = ok(addChild(map, branches[0]!, `Úkol ${i}`, newId)).map
    const layout = layoutMindMap(map)
    expect(branches.map((id) => layout.byId.get(id)!.side)).toEqual(['right', 'left', 'left'])
  })

  it('sbalená větev skryje podřízené a zmenší mapu; uzel ví, že má skryté podřízené', () => {
    const { map, branches } = build(2, 4)
    const open = layoutMindMap(map)
    const collapsed = layoutMindMap(ok(toggleCollapsed(map, branches[0]!)).map)
    expect(collapsed.nodes).toHaveLength(open.nodes.length - 4)
    expect(collapsed.byId.get(branches[0]!)).toMatchObject({ collapsed: true, childCount: 4 })
    expect(collapsed.bounds.maxY - collapsed.bounds.minY).toBeLessThanOrEqual(open.bounds.maxY - open.bounds.minY)
  })

  it('každý viditelný uzel kromě kořene má spojnici od rodiče; meze obsahují všechny uzly', () => {
    const { map } = build(3, 2)
    const layout = layoutMindMap(map)
    expect(layout.edges).toHaveLength(layout.nodes.length - 1)
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(layout.bounds.minX)
      expect(n.x + n.width).toBeLessThanOrEqual(layout.bounds.maxX)
      expect(n.y).toBeGreaterThanOrEqual(layout.bounds.minY)
      expect(n.y + n.height).toBeLessThanOrEqual(layout.bounds.maxY)
    }
  })
})

describe('pohyb výběru šipkami', () => {
  it('od středu na větve, ven k podřízeným, zpět k rodiči, mezi sourozenci', async () => {
    const { navigate } = await import('./mindMapLayout')
    const { map, root, branches } = build(4, 2)
    const layout = layoutMindMap(map)
    const right = navigate(layout, root, 'right')!
    const left = navigate(layout, root, 'left')!
    expect(layout.byId.get(right)!.side).toBe('right')
    expect(layout.byId.get(left)!.side).toBe('left')
    // Na pravé straně doprava = podřízený, doleva = rodič; na levé naopak.
    const rightChild = navigate(layout, right, 'right')!
    expect(layout.byId.get(rightChild)!.parentId).toBe(right)
    expect(navigate(layout, rightChild, 'left')).toBe(right)
    expect(layout.byId.get(navigate(layout, left, 'left')!)!.parentId).toBe(left)
    expect(navigate(layout, left, 'right')).toBe(root)
    // Sourozenci shora dolů; na konci nic.
    const top = branches[0]!
    const next = navigate(layout, top, 'down')!
    expect(layout.byId.get(next)!.side).toBe('right')
    expect(navigate(layout, top, 'up')).toBeNull()
    expect(navigate(layout, rightChild, 'right')).toBeNull()
    expect(navigate(layout, root, 'up')).toBeNull()
  })
})

describe('cíl puštění při tažení uzlu', () => {
  it('prostředek = dovnitř, horní / dolní čtvrtina = před / za; vlastní větev ani prázdné místo nejsou cíl', async () => {
    const { dropTarget } = await import('./mindMapLayout')
    const { map, root, branches } = build(4, 2)
    const layout = layoutMindMap(map)
    const [b1, b2, b3] = branches as [string, string, string]
    const t3 = layout.byId.get(b3)!
    const at = (n: LaidOutNode, rel: number) => [n.x + n.width / 2, n.y + n.height * rel] as const
    expect(dropTarget(map, layout, b1, ...at(t3, 0.5))).toEqual({ targetId: b3, mode: 'inside', parentId: b3, index: Number.MAX_SAFE_INTEGER })
    // b3 je třetí větev; bez taženého b1 je mezi větvemi na pozici 1.
    expect(dropTarget(map, layout, b1, ...at(t3, 0.1))).toEqual({ targetId: b3, mode: 'before', parentId: root, index: 1 })
    expect(dropTarget(map, layout, b1, ...at(t3, 0.9))).toEqual({ targetId: b3, mode: 'after', parentId: root, index: 2 })
    // Na střední téma vždy dovnitř.
    const rootNode = layout.byId.get(root)!
    expect(dropTarget(map, layout, b2, ...at(rootNode, 0.1))).toMatchObject({ mode: 'inside', parentId: root })
    // Vlastní podřízený a prázdné místo.
    const child = layout.nodes.find((n) => n.parentId === b1)!
    expect(dropTarget(map, layout, b1, ...at(child, 0.5))).toBeNull()
    expect(dropTarget(map, layout, b1, layout.bounds.maxX + 100, 0)).toBeNull()
  })
})
