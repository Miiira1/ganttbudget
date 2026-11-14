import { describe, expect, it } from 'vitest'
import { findCycle, formatPredecessors, parsePredecessors, resolvePredecessors } from './predecessors'
import { createEmptyProject, createTask, type Project, type TaskKind } from './schema'

describe('čtení zápisu předchůdců', () => {
  it('prázdný text = žádní předchůdci', () => {
    expect(parsePredecessors('')).toEqual({ ok: true, items: [] })
    expect(parsePredecessors('   ')).toEqual({ ok: true, items: [] })
  })

  it('čísla řádků oddělená středníkem nebo čárkou', () => {
    expect(parsePredecessors('2; 5,7')).toEqual({
      ok: true,
      items: [
        { row: 2, lagDays: 0 },
        { row: 5, lagDays: 0 },
        { row: 7, lagDays: 0 },
      ],
    })
  })

  it('prodleva a předstih, mezery nevadí, volitelně „FS“', () => {
    expect(parsePredecessors('5+3; 6 - 2; 7FS+1; 8 fs')).toEqual({
      ok: true,
      items: [
        { row: 5, lagDays: 3 },
        { row: 6, lagDays: -2 },
        { row: 7, lagDays: 1 },
        { row: 8, lagDays: 0 },
      ],
    })
  })

  it('nesmyslný zápis vrátí chybu s problematickou částí', () => {
    expect(parsePredecessors('2; abc')).toEqual({ ok: false, error: { code: 'syntax', token: 'abc' } })
    expect(parsePredecessors('3SS+2')).toEqual({ ok: false, error: { code: 'unsupportedType', token: '3SS+2' } })
    expect(parsePredecessors('0')).toEqual({ ok: false, error: { code: 'syntax', token: '0' } })
  })

  it('stejný řádek dvakrát je chyba', () => {
    expect(parsePredecessors('2; 2+1')).toEqual({ ok: false, error: { code: 'duplicate', row: 2 } })
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
    const parsed = parsePredecessors('1; 2+3')
    if (!parsed.ok) throw new Error()
    expect(resolvePredecessors(p, 't3', parsed.items)).toEqual({
      ok: true,
      dependencies: [
        { predecessorId: 't1', type: 'FS', lagDays: 0 },
        { predecessorId: 't2', type: 'FS', lagDays: 3 },
      ],
    })
  })

  it('odmítne neexistující řádek, sebe sama a fázi', () => {
    const p = project(['task', 'phase', 'task'])
    expect(resolvePredecessors(p, 't3', [{ row: 9, lagDays: 0 }])).toEqual({ ok: false, error: { code: 'unknownRow', row: 9 } })
    expect(resolvePredecessors(p, 't3', [{ row: 3, lagDays: 0 }])).toEqual({ ok: false, error: { code: 'self' } })
    expect(resolvePredecessors(p, 't3', [{ row: 2, lagDays: 0 }])).toEqual({ ok: false, error: { code: 'phase', row: 2 } })
    expect(resolvePredecessors(p, 't2', [{ row: 1, lagDays: 0 }])).toEqual({ ok: false, error: { code: 'phaseSuccessor' } })
  })

  it('odmítne vazbu, která by vytvořila kruh, a ukáže ho čísly řádků', () => {
    const p = project(['task', 'task', 'task'])
    p.tasks[1]!.dependencies = [{ predecessorId: 't1', type: 'FS', lagDays: 0 }] // 2 čeká na 1
    p.tasks[2]!.dependencies = [{ predecessorId: 't2', type: 'FS', lagDays: 0 }] // 3 čeká na 2
    // 1 má čekat na 3 → kruh 1 → 2 → 3 → 1
    expect(resolvePredecessors(p, 't1', [{ row: 3, lagDays: 0 }])).toEqual({
      ok: false,
      error: { code: 'cycle', rows: [1, 2, 3, 1] },
    })
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
})
