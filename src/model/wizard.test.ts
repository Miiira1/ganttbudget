import { describe, expect, it } from 'vitest'
import { schedule } from '../engine/schedule'
import { computeCosts } from './costs'
import { budgetStatus, computeCostTimeline } from './costTimeline'
import { computeLoad } from './load'
import { checkPlan } from './planCheck'
import { ProjectSchema } from './schema'
import { createWizardProject, MAX_WIZARD_PHASES, validateWizard, type WizardAnswers } from './wizard'

function answers(patch: Partial<WizardAnswers> = {}): WizardAnswers {
  return {
    name: 'Můj projekt',
    currency: 'CZK',
    language: 'cs',
    startDate: '2026-11-23',
    workingWeekdays: [1, 2, 3, 4, 5],
    useCzechHolidays: true,
    shutdowns: [],
    phases: ['Příprava', 'Realizace', 'Předání'],
    addFirstTasks: true,
    firstTaskName: 'První činnost',
    ...patch,
  }
}

let seq = 0
const newId = () => `id-${++seq}`

describe('průvodce prvním projektem – sestavení projektu', () => {
  it('název, měna, začátek a kalendář se převezmou; projekt je platný', () => {
    const p = createWizardProject(
      answers({ name: '  Nová hala  ', currency: 'EUR', workingWeekdays: [1, 2, 3, 4, 5, 6], useCzechHolidays: false, shutdowns: [{ start: '2026-12-21', end: '2026-12-31', name: 'Vánoce' }] }),
      newId,
    )
    expect(ProjectSchema.safeParse(p).success).toBe(true)
    expect(p).toMatchObject({ name: 'Nová hala', currency: 'EUR', startDate: '2026-11-23', language: 'cs' })
    expect(p.calendar).toEqual({ workingWeekdays: [1, 2, 3, 4, 5, 6], useCzechHolidays: false, customHolidays: [{ start: '2026-12-21', end: '2026-12-31', name: 'Vánoce' }], removedHolidays: [] })
  })

  it('fáze v zadaném pořadí; prázdné názvy se vynechají a mezery ořežou', () => {
    const p = createWizardProject(answers({ phases: [' Analýza ', '', '   ', 'Návrh'], addFirstTasks: false }), newId)
    expect(p.tasks.map((t) => [t.name, t.kind, t.parentId, t.order])).toEqual([
      ['Analýza', 'phase', null, 0],
      ['Návrh', 'phase', null, 1],
    ])
  })

  it('s první činností: v každé fázi jedna činnost (5 dní), propojené za sebou – kontrola plánu nic nehlásí', () => {
    const p = createWizardProject(answers(), newId)
    const phases = p.tasks.filter((t) => t.kind === 'phase')
    const tasks = p.tasks.filter((t) => t.kind === 'task')
    expect(phases).toHaveLength(3)
    expect(tasks.map((t) => [t.name, t.durationDays, t.parentId])).toEqual(phases.map((ph) => ['První činnost', 5, ph.id]))
    expect(tasks[0]!.dependencies).toEqual([])
    expect(tasks[1]!.dependencies).toEqual([{ predecessorId: tasks[0]!.id, type: 'FS', lagDays: 0 }])
    expect(tasks[2]!.dependencies).toEqual([{ predecessorId: tasks[1]!.id, type: 'FS', lagDays: 0 }])

    const scheduled = schedule(p)
    const issues = checkPlan({
      project: p,
      scheduled,
      load: computeLoad(p, scheduled),
      budget: budgetStatus(p, computeCostTimeline(p, scheduled, computeCosts(p, scheduled))),
      today: '2026-11-17',
    })
    expect(issues).toEqual([])
    expect(scheduled.projectFinish).toBe('2026-12-11') // 15 pracovních dnů od 23. 11.
  })

  it('bez fází vznikne prázdný plán', () => {
    expect(createWizardProject(answers({ phases: [] }), newId).tasks).toEqual([])
  })

  it('ID jsou jedinečná', () => {
    const p = createWizardProject(answers(), newId)
    expect(new Set(p.tasks.map((t) => t.id)).size).toBe(p.tasks.length)
  })
})

describe('průvodce – kontrola odpovědí', () => {
  it('správné odpovědi projdou', () => {
    expect(validateWizard(answers())).toEqual([])
  })

  it('chybí název, chybné datum, žádný pracovní den', () => {
    expect(validateWizard(answers({ name: '   ', startDate: '2026-02-30', workingWeekdays: [] }))).toEqual(['nameMissing', 'startInvalid', 'noWorkingDay'])
  })

  it('odstávka bez data nebo s koncem před začátkem', () => {
    expect(validateWizard(answers({ shutdowns: [{ start: '', end: '2026-12-01', name: 'X' }] }))).toEqual(['shutdownMissingDates'])
    expect(validateWizard(answers({ shutdowns: [{ start: '2026-12-05', end: '2026-12-01', name: 'X' }] }))).toEqual(['shutdownEndBeforeStart'])
  })

  it('příliš mnoho fází nebo příliš dlouhý název', () => {
    expect(validateWizard(answers({ phases: Array.from({ length: MAX_WIZARD_PHASES + 1 }, (_, i) => `F${i}`) }))).toEqual(['tooManyPhases'])
    expect(validateWizard(answers({ name: 'x'.repeat(201) }))).toEqual(['nameTooLong'])
    expect(validateWizard(answers({ phases: ['x'.repeat(201)] }))).toEqual(['phaseNameTooLong'])
  })
})
