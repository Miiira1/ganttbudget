import { describe, expect, it } from 'vitest'
import { createEmptyProject, createTask, ProjectSchema, type Project, type TaskKind } from './schema'
import {
  dependenciesRemovedByIndent,
  depthMap,
  descendantIds,
  dropPositionAt,
  duplicate,
  indent,
  MAX_DEPTH,
  moveDown,
  moveTo,
  moveUp,
  outdent,
  treeOrder,
  visibleRows,
  wbsNumbers,
  type HierarchyResult,
} from './hierarchy'

/**
 * Projekt z osnovy: každý řádek je „ID“ odsazené dvěma mezerami za každou úroveň.
 * Velké písmeno F/G/H na začátku ID = fáze, M = milník, jinak činnost.
 * Příklad: ['F', '  A', '  B', 'C'] = fáze F s činnostmi A, B a pak činnost C.
 */
function fromOutline(lines: string[]): Project {
  const project = createEmptyProject({ name: 'Test', language: 'cs', startDate: '2026-11-16' })
  const parents: string[] = [] // parents[d] = poslední položka na úrovni d
  const counters = new Map<string | null, number>()
  project.tasks = lines.map((line) => {
    const depth = (line.length - line.trimStart().length) / 2
    const id = line.trim()
    const parentId = depth === 0 ? null : (parents[depth - 1] ?? null)
    parents[depth] = id
    parents.length = depth + 1
    const order = counters.get(parentId) ?? 0
    counters.set(parentId, order + 1)
    const kind: TaskKind = /^[FGH]/.test(id) ? 'phase' : id.startsWith('M') ? 'milestone' : 'task'
    return { ...createTask({ id, name: id, order, kind }), parentId }
  })
  return project
}

/** Projekt → osnova (pro porovnání v testech). */
function outline(project: Project): string[] {
  const depths = depthMap(project)
  return treeOrder(project).map((t) => '  '.repeat(depths.get(t.id) ?? 0) + t.id)
}

/** Výsledek operace musí být platný projekt; vrátí jeho osnovu. */
function ok(result: HierarchyResult): string[] {
  if (!result.ok) throw new Error(`Operace selhala: ${result.reason}`)
  expect(ProjectSchema.safeParse(result.project).success).toBe(true)
  // Pořadí mezi sourozenci je vždy 0, 1, 2… bez mezer.
  const byParent = new Map<string | null, number[]>()
  for (const t of result.project.tasks) byParent.set(t.parentId, [...(byParent.get(t.parentId) ?? []), t.order])
  for (const orders of byParent.values()) expect([...orders].sort((a, b) => a - b)).toEqual(orders.map((_, i) => i))
  return outline(result.project)
}

const withDeps = (p: Project, deps: Record<string, string[]>): Project => ({
  ...p,
  tasks: p.tasks.map((t) => ({
    ...t,
    dependencies: (deps[t.id] ?? []).map((predecessorId) => ({ predecessorId, type: 'FS' as const, lagDays: 0 })),
  })),
})

const SAMPLE = ['F', '  A', '  G', '    B', '    C', '  D', 'E']

describe('pořadí řádků a čísla', () => {
  it('pořadí = průchod stromem, nezávisle na pořadí v poli', () => {
    const p = fromOutline(SAMPLE)
    const shuffled = { ...p, tasks: [...p.tasks].reverse() }
    expect(outline(shuffled)).toEqual(SAMPLE)
  })

  it('úroveň (hloubka) každé položky', () => {
    const depths = depthMap(fromOutline(SAMPLE))
    expect([...depths.entries()]).toEqual(
      expect.arrayContaining([
        ['F', 0],
        ['A', 1],
        ['B', 2],
        ['E', 0],
      ]),
    )
  })

  it('WBS čísla 1, 1.1, 1.2.1 …', () => {
    const wbs = wbsNumbers(fromOutline(SAMPLE))
    expect(['F', 'A', 'G', 'B', 'C', 'D', 'E'].map((id) => wbs.get(id))).toEqual([
      '1',
      '1.1',
      '1.2',
      '1.2.1',
      '1.2.2',
      '1.3',
      '2',
    ])
  })

  it('podřízené položky do libovolné hloubky', () => {
    expect([...descendantIds(fromOutline(SAMPLE), 'F')].sort()).toEqual(['A', 'B', 'C', 'D', 'G'])
    expect(descendantIds(fromOutline(SAMPLE), 'A').size).toBe(0)
  })

  it('poškozená data (kruh v nadřazených) neztratí řádky – připojí se na konec', () => {
    const p = fromOutline(['A', 'B', 'C'])
    p.tasks = p.tasks.map((t) => (t.id === 'B' ? { ...t, parentId: 'C' } : t.id === 'C' ? { ...t, parentId: 'B' } : t))
    expect(treeOrder(p).map((t) => t.id).sort()).toEqual(['A', 'B', 'C'])
  })
})

