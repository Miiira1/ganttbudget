import { describe, expect, it } from 'vitest'
import { schedule } from '../engine/schedule'
import { computeCosts } from './costs'
import { budgetStatus, computeCostTimeline } from './costTimeline'
import { computeLoad } from './load'
import { checkPlan } from './planCheck'
import { ProjectSchema } from './schema'
import { extractJson, MAX_AI_TEXT, parseAiPlan, type AiPlanErrorCode } from './aiPlan'

const SETTINGS = { name: 'Modernizace lakovny', startDate: '2026-11-23', currency: 'CZK', language: 'cs' }
let seq = 0
const newId = () => `id-${++seq}`

/** Malý správný plán: 2 fáze, 3 činnosti, milník, vazby a náklady. */
const GOOD = {
  format: 'miro-ai-plan',
  version: 1,
  tasks: [
    { id: 'P1', name: 'Příprava', kind: 'phase', duration: 0 },
    { id: 'A', name: 'Analýza', kind: 'task', parent: 'P1', duration: 5, costs: [{ name: 'Konzultant', amount: 20000, category: 'services', when: 'end' }] },
    { id: 'B', name: 'Návrh', kind: 'task', parent: 'P1', duration: 10, dependsOn: [{ id: 'A' }] },
    { id: 'P2', name: 'Realizace', kind: 'phase', duration: 0 },
    { id: 'C', name: 'Montáž', kind: 'task', parent: 'P2', duration: 15, dependsOn: [{ id: 'B', type: 'SS', lag: 3 }], costs: [{ name: 'Pronájem plošiny', amount: 1500.5, category: 'services', when: 'perDay' }] },
    { id: 'M', name: 'Předání', kind: 'milestone', parent: 'P2', duration: 0, dependsOn: [{ id: 'C' }], costs: [{ name: 'Doplatek', amount: 100000, category: 'investment', when: 'start' }] },
  ],
}

const parse = (value: unknown) => parseAiPlan(typeof value === 'string' ? value : JSON.stringify(value), SETTINGS, newId)
const codes = (value: unknown): AiPlanErrorCode[] => {
  const r = parse(value)
  return r.ok ? [] : r.errors.map((e) => e.code)
}
const withTasks = (tasks: unknown[]) => ({ ...GOOD, tasks })

describe('vytažení JSON z odpovědi AI', () => {
  it('čistý JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } })
  })

  it('JSON v bloku ```json s textem okolo', () => {
    const text = 'Tady je plán:\n```json\n{"a": 2}\n```\nDoufám, že pomůže.'
    expect(extractJson(text)).toEqual({ ok: true, value: { a: 2 } })
  })

  it('JSON uprostřed textu bez bloku', () => {
    expect(extractJson('Výsledek: {"a": [1, 2]} – hotovo.')).toEqual({ ok: true, value: { a: [1, 2] } })
  })

  it('bez JSON a s neplatným JSON', () => {
    expect(extractJson('Omlouvám se, nemohu pomoci.')).toMatchObject({ ok: false, code: 'noJson' })
    expect(extractJson('{"a": 1,, }')).toMatchObject({ ok: false, code: 'invalidJson' })
  })
})

describe('AI plán → nový projekt', () => {
  it('správný plán dá platný projekt s nastavením, hierarchií, vazbami a náklady', () => {
    const r = parse(GOOD)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const p = r.project
    expect(ProjectSchema.safeParse(p).success).toBe(true)
    expect(p).toMatchObject({ name: 'Modernizace lakovny', startDate: '2026-11-23', currency: 'CZK', language: 'cs' })
    const byName = new Map(p.tasks.map((t) => [t.name, t]))
    const a = byName.get('Analýza')!
    const b = byName.get('Návrh')!
    const c = byName.get('Montáž')!
    expect(a.parentId).toBe(byName.get('Příprava')!.id)
    expect([a.order, b.order]).toEqual([0, 1])
    expect(c.dependencies).toEqual([{ predecessorId: b.id, type: 'SS', lagDays: 3 }])
    expect(byName.get('Předání')).toMatchObject({ kind: 'milestone', durationDays: 0 })
    expect(a.lines).toEqual([expect.objectContaining({ kind: 'oneTime', name: 'Konzultant', amount: 2_000_000, timing: 'end', categoryId: 'cat-services' })])
    expect(c.lines).toEqual([expect.objectContaining({ kind: 'recurring', amount: 150_050, period: 'day' })])
    // ID z AI se do projektu nepřenášejí (jsou jen v odpovědi).
    expect(p.tasks.some((t) => t.id === 'A')).toBe(false)
  })

  it('kontrola plánu na správném plánu nic nehlásí', () => {
    const r = parse(GOOD)
    if (!r.ok) throw new Error('plán měl projít')
    const s = schedule(r.project)
    const issues = checkPlan({
      project: r.project,
      scheduled: s,
      load: computeLoad(r.project, s),
      budget: budgetStatus(r.project, computeCostTimeline(r.project, s, computeCosts(r.project, s))),
      today: '2026-11-17',
    })
    expect(issues).toEqual([])
  })

  it('pole format a version jsou nepovinná, výchozí typ vazby FS, prodleva 0', () => {
    const { format, version, ...rest } = GOOD
    void format
    void version
    const r = parse(rest)
    expect(r.ok).toBe(true)
  })

  it('milník s nenulovou délkou se opraví na 0 s upozorněním', () => {
    const r = parse(withTasks([...GOOD.tasks.slice(0, 5), { ...GOOD.tasks[5], duration: 2 }]))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings).toEqual([expect.objectContaining({ code: 'milestoneDuration', taskId: 'M' })])
  })
})

