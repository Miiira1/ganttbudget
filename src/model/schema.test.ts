import { describe, expect, it } from 'vitest'
import { createEmptyProject, createTask, ProjectSchema, type Project } from './schema'
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

  it('odmítne nesmyslná data (ne objekt projektu)', () => {
    expect(ProjectSchema.safeParse('ahoj').success).toBe(false)
    expect(ProjectSchema.safeParse({}).success).toBe(false)
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