describe('sbalené fáze', () => {
  it('skryje podřízené sbalené fáze, i vnořené', () => {
    const p = fromOutline(SAMPLE)
    expect(visibleRows(p, new Set(['G'])).map((t) => t.id)).toEqual(['F', 'A', 'G', 'D', 'E'])
    expect(visibleRows(p, new Set(['F'])).map((t) => t.id)).toEqual(['F', 'E'])
    expect(visibleRows(p, new Set()).length).toBe(7)
  })
})

describe('odsadit', () => {
  it('pod předchozí fázi jako její poslední položka', () => {
    expect(ok(indent(fromOutline(['F', '  A', 'B']), 'B'))).toEqual(['F', '  A', '  B'])
  })

  it('i se svými podřízenými', () => {
    expect(ok(indent(fromOutline(['F', 'G', '  A']), 'G'))).toEqual(['F', '  G', '    A'])
  })

  it('pod obyčejnou činnost: ta se změní na fázi', () => {
    const result = indent(fromOutline(['A', 'B']), 'B')
    expect(ok(result)).toEqual(['A', '  B'])
    expect(result.ok && result.project.tasks.find((t) => t.id === 'A')?.kind).toBe('phase')
  })

  it('převod na fázi odebere vazby nové fáze i vazby na ni (fáze je zatím mít nesmí)', () => {
    const p = withDeps(fromOutline(['X', 'A', 'B', 'C']), { A: ['X'], C: ['A'] })
    expect(dependenciesRemovedByIndent(p, 'B')).toBe(2)
    const result = indent(p, 'B')
    expect(ok(result)).toEqual(['X', 'A', '  B', 'C'])
    if (!result.ok) return
    expect(result.project.tasks.find((t) => t.id === 'A')?.dependencies).toEqual([])
    expect(result.project.tasks.find((t) => t.id === 'C')?.dependencies).toEqual([])
  })

  it('pod fázi se žádné vazby neodebírají', () => {
    expect(dependenciesRemovedByIndent(withDeps(fromOutline(['X', 'F', 'B']), { B: ['X'] }), 'B')).toBe(0)
  })

  it('první položku na úrovni nejde odsadit', () => {
    expect(indent(fromOutline(['A', 'B']), 'A')).toEqual({ ok: false, reason: 'noPreviousSibling' })
    expect(indent(fromOutline(['F', '  A']), 'A')).toEqual({ ok: false, reason: 'noPreviousSibling' })
  })

  it(`nejvýš ${MAX_DEPTH} úrovní`, () => {
    // A a B jsou na 6. úrovni; B pod A by byla 7. úroveň.
    const deep = ['F', '  G', '    H', '      F4', '        F5', '          A', '          B']
    expect(indent(fromOutline(deep), 'B')).toEqual({ ok: false, reason: 'maxDepth' })
    // F5 je na 4. úrovni a má pod sebou ještě 2 úrovně; po odsazení by A byla na 7. úrovni.
    const group = ['F', '  G', '    H', '      F4', '      F5', '        G6', '          A']
    expect(indent(fromOutline(group), 'F5')).toEqual({ ok: false, reason: 'maxDepth' })
    // Na hranici (právě 6 úrovní) to jde.
    const edge = ['F', '  G', '    H', '      F4', '      F5', '        A']
    expect(ok(indent(fromOutline(edge), 'F5')).at(-1)).toBe('          A')
  })
})

