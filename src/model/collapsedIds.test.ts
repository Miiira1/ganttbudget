import { describe, expect, it } from 'vitest'
import { parseProjectFile, serializeProject } from '../io/projectFile'
import { attachCollapsed, detachCollapsed } from './collapsedIds'
import { createEmptyProject, createTask, ProjectSchema, type Project } from './schema'

/** Fáze F1 (s činností A), fáze F2 bez podřízených a samostatná činnost B. */
function project(): Project {
  const base = createEmptyProject({ name: 'Test', language: 'cs', startDate: '2026-11-16' })
  const f1 = createTask({ id: 'f1', name: 'F1', order: 0, kind: 'phase' })
  const a = { ...createTask({ id: 'a', name: 'A', order: 0 }), parentId: 'f1' }
  const f2 = createTask({ id: 'f2', name: 'F2', order: 1, kind: 'phase' })
  const b = createTask({ id: 'b', name: 'B', order: 2 })
  return { ...base, tasks: [f1, a, f2, b] }
}

describe('sbalené fáze v souboru projektu (Project.collapsedIds, 13c)', () => {
  it('přibalí jen sbalené fáze, které v projektu jsou (bez činností a neznámých ID)', () => {
    const saved = attachCollapsed(project(), new Set(['f1', 'b', 'zmizela']))
    expect(saved.collapsedIds).toEqual(['f1'])
    expect(ProjectSchema.safeParse(saved).success).toBe(true)
  })

  it('nic sbaleného → pole v souboru vůbec není', () => {
    const saved = attachCollapsed(project(), new Set())
    expect('collapsedIds' in saved).toBe(false)
  })

  it('po otevření se sbalení vybalí a z projektu zmizí (nejde tak do historie Zpět)', () => {
    const { project: opened, collapsed } = detachCollapsed({ ...project(), collapsedIds: ['f1', 'b', 'neznama'] })
    expect([...collapsed]).toEqual(['f1'])
    expect('collapsedIds' in opened).toBe(false)
  })

  it('projekt bez pole (starší soubor) se otevře beze změny a nic není sbalené', () => {
    const original = project()
    const { project: opened, collapsed } = detachCollapsed(original)
    expect(opened).toBe(original)
    expect(collapsed.size).toBe(0)
  })

  it('uložení → otevření souboru zachová sbalení', () => {
    const text = serializeProject(attachCollapsed(project(), new Set(['f1', 'f2'])))
    const parsed = parseProjectFile(text)
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error))
    expect([...detachCollapsed(parsed.project).collapsed].sort()).toEqual(['f1', 'f2'])
  })
})
