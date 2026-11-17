import { describe, expect, it } from 'vitest'
import { treeOrder } from './hierarchy'
import { addChild, createMindMap, rootOf, toggleCollapsed, type MapResult } from './mindMap'
import { MIND_MAP_TASK_DAYS, planFromMindMap } from './mindMapToPlan'
import { createEmptyProject, createTask, ProjectSchema, type MindMap, type Project } from './schema'

let seq = 0
const newId = () => `id${++seq}`
function ok(result: MapResult): { map: MindMap; id: string } {
  if (!result.ok) throw new Error(result.reason)
  return { map: result.map, id: result.id ?? '' }
}

/** Mapa: Projekt → Příprava (Analýza, Rozpočet), Realizace (Montáž (Mechanika, Elektro)), Předání. */
function sampleMap(): MindMap {
  let map = createMindMap('Projekt', newId)
  const root = rootOf(map).id
  const add = (parent: string, text: string) => {
    const r = ok(addChild(map, parent, text, newId))
    map = r.map
    return r.id
  }
  const prep = add(root, 'Příprava')
  add(prep, 'Analýza')
  add(prep, 'Rozpočet')
  const build = add(root, 'Realizace')
  const mount = add(build, 'Montáž')
  add(mount, 'Mechanika')
  add(mount, 'Elektro')
  add(root, 'Předání')
  return map
}

const emptyProject = () => createEmptyProject({ name: 'P', language: 'cs', startDate: '2026-11-23' })
const outline = (p: Project) => treeOrder(p).map((t) => `${t.kind}:${t.name}`)

describe('vytvořit plán z mapy', () => {
  it('uzly s podřízenými jsou fáze, listy činnosti s výchozí délkou a bez vazeb; střední téma se nepřevádí', () => {
    const r = planFromMindMap(emptyProject(), sampleMap(), 'append', newId)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(outline(r.project)).toEqual([
      'phase:Příprava',
      'task:Analýza',
      'task:Rozpočet',
      'phase:Realizace',
      'phase:Montáž',
      'task:Mechanika',
      'task:Elektro',
      'task:Předání',
    ])
    const tasks = r.project.tasks.filter((t) => t.kind === 'task')
    expect(tasks.every((t) => t.durationDays === MIND_MAP_TASK_DAYS && t.dependencies.length === 0)).toBe(true)
    expect(r.summary).toEqual({ phases: 3, tasks: 5, removedTasks: 0, removedLines: 0, removedActuals: 0 })
    expect(ProjectSchema.safeParse(r.project).success).toBe(true)
  })

  it('sbalené větve se převedou také; mapa v projektu zůstane', () => {
    const map = sampleMap()
    const prep = map.nodes.find((n) => n.text === 'Příprava')!.id
    const collapsed = ok(toggleCollapsed(map, prep)).map
    const project = { ...emptyProject(), mindMap: collapsed }
    const r = planFromMindMap(project, collapsed, 'append', newId)
    expect(r.ok && outline(r.project).slice(0, 3)).toEqual(['phase:Příprava', 'task:Analýza', 'task:Rozpočet'])
    expect(r.ok && r.project.mindMap).toBe(collapsed)
  })

  it('přidat na konec: stávající položky zůstanou, nové za nimi', () => {
    const base = { ...emptyProject(), tasks: [{ ...createTask({ id: 'old', name: 'Stará činnost', order: 0 }) }] }
    const r = planFromMindMap(base, sampleMap(), 'append', newId)
    expect(r.ok && outline(r.project)[0]).toBe('task:Stará činnost')
    expect(r.ok && r.project.tasks).toHaveLength(9)
  })

  it('nahradit: staré položky zmizí a souhrn řekne, kolik se ztratí řádků nákladů a skutečnosti', () => {
    const old = {
      ...createTask({ id: 'old', name: 'Stará', order: 0 }),
      lines: [{ id: 'l1', kind: 'oneTime' as const, categoryId: 'cat-services', name: 'X', amount: 100, timing: 'end' as const }],
      actuals: [{ id: 'a1', date: '2026-11-24', amount: 50 }],
    }
    const base = { ...emptyProject(), tasks: [old] }
    const r = planFromMindMap(base, sampleMap(), 'replace', newId)
    expect(r.ok && r.project.tasks.some((t) => t.id === 'old')).toBe(false)
    expect(r.ok && r.summary).toMatchObject({ removedTasks: 1, removedLines: 1, removedActuals: 1 })
    expect(r.ok && ProjectSchema.safeParse(r.project).success).toBe(true)
  })

  it('mapa jen se středním tématem se převést nedá', () => {
    expect(planFromMindMap(emptyProject(), createMindMap('Projekt', newId), 'append', newId)).toEqual({ ok: false, reason: 'emptyMap' })
  })
})
