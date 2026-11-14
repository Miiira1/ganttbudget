import { describe, expect, it } from 'vitest'
import { createEmptyProject, createTask, ProjectSchema, type Project, type TaskKind } from './schema'
import { isValidIsoDate, todayIso } from './dates'

function validProject(): Project {
  const project = createEmptyProject({ name: 'Test', language: 'cs', startDate: '2026-11-16' })
  project.tasks = [
    createTask({ id: 'a', name: 'Analýza', order: 0, durationDays: 5 }),
    createTask({ id: 'b', name: 'Podpis', order: 1, kind: 'milestone' }),
  ]
  return project
}

describe('schéma projektu', () => {
  it('přijme platný projekt', () => {
    expect(ProjectSchema.safeParse(validProject()).success).toBe(true)
  })

  it('přijme nový prázdný projekt', () => {
    expect(ProjectSchema.safeParse(createEmptyProject({ name: 'Nový', language: 'en' })).success).toBe(true)
  })

  it('odmítne zápornou délku', () => {
    const project = validProject()
    project.tasks[0]!.durationDays = -3
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne činnost bez názvu (i jen s mezerami)', () => {
    const project = validProject()
    project.tasks[0]!.name = '   '
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne milník s nenulovou délkou', () => {
    const project = validProject()
    project.tasks[1]!.durationDays = 2
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne % hotovo mimo 0–100', () => {
    const project = validProject()
    project.tasks[0]!.percentComplete = 120
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne duplicitní ID činností', () => {
    const project = validProject()
    project.tasks[1]!.id = 'a'
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne vazbu na neexistující činnost', () => {
    const project = validProject()
    project.tasks[1]!.dependencies = [{ predecessorId: 'xyz', type: 'FS', lagDays: 0 }]
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne neplatné datum a jinou verzi formátu', () => {
    expect(ProjectSchema.safeParse({ ...validProject(), startDate: '2026-02-30' }).success).toBe(false)
    expect(ProjectSchema.safeParse({ ...validProject(), schemaVersion: 99 }).success).toBe(false)
  })

  it('odmítne kalendář bez pracovních dnů a odstávku s koncem před začátkem', () => {
    const noDays = validProject()
    noDays.calendar.workingWeekdays = []
    expect(ProjectSchema.safeParse(noDays).success).toBe(false)
    const badRange = validProject()
    badRange.calendar.customHolidays = [{ start: '2026-12-31', end: '2026-12-21', name: 'x' }]
    expect(ProjectSchema.safeParse(badRange).success).toBe(false)
  })

  it('odmítne nesmyslná data (ne objekt projektu)', () => {
    expect(ProjectSchema.safeParse('ahoj').success).toBe(false)
    expect(ProjectSchema.safeParse({}).success).toBe(false)
  })
})

/** Kódy chyb, které schéma ohlásí (pro přehledné porovnání v testech). */
function issueCodes(project: unknown): string[] {
  const result = ProjectSchema.safeParse(project)
  return result.success ? [] : result.error.issues.map((i) => i.message)
}

describe('schéma projektu – strom a vazby (fáze 5: soubor zvenku)', () => {
  /** Projekt ze seznamu [id, nadřazená, typ]. */
  function tree(items: [string, string | null, TaskKind][]): Project {
    const project = createEmptyProject({ name: 'Test', language: 'cs', startDate: '2026-11-16' })
    project.tasks = items.map(([id, parentId, kind], order) => ({ ...createTask({ id, name: id, order, kind }), parentId }))
    return project
  }

  it('přijme platný strom fází', () => {
    expect(issueCodes(tree([['F', null, 'phase'], ['A', 'F', 'task'], ['G', 'F', 'phase'], ['B', 'G', 'task']]))).toEqual([])
  })

  it('podřízené položky smí mít jen fáze', () => {
    expect(issueCodes(tree([['A', null, 'task'], ['B', 'A', 'task']]))).toContain('parentNotPhase')
  })

  it('kruh v nadřazených (A pod B, B pod A)', () => {
    expect(issueCodes(tree([['A', 'B', 'phase'], ['B', 'A', 'phase']]))).toContain('parentCycle')
  })

  it('nejvýš 6 úrovní', () => {
    const items: [string, string | null, TaskKind][] = [
      ['F1', null, 'phase'],
      ['F2', 'F1', 'phase'],
      ['F3', 'F2', 'phase'],
      ['F4', 'F3', 'phase'],
      ['F5', 'F4', 'phase'],
      ['F6', 'F5', 'phase'],
    ]
    expect(issueCodes(tree(items))).toEqual([]) // 6 úrovní je v pořádku
    expect(issueCodes(tree([...items, ['A', 'F6', 'task']]))).toContain('tooDeep')
  })

  it('vazba sama na sebe, dvakrát na stejnou činnost a vazby fází se odmítnou', () => {
    const self = tree([['A', null, 'task']])
    self.tasks[0]!.dependencies = [{ predecessorId: 'A', type: 'FS', lagDays: 0 }]
    expect(issueCodes(self)).toContain('selfDependency')

    const twice = tree([['A', null, 'task'], ['B', null, 'task']])
    twice.tasks[1]!.dependencies = [
      { predecessorId: 'A', type: 'FS', lagDays: 0 },
      { predecessorId: 'A', type: 'SS', lagDays: 0 },
    ]
    expect(issueCodes(twice)).toContain('duplicateDependency')

    const phase = tree([['F', null, 'phase'], ['A', null, 'task']])
    phase.tasks[1]!.dependencies = [{ predecessorId: 'F', type: 'FS', lagDays: 0 }]
    expect(issueCodes(phase)).toContain('phaseDependency')
    phase.tasks[1]!.dependencies = []
    phase.tasks[0]!.dependencies = [{ predecessorId: 'A', type: 'FS', lagDays: 0 }]
    expect(issueCodes(phase)).toContain('phaseDependency')
  })
})

describe('data', () => {
  it('pozná platné a neplatné ISO dny', () => {
    expect(isValidIsoDate('2028-02-29')).toBe(true) // přestupný rok
    expect(isValidIsoDate('2027-02-29')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('14. 11. 2026')).toBe(false)
  })

  it('dnešek vrací ve formátu YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