describe('předsadit', () => {
  it('za konec své fáze; ostatní položky fáze zůstanou ve fázi', () => {
    expect(ok(outdent(fromOutline(['F', '  A', '  B', '  C', 'D']), 'B'))).toEqual(['F', '  A', '  C', 'B', 'D'])
  })

  it('i se svými podřízenými', () => {
    expect(ok(outdent(fromOutline(SAMPLE), 'G'))).toEqual(['F', '  A', '  D', 'G', '  B', '  C', 'E'])
  })

  it('na nejvyšší úrovni nejde', () => {
    expect(outdent(fromOutline(['A']), 'A')).toEqual({ ok: false, reason: 'topLevel' })
  })
})

describe('nahoru a dolů', () => {
  it('prohodí se sousedem na stejné úrovni, i s podřízenými', () => {
    expect(ok(moveUp(fromOutline(SAMPLE), 'D'))).toEqual(['F', '  A', '  D', '  G', '    B', '    C', 'E'])
    expect(ok(moveDown(fromOutline(SAMPLE), 'A'))).toEqual(['F', '  G', '    B', '    C', '  A', '  D', 'E'])
    expect(ok(moveUp(fromOutline(SAMPLE), 'E'))).toEqual(['E', 'F', '  A', '  G', '    B', '    C', '  D'])
  })

  it('na kraji své úrovně nepřeskočí do jiné fáze', () => {
    expect(moveUp(fromOutline(SAMPLE), 'A')).toEqual({ ok: false, reason: 'noPreviousSibling' })
    expect(moveDown(fromOutline(SAMPLE), 'D')).toEqual({ ok: false, reason: 'noNextSibling' })
  })
})

describe('přesun tažením', () => {
  it('před / za jiný řádek – na jeho úroveň', () => {
    expect(ok(moveTo(fromOutline(SAMPLE), 'E', 'B', 'before'))).toEqual([
      'F',
      '  A',
      '  G',
      '    E',
      '    B',
      '    C',
      '  D',
    ])
    expect(ok(moveTo(fromOutline(SAMPLE), 'A', 'E', 'after'))).toEqual(['F', '  G', '    B', '    C', '  D', 'E', 'A'])
  })

  it('dovnitř fáze jako poslední', () => {
    expect(ok(moveTo(fromOutline(SAMPLE), 'E', 'G', 'inside'))).toEqual([
      'F',
      '  A',
      '  G',
      '    B',
      '    C',
      '    E',
      '  D',
    ])
  })

  it('dovnitř činnosti nejde (do fáze ano)', () => {
    expect(moveTo(fromOutline(SAMPLE), 'E', 'A', 'inside')).toEqual({ ok: false, reason: 'targetNotPhase' })
  })

  it('nejde přesunout do sebe ani do vlastních podřízených', () => {
    expect(moveTo(fromOutline(SAMPLE), 'F', 'B', 'after')).toEqual({ ok: false, reason: 'intoOwnSubtree' })
    expect(moveTo(fromOutline(SAMPLE), 'G', 'G', 'inside')).toEqual({ ok: false, reason: 'intoOwnSubtree' })
  })

  it(`hlídá limit ${MAX_DEPTH} úrovní`, () => {
    const deep = ['F', '  G', '    H', '      F4', '        F5', '          A', 'X', '  Y']
    expect(moveTo(fromOutline(deep), 'X', 'A', 'after')).toEqual({ ok: false, reason: 'maxDepth' })
  })

  it('neexistující položka', () => {
    expect(moveTo(fromOutline(SAMPLE), 'nic', 'A', 'after')).toEqual({ ok: false, reason: 'notFound' })
    expect(indent(fromOutline(SAMPLE), 'nic')).toEqual({ ok: false, reason: 'notFound' })
  })
})

describe('místo vložení podle polohy myši nad řádkem', () => {
  it('nad činností: horní polovina = před, spodní = za', () => {
    expect(dropPositionAt(0, 32, false)).toBe('before')
    expect(dropPositionAt(15, 32, false)).toBe('before')
    expect(dropPositionAt(16, 32, false)).toBe('after')
    expect(dropPositionAt(31, 32, false)).toBe('after')
  })

  it('nad fází: horní třetina = před, prostředek = dovnitř, spodní třetina = za', () => {
    expect(dropPositionAt(5, 30, true)).toBe('before')
    expect(dropPositionAt(10, 30, true)).toBe('inside')
    expect(dropPositionAt(19, 30, true)).toBe('inside')
    expect(dropPositionAt(20, 30, true)).toBe('after')
  })
})

