import { describe, expect, it } from 'vitest'
import { findCycle, formatPredecessors, parsePredecessors, resolvePredecessors, withDependency } from './predecessors'
import { createEmptyProject, createTask, type Project, type TaskKind } from './schema'

describe('čtení zápisu předchůdců', () => {
  it('prázdný text = žádní předchůdci', () => {
    expect(parsePredecessors('')).toEqual({ ok: true, items: [] })
    expect(parsePredecessors('   ')).toEqual({ ok: true, items: [] })
  })

  it('čísla řádků oddělená středníkem nebo čárkou (bez typu = FS)', () => {
    expect(parsePredecessors('2; 5,7')).toEqual({
      ok: true,
      items: [
        { row: 2, type: 'FS', lagDays: 0 },
        { row: 5, type: 'FS', lagDays: 0 },
        { row: 7, type: 'FS', lagDays: 0 },
      ],
    })
  })

  it('prodleva a předstih, mezery nevadí, volitelně „FS“', () => {
    expect(parsePredecessors('5+3; 6 - 2; 7FS+1; 8 fs')).toEqual({
      ok: true,
      items: [
        { row: 5, type: 'FS', lagDays: 3 },
        { row: 6, type: 'FS', lagDays: -2 },
        { row: 7, type: 'FS', lagDays: 1 },
        { row: 8, type: 'FS', lagDays: 0 },
      ],
    })
  })

  it('typy SS, FF, SF (velká i malá písmena)', () => {
    expect(parsePredecessors('3SS+2; 4ff; 5 SF - 1')).toEqual({
      ok: true,
      items: [
        { row: 3, type: 'SS', lagDays: 2 },
        { row: 4, type: 'FF', lagDays: 0 },
        { row: 5, type: 'SF', lagDays: -1 },
      ],
    })
  })

  it('české zkratky KZ, ZZ, KK, ZK se převedou na FS, SS, FF, SF', () => {
    expect(parsePredecessors('2KZ+1; 3zz+2; 4KK; 5zk')).toEqual({
      ok: true,
      items: [
        { row: 2, type: 'FS', lagDays: 1 },
        { row: 3, type: 'SS', lagDays: 2 },
        { row: 4, type: 'FF', lagDays: 0 },
        { row: 5, type: 'SF', lagDays: 0 },
      ],
    })
  })

  it('nesmyslný zápis vrátí chybu s problematickou částí', () => {
    expect(parsePredecessors('2; abc')).toEqual({ ok: false, error: { code: 'syntax', token: 'abc' } })
    expect(parsePredecessors('3XY+2')).toEqual({ ok: false, error: { code: 'syntax', token: '3XY+2' } })
    expect(parsePredecessors('3SSS')).toEqual({ ok: false, error: { code: 'syntax', token: '3SSS' } })
    expect(parsePredecessors('0')).toEqual({ ok: false, error: { code: 'syntax', token: '0' } })
  })

  it('stejný řádek dvakrát je chyba (i s jiným typem – mezi dvěma činnostmi je nejvýš jedna vazba)', () => {
    expect(parsePredecessors('2; 2+1')).toEqual({ ok: false, error: { code: 'duplicate', row: 2 } })
    expect(parsePredecessors('2; 2SS')).toEqual({ ok: false, error: { code: 'duplicate', row: 2 } })
  })
})

function project(kinds: TaskKind[]): Project {
  const p = createEmptyProject({ name: 'T', language: 'cs', startDate: '2026-11-16' })
  p.tasks = kinds.map((kind, i) => createTask({ id: `t${i + 1}`, name: `Řádek ${i + 1}`, order: i, kind }))
  return p
}

describe('převod čísel řádků na vazby', () => {
  it('najde činnosti podle čísla řádku', () => {
    const p = project(['task', 'task', 'task'])
    const parsed = parsePredecessors('1SS; 2+3')
    if (!parsed.ok) throw new Error()
    expect(resolvePredecessors(p, 't3', parsed.items)).toEqual({
      ok: true,
      dependencies: [
        { predecessorId: 't1', type: 'SS', lagDays: 0 },
        { predecessorId: 't2', type: 'FS', lagDays: 3 },
      ],
    })
  })

  it('odmítne neexistující řádek, sebe sama a fázi', () => {
    const p = project(['task', 'phase', 'task'])
    const item = (row: number) => ({ row, type: 'FS' as const, lagDays: 0 })
    expect(resolvePredecessors(p, 't3', [item(9)])).toEqual({ ok: false, error: { code: 'unknownRow', row: 9 } })
    expect(resolvePredecessors(p, 't3', [item(3)])).toEqual({ ok: false, error: { code: 'self' } })
    expect(resolvePredecessors(p, 't3', [item(2)])).toEqual({ ok: false, error: { code: 'phase', row: 2 } })
    expect(resolvePredecessors(p, 't2', [item(1)])).toEqual({ ok: false, error: { code: 'phaseSuccessor' } })
  })

  it('kruh se hlídá i přes jiné typy než FS', () => {
    const p = project(['task', 'task'])
    p.tasks[1]!.dependencies = [{ predecessorId: 't1', type: 'SS', lagDays: 0 }] // 2 čeká na začátek 1
    expect(resolvePredecessors(p, 't1', [{ row: 2, type: 'FF', lagDays: 0 }])).toEqual({
      ok: false,
      error: { code: 'cycle', rows: [1, 2, 1] },
    })
  })

  it('odmítne vazbu, která by vytvořila kruh, a ukáže ho čísly řádků', () => {
    const p = project(['task', 'task', 'task'])
    p.tasks[1]!.dependencies = [{ predecessorId: 't1', type: 'FS', lagDays: 0 }] // 2 čeká na 1
    p.tasks[2]!.dependencies = [{ predecessorId: 't2', type: 'FS', lagDays: 0 }] // 3 čeká na 2
    // 1 má čekat na 3 → kruh 1 → 2 → 3 → 1
    expect(resolvePredecessors(p, 't1', [{ row: 3, type: 'FS', lagDays: 0 }])).toEqual({
      ok: false,
      error: { code: 'cycle', rows: [1, 2, 3, 1] },
    })
  })
})

