import { describe, expect, it } from 'vitest'
import {
  addChild,
  addSibling,
  childrenOf,
  createMindMap,
  depthOf,
  moveNode,
  removeNode,
  renameNode,
  rootOf,
  toggleCollapsed,
  type MapResult,
} from './mindMap'
import { createEmptyProject, MAX_MIND_MAP_DEPTH, MAX_MIND_MAP_NODES, MindMapSchema, ProjectSchema, type MindMap } from './schema'

let seq = 0
const newId = () => `n${++seq}`

/** Výsledek, který musí projít (jinak test selže s důvodem). */
function ok(result: MapResult): { map: MindMap; id: string } {
  if (!result.ok) throw new Error(`neočekávaná chyba: ${result.reason}`)
  return { map: result.map, id: result.id ?? '' }
}
const texts = (map: MindMap, parentId: string) => childrenOf(map, parentId).map((n) => n.text)

/** Mapa: Projekt → A (A1, A2), B. */
function sample() {
  let map = createMindMap('Projekt', newId)
  const root = rootOf(map).id
  const a = ok(addChild(map, root, 'A', newId))
  map = a.map
  const b = ok(addChild(map, root, 'B', newId))
  map = b.map
  const a1 = ok(addChild(map, a.id, 'A1', newId))
  map = a1.map
  const a2 = ok(addChild(map, a.id, 'A2', newId))
  map = a2.map
  return { map, root, a: a.id, b: b.id, a1: a1.id, a2: a2.id }
}

describe('myšlenková mapa – formát v souboru', () => {
  it('nová mapa má jen kořen a projde schématem; projekt s mapou i bez ní je platný', () => {
    const map = createMindMap('  Nová hala ', newId)
    expect(map.nodes).toEqual([{ id: expect.any(String), parentId: null, order: 0, text: 'Nová hala' }])
    expect(MindMapSchema.safeParse(map).success).toBe(true)
    const project = createEmptyProject({ name: 'P', language: 'cs', startDate: '2026-11-23' })
    expect(ProjectSchema.safeParse(project).success).toBe(true)
    expect(ProjectSchema.safeParse({ ...project, mindMap: sample().map }).success).toBe(true)
  })

  it('schéma odmítne: dva kořeny, neznámého rodiče, kruh, duplicitní ID, prázdný text, příliš hluboko, příliš mnoho uzlů', () => {
    const bad = (nodes: MindMap['nodes']) => MindMapSchema.safeParse({ nodes }).success
    const node = (id: string, parentId: string | null, order = 0, text = id) => ({ id, parentId, order, text })
    expect(bad([node('r', null), node('s', null)])).toBe(false)
    expect(bad([node('r', null), node('a', 'x')])).toBe(false)
    expect(bad([node('r', null), node('a', 'b'), node('b', 'a')])).toBe(false)
    expect(bad([node('r', null), node('a', 'r'), node('a', 'r', 1)])).toBe(false)
    expect(bad([node('r', null), node('a', 'r', 0, '   ')])).toBe(false)
    const chain = [node('r', null), ...Array.from({ length: MAX_MIND_MAP_DEPTH + 1 }, (_, i) => node(`d${i}`, i === 0 ? 'r' : `d${i - 1}`))]
    expect(bad(chain)).toBe(false)
    expect(bad(chain.slice(0, -1))).toBe(true)
    expect(bad([node('r', null), ...Array.from({ length: MAX_MIND_MAP_NODES }, (_, i) => node(`x${i}`, 'r', i))])).toBe(false)
  })
})