describe('duplikovat (fáze 4b)', () => {
  let counter = 0
  const makeId = () => `n${++counter}`

  it('kopie činnosti hned pod originál, s příponou názvu a s jejími vazbami', () => {
    counter = 0
    const p = withDeps(fromOutline(['X', 'A', 'B']), { A: ['X'] })
    const result = duplicate(p, 'A', makeId, ' (kopie)')
    expect(result.ok && result.newId).toBe('n1')
    if (!result.ok) return
    expect(ok(result)).toEqual(['X', 'A', 'n1', 'B'])
    const copy = result.project.tasks.find((t) => t.id === 'n1')
    expect(copy?.name).toBe('A (kopie)')
    expect(copy?.dependencies.map((d) => d.predecessorId)).toEqual(['X'])
  })

  it('fáze i s činnostmi; vazby uvnitř kopie vedou na kopie, ven zůstanou', () => {
    counter = 0
    const p = withDeps(fromOutline(['X', 'F', '  A', '  B', 'C']), { A: ['X'], B: ['A'], C: ['B'] })
    const result = duplicate(p, 'F', makeId, ' (kopie)')
    if (!result.ok) throw new Error(result.reason)
    expect(ok(result)).toEqual(['X', 'F', '  A', '  B', 'n1', '  n2', '  n3', 'C'])
    const byId = new Map(result.project.tasks.map((t) => [t.id, t]))
    expect(byId.get('n1')?.name).toBe('F (kopie)')
    expect(byId.get('n2')?.name).toBe('A') // přípona jen u kopírovaného řádku, ne u jeho činností
    expect(byId.get('n2')?.dependencies.map((d) => d.predecessorId)).toEqual(['X'])
    expect(byId.get('n3')?.dependencies.map((d) => d.predecessorId)).toEqual(['n2'])
    expect(byId.get('C')?.dependencies.map((d) => d.predecessorId)).toEqual(['B']) // na originál
  })

  it('dlouhý název se zkrátí na povolenou délku', () => {
    const p = fromOutline(['A'])
    p.tasks[0]!.name = 'x'.repeat(200)
    const result = duplicate(p, 'A', () => 'n', ' (kopie)')
    expect(result.ok && result.project.tasks.find((t) => t.id === 'n')?.name.length).toBe(200)
  })

  it('neexistující řádek', () => {
    expect(duplicate(fromOutline(['A']), 'nic', makeId, ' (kopie)')).toEqual({ ok: false, reason: 'notFound' })
  })
})

describe('výkon (N-02)', () => {
  it('300 řádků v 30 fázích: pořadí, WBS, úrovně, viditelné řádky a přesun do 50 ms', () => {
    const lines = Array.from({ length: 30 }, (_, f) => [`F${f}`, ...Array.from({ length: 9 }, (_, i) => `  T${f}_${i}`)]).flat()
    const p = fromOutline(lines)
    const run = () => {
      treeOrder(p)
      wbsNumbers(p)
      depthMap(p)
      visibleRows(p, new Set(['F3', 'F7']))
      const moved = moveTo(p, 'T0_0', 'F29', 'inside')
      const indented = indent(p, 'F1')
      return [moved.ok, indented.ok]
    }
    run() // zahřátí
    // Nejrychlejší z pěti běhů (měří kód, ne náhodné vytížení počítače).
    let best = Infinity
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now()
      expect(run()).toEqual([true, true])
      best = Math.min(best, performance.now() - t0)
    }
    expect(best).toBeLessThan(50)
  })
})

describe('čistota', () => {
  it('operace nemění vstupní projekt', () => {
    const p = fromOutline(SAMPLE)
    const copy = structuredClone(p)
    indent(p, 'D')
    outdent(p, 'B')
    moveUp(p, 'D')
    moveTo(p, 'E', 'G', 'inside')
    expect(p).toEqual(copy)
  })
})