describe('AI plán – chyby', () => {
  it('příliš dlouhý text', () => {
    expect(codes('x'.repeat(MAX_AI_TEXT + 1))).toEqual(['tooLarge'])
  })

  it('chybějící a neplatná pole se ohlásí s číslem položky', () => {
    const r = parse(withTasks([{ id: 'A', kind: 'task', duration: 'pět' }]))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.map((e) => [e.code, e.item, e.field])).toEqual([
      ['missingField', 1, 'name'],
      ['invalidField', 1, 'duration'],
    ])
  })

  it('prázdný plán a víc než 300 položek', () => {
    expect(codes(withTasks([]))).toEqual(['noTasks'])
    const many = Array.from({ length: 301 }, (_, i) => ({ id: `T${i}`, name: `T${i}`, kind: 'task', duration: 1 }))
    expect(codes(withTasks(many))).toEqual(['tooManyTasks'])
  })

  it('duplicitní id, neznámý předchůdce, neznámý rodič, rodič není fáze', () => {
    expect(codes(withTasks([...GOOD.tasks, { id: 'A', name: 'Znovu', kind: 'task', duration: 1 }]))).toContain('duplicateId')
    expect(codes(withTasks([{ id: 'A', name: 'A', kind: 'task', duration: 1, dependsOn: [{ id: 'X' }] }]))).toEqual(['unknownPredecessor'])
    expect(codes(withTasks([{ id: 'A', name: 'A', kind: 'task', duration: 1, parent: 'Q' }]))).toEqual(['unknownParent'])
    expect(codes(withTasks([{ id: 'A', name: 'A', kind: 'task', duration: 1 }, { id: 'B', name: 'B', kind: 'task', duration: 1, parent: 'A' }]))).toEqual(['parentNotPhase'])
  })

  it('vazby: na sebe, s fází, dvakrát na stejného předchůdce', () => {
    expect(codes(withTasks([{ id: 'A', name: 'A', kind: 'task', duration: 1, dependsOn: [{ id: 'A' }] }]))).toEqual(['selfDependency'])
    expect(codes(withTasks([{ id: 'P', name: 'P', kind: 'phase', duration: 0 }, { id: 'A', name: 'A', kind: 'task', duration: 1, dependsOn: [{ id: 'P' }] }]))).toEqual(['phaseDependency'])
    expect(
      codes(withTasks([{ id: 'A', name: 'A', kind: 'task', duration: 1 }, { id: 'P', name: 'P', kind: 'phase', duration: 0, dependsOn: [{ id: 'A' }] }])),
    ).toEqual(['phaseDependency'])
    expect(codes(withTasks([{ id: 'A', name: 'A', kind: 'task', duration: 1 }, { id: 'B', name: 'B', kind: 'task', duration: 1, dependsOn: [{ id: 'A' }, { id: 'A', type: 'SS' }] }]))).toEqual([
      'duplicateDependency',
    ])
  })

  it('kruh ve vazbách a v rodičích, příliš hluboko', () => {
    expect(codes(withTasks([{ id: 'A', name: 'A', kind: 'task', duration: 1, dependsOn: [{ id: 'B' }] }, { id: 'B', name: 'B', kind: 'task', duration: 1, dependsOn: [{ id: 'A' }] }]))).toEqual([
      'cycle',
    ])
    expect(codes(withTasks([{ id: 'P', name: 'P', kind: 'phase', duration: 0, parent: 'Q' }, { id: 'Q', name: 'Q', kind: 'phase', duration: 0, parent: 'P' }]))).toEqual(['parentCycle'])
    const deep = Array.from({ length: 7 }, (_, i) => ({ id: `P${i}`, name: `P${i}`, kind: 'phase', duration: 0, ...(i > 0 ? { parent: `P${i - 1}` } : {}) }))
    expect(codes(withTasks([...deep, { id: 'A', name: 'A', kind: 'task', duration: 1, parent: 'P6' }]))).toEqual(['tooDeep'])
  })

  it('průběžný náklad u milníku a záporná částka', () => {
    expect(codes(withTasks([{ id: 'M', name: 'M', kind: 'milestone', duration: 0, costs: [{ name: 'X', amount: 10, category: 'services', when: 'perWeek' }] }]))).toEqual(['milestoneRecurring'])
    expect(codes(withTasks([{ id: 'A', name: 'A', kind: 'task', duration: 1, costs: [{ name: 'X', amount: -5, category: 'services', when: 'end' }] }]))).toEqual(['invalidField'])
  })

  it('chyba nese technický detail pro prompt na opravu', () => {
    const r = parse('{"tasks": [ }')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatchObject({ code: 'invalidJson', detail: expect.any(String) })
  })
})