describe('myšlenková mapa – úpravy', () => {
  it('přidání podřízeného a sourozence (hned za uzel)', () => {
    const s = sample()
    expect(texts(s.map, s.root)).toEqual(['A', 'B'])
    expect(texts(s.map, s.a)).toEqual(['A1', 'A2'])
    const sib = ok(addSibling(s.map, s.a1, 'A1b', newId))
    expect(texts(sib.map, s.a)).toEqual(['A1', 'A1b', 'A2'])
    expect(depthOf(sib.map, sib.id)).toBe(2)
    expect(MindMapSchema.safeParse(sib.map).success).toBe(true)
  })

  it('kořen nemá sourozence a nejde smazat ani přesunout', () => {
    const s = sample()
    expect(addSibling(s.map, s.root, 'X', newId)).toEqual({ ok: false, reason: 'root' })
    expect(removeNode(s.map, s.root)).toEqual({ ok: false, reason: 'root' })
    expect(moveNode(s.map, s.root, s.b, 0)).toEqual({ ok: false, reason: 'root' })
  })

  it('přidání do sbalené větve ji rozbalí', () => {
    const s = sample()
    const collapsed = ok(toggleCollapsed(s.map, s.a)).map
    expect(collapsed.nodes.find((n) => n.id === s.a)?.collapsed).toBe(true)
    const added = ok(addChild(collapsed, s.a, 'A3', newId)).map
    expect(added.nodes.find((n) => n.id === s.a)?.collapsed).toBeFalsy()
  })

  it('smazání odstraní celou větev a přečísluje sourozence', () => {
    const s = sample()
    const removed = ok(removeNode(s.map, s.a)).map
    expect(removed.nodes.map((n) => n.text).sort()).toEqual(['B', 'Projekt'])
    expect(childrenOf(removed, s.root).map((n) => n.order)).toEqual([0])
  })

  it('přejmenování ořízne mezery, prázdný text odmítne', () => {
    const s = sample()
    expect(texts(ok(renameNode(s.map, s.b, '  Bé  ')).map, s.root)).toEqual(['A', 'Bé'])
    expect(renameNode(s.map, s.b, '   ')).toEqual({ ok: false, reason: 'emptyText' })
    expect(renameNode(s.map, s.b, 'x'.repeat(201))).toEqual({ ok: false, reason: 'tooLong' })
  })

  it('přesun pod jiný uzel a změna pořadí', () => {
    const s = sample()
    const moved = ok(moveNode(s.map, s.a2, s.b, 0)).map
    expect(texts(moved, s.a)).toEqual(['A1'])
    expect(texts(moved, s.b)).toEqual(['A2'])
    const reordered = ok(moveNode(s.map, s.b, s.root, 0)).map
    expect(texts(reordered, s.root)).toEqual(['B', 'A'])
    expect(MindMapSchema.safeParse(reordered).success).toBe(true)
  })

  it('přesun do vlastní větve a přes limit hloubky se odmítne', () => {
    const s = sample()
    expect(moveNode(s.map, s.a, s.a1, 0)).toEqual({ ok: false, reason: 'cycle' })
    let map = s.map
    let parent = s.b
    for (let i = 0; i < MAX_MIND_MAP_DEPTH - 1; i++) {
      const r = ok(addChild(map, parent, `D${i}`, newId))
      map = r.map
      parent = r.id
    }
    expect(depthOf(map, parent)).toBe(MAX_MIND_MAP_DEPTH)
    expect(addChild(map, parent, 'moc', newId)).toEqual({ ok: false, reason: 'tooDeep' })
    // Větev A má 2 úrovně; pod uzel v hloubce 5 by se nevešla.
    const deep = map.nodes.find((n) => n.text === 'D3')!.id
    expect(moveNode(map, s.a, deep, 0)).toEqual({ ok: false, reason: 'tooDeep' })
  })

  it('limit počtu uzlů', () => {
    let map = createMindMap('R', newId)
    const root = rootOf(map).id
    for (let i = 1; i < MAX_MIND_MAP_NODES; i++) map = ok(addChild(map, root, `x${i}`, newId)).map
    expect(addChild(map, root, 'navíc', newId)).toEqual({ ok: false, reason: 'tooMany' })
  })
})
