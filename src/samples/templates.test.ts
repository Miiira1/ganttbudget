import { describe, expect, it } from 'vitest'
import { schedule } from '../engine/schedule'
import { LANGUAGES } from '../i18n/languages'
import { computeCosts } from '../model/costs'
import { budgetStatus, computeCostTimeline } from '../model/costTimeline'
import { nextMonday } from '../model/dates'
import { computeLoad } from '../model/load'
import { checkPlan, type PlanIssue } from '../model/planCheck'
import { ProjectSchema } from '../model/schema'
import { createFromTemplate, summarizeProject, templateName, TEMPLATES } from './templates'

/** Překlad, který při chybějícím textu selže (šablona musí být přeložená celá). */
const translator = (translation: unknown) => (key: string) => {
  const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], translation)
  if (typeof value !== 'string') throw new Error(`Chybí překlad ${key}`)
  return value
}

/** Varování kontroly plánu, která šablona smí mít (záměr, ne chyba). */
const ALLOWED: Record<string, string[]> = {
  // Náhradní ruční výroba (SF) na nic nenavazuje – ukázka vazby SF.
  automation: ['noSuccessor:sample-t6c'],
}

describe('nejbližší pondělí', () => {
  it('z úterý, neděle i pondělí na další pondělí', () => {
    expect(nextMonday('2026-11-17')).toBe('2026-11-23')
    expect(nextMonday('2026-11-22')).toBe('2026-11-23')
    expect(nextMonday('2026-11-23')).toBe('2026-11-30')
    expect(nextMonday('2026-12-29')).toBe('2027-01-04')
  })
})

describe.each(TEMPLATES.map((x) => x.id))('šablona %s', (id) => {
  const start = '2027-01-04'

  it.each(LANGUAGES)('v jazyce $code je přeložená a projde kontrolou schématu', (language) => {
    const project = createFromTemplate(id, translator(language.translation), language.code, start)
    expect(ProjectSchema.safeParse(project).success).toBe(true)
    expect(project.name).toBe(templateName(id, translator(language.translation)))
    expect(project.language).toBe(language.code)
  })

  const project = createFromTemplate(id, translator(LANGUAGES[0]!.translation), 'cs', start)
  const scheduled = schedule(project)

  it('má 20–30 položek, začíná zvoleným dnem a nemá baseline ani skutečnost', () => {
    expect(project.tasks.length).toBeGreaterThanOrEqual(20)
    expect(project.tasks.length).toBeLessThanOrEqual(30)
    expect(project.startDate).toBe(start)
    expect(project.baselines).toEqual([])
    expect(project.tasks.every((t) => t.percentComplete === 0 && !t.actuals?.length)).toBe(true)
  })

  it('je kompletní: fáze, činnosti, milníky, vazby, zdroje a rozpočet', () => {
    const kinds = new Set(project.tasks.map((t) => t.kind))
    expect(kinds).toEqual(new Set(['phase', 'task', 'milestone']))
    expect(project.tasks.some((t) => t.dependencies.length > 0)).toBe(true)
    expect(project.professions.length).toBeGreaterThan(0)
    expect(project.workers.length).toBeGreaterThan(0)
    expect(project.tasks.filter((t) => t.lines.length > 0).length).toBeGreaterThanOrEqual(10)
    const costs = computeCosts(project, scheduled)
    expect(costs.project.total).toBeGreaterThan(0)
    expect([...costs.lines.values()].every((c) => c.warning === null)).toBe(true)
  })

  it('vazby nemají kruh a všechny položky dostanou termín', () => {
    expect(scheduled.cycleTaskIds.size).toBe(0)
    expect(scheduled.error).toBeUndefined()
    for (const task of project.tasks) expect(scheduled.tasks.get(task.id)?.finish, task.id).toBeTruthy()
  })

  it('kontrola plánu nenajde nic kromě záměrných ukázek', () => {
    const issues = checkPlan({
      project,
      scheduled,
      load: computeLoad(project, scheduled),
      budget: budgetStatus(project, computeCostTimeline(project, scheduled, computeCosts(project, scheduled))),
      today: start,
    })
    // Přetížení se v šabloně připouští jen jako ukázka; ostatní varování ne.
    const key = (i: PlanIssue) => `${i.kind}:${'taskId' in i ? i.taskId : ''}`
    expect(issues.filter((i) => i.kind !== 'overload').map(key)).toEqual(ALLOWED[id] ?? [])
  })

  it('souhrn na kartu: počet položek, délka v měsících a rozpočet', () => {
    const summary = summarizeProject(project)
    expect(summary.items).toBe(project.tasks.length)
    expect(summary.finish).toBe(scheduled.projectFinish)
    expect(summary.months).toBeGreaterThanOrEqual(1)
    expect(summary.cost).toBe(computeCosts(project, scheduled).project.total)
  })
})