describe('přidání vazby kreslením v grafu', () => {
  it('přidá vazbu k dosavadním', () => {
    const p = project(['task', 'task', 'task'])
    p.tasks[2]!.dependencies = [{ predecessorId: 't1', type: 'FS', lagDays: 0 }]
    expect(withDependency(p, 't3', 't2', 'SS')).toEqual({
      ok: true,
      dependencies: [
        { predecessorId: 't1', type: 'FS', lagDays: 0 },
        { predecessorId: 't2', type: 'SS', lagDays: 0 },
      ],
    })
  })

  it('vazbu na stejnou činnost nahradí novým typem (prodleva zůstane)', () => {
    const p = project(['task', 'task'])
    p.tasks[1]!.dependencies = [{ predecessorId: 't1', type: 'FS', lagDays: 3 }]
    expect(withDependency(p, 't2', 't1', 'FF')).toEqual({
      ok: true,
      dependencies: [{ predecessorId: 't1', type: 'FF', lagDays: 3 }],
    })
  })

  it('odmítne sebe sama, fázi a kruh (stejné chyby jako zápis textem)', () => {
    const p = project(['task', 'phase', 'task'])
    expect(withDependency(p, 't1', 't1', 'FS')).toEqual({ ok: false, error: { code: 'self' } })
    expect(withDependency(p, 't3', 't2', 'FS')).toEqual({ ok: false, error: { code: 'phase', row: 2 } })
    expect(withDependency(p, 't2', 't1', 'FS')).toEqual({ ok: false, error: { code: 'phaseSuccessor' } })
    p.tasks[2]!.dependencies = [{ predecessorId: 't1', type: 'SS', lagDays: 0 }]
    expect(withDependency(p, 't1', 't3', 'FF')).toEqual({ ok: false, error: { code: 'cycle', rows: [1, 3, 1] } })
  })
})

describe('hledání kruhu', () => {
  it('bez kruhu vrátí null', () => {
    const p = project(['task', 'task'])
    expect(findCycle(p, 't2', ['t1'])).toBeNull()
  })
})

describe('zobrazení předchůdců', () => {
  it('vazby → text s čísly řádků', () => {
    const p = project(['task', 'task', 'task'])
    p.tasks[2]!.dependencies = [
      { predecessorId: 't1', type: 'FS', lagDays: 0 },
      { predecessorId: 't2', type: 'FS', lagDays: 3 },
    ]
    expect(formatPredecessors(p, p.tasks[2]!)).toBe('1; 2+3')
    p.tasks[2]!.dependencies = [{ predecessorId: 't2', type: 'FS', lagDays: -2 }]
    expect(formatPredecessors(p, p.tasks[2]!)).toBe('2-2')
    expect(formatPredecessors(p, p.tasks[0]!)).toBe('')
  })

  it('typ se zobrazí jen u SS, FF, SF (FS je výchozí)', () => {
    const p = project(['task', 'task', 'task'])
    p.tasks[2]!.dependencies = [
      { predecessorId: 't1', type: 'SS', lagDays: 2 },
      { predecessorId: 't2', type: 'FF', lagDays: 0 },
    ]
    expect(formatPredecessors(p, p.tasks[2]!)).toBe('1SS+2; 2FF')
    p.tasks[2]!.dependencies = [{ predecessorId: 't1', type: 'SF', lagDays: -1 }]
    expect(formatPredecessors(p, p.tasks[2]!)).toBe('1SF-1')
  })

  it('zápis → vazby → zápis vrátí totéž (i z českých zkratek)', () => {
    const p = project(['task', 'task', 'task', 'task'])
    const parsed = parsePredecessors('1ZZ+2; 2KK; 3-1')
    if (!parsed.ok) throw new Error()
    const resolved = resolvePredecessors(p, 't4', parsed.items)
    if (!resolved.ok) throw new Error()
    p.tasks[3]!.dependencies = resolved.dependencies
    expect(formatPredecessors(p, p.tasks[3]!)).toBe('1SS+2; 2FF; 3-1')
  })
})
