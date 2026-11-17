/**
 * Průvodce prvním projektem (U-01, fáze 10): z odpovědí průvodce sestaví nový projekt.
 * ČISTÁ FUNKCE (testy v wizard.test.ts) – okno průvodce jen sbírá odpovědi.
 *
 * Projekt: název, měna, jazyk, začátek, kalendář (pracovní dny, české svátky, odstávky)
 * a první fáze. Volitelně do každé fáze jedna první činnost (5 pracovních dnů), propojené
 * za sebou vazbou FS – plán tak má smysluplný tvar a kontrola plánu nic nehlásí.
 * Konec projektu se nezadává: vyplyne z plánu.
 */
import { holidaySettings, type HolidayChoice } from '../engine/calendar'
import { isValidIsoDate } from './dates'
import { createDefaultCalendar, createEmptyProject, createTask, type Project, type Task } from './schema'

/** Nejvíc fází v průvodci (další jdou přidat v plánu). */
export const MAX_WIZARD_PHASES = 12
/** Nejvíc odstávek v průvodci (další jdou přidat v okně Kalendář). */
export const MAX_WIZARD_SHUTDOWNS = 20
/** Délka první činnosti ve fázi (pracovní dny). */
export const FIRST_TASK_DAYS = 5
const MAX_NAME = 200

/** Měny nabízené v průvodci (jedna měna na projekt; později se měnit nedá). */
export const WIZARD_CURRENCIES = ['CZK', 'EUR', 'USD', 'PLN'] as const

export interface WizardAnswers {
  name: string
  currency: string
  language: string
  startDate: string
  workingWeekdays: number[]
  /** Státní svátky: země, nebo „bez svátků“ (fáze 13d). */
  holidays: HolidayChoice
  shutdowns: { start: string; end: string; name: string }[]
  phases: string[]
  addFirstTasks: boolean
  /** Název první činnosti ve fázi (z překladu). */
  firstTaskName: string
}

export type WizardError =
  | 'nameMissing'
  | 'nameTooLong'
  | 'startInvalid'
  | 'noWorkingDay'
  | 'shutdownMissingDates'
  | 'shutdownEndBeforeStart'
  | 'tooManyShutdowns'
  | 'tooManyPhases'
  | 'phaseNameTooLong'

/** Názvy fází bez prázdných a bez okrajových mezer. */
const cleanPhases = (phases: string[]) => phases.map((p) => p.trim()).filter((p) => p !== '')

/** Kontrola odpovědí; prázdný seznam = vše v pořádku. Pořadí chyb odpovídá krokům průvodce. */
export function validateWizard(a: WizardAnswers): WizardError[] {
  const errors: WizardError[] = []
  const name = a.name.trim()
  if (name === '') errors.push('nameMissing')
  else if (name.length > MAX_NAME) errors.push('nameTooLong')
  if (!isValidIsoDate(a.startDate)) errors.push('startInvalid')
  if (a.workingWeekdays.length === 0) errors.push('noWorkingDay')
  if (a.shutdowns.length > MAX_WIZARD_SHUTDOWNS) errors.push('tooManyShutdowns')
  if (a.shutdowns.some((s) => !isValidIsoDate(s.start) || !isValidIsoDate(s.end))) errors.push('shutdownMissingDates')
  else if (a.shutdowns.some((s) => s.end < s.start)) errors.push('shutdownEndBeforeStart')
  const phases = cleanPhases(a.phases)
  if (phases.length > MAX_WIZARD_PHASES) errors.push('tooManyPhases')
  if (phases.some((p) => p.length > MAX_NAME)) errors.push('phaseNameTooLong')
  return errors
}

/** Sestaví projekt z (ověřených) odpovědí. `newId` vyrábí jedinečná ID položek. */
export function createWizardProject(a: WizardAnswers, newId: () => string): Project {
  const project = createEmptyProject({ name: a.name.trim(), language: a.language, startDate: a.startDate })
  project.currency = a.currency
  project.calendar = {
    ...createDefaultCalendar(),
    workingWeekdays: [...a.workingWeekdays].sort((x, y) => x - y),
    ...holidaySettings(a.holidays),
    customHolidays: a.shutdowns.map((s) => ({ start: s.start, end: s.end, name: s.name.trim().slice(0, MAX_NAME) })),
  }

  const tasks: Task[] = []
  let previousTaskId: string | null = null
  cleanPhases(a.phases).forEach((phaseName, order) => {
    const phaseId = newId()
    tasks.push(createTask({ id: phaseId, name: phaseName, order, kind: 'phase' }))
    if (!a.addFirstTasks) return
    const taskId = newId()
    tasks.push({
      ...createTask({ id: taskId, name: a.firstTaskName, order: 0, durationDays: FIRST_TASK_DAYS }),
      parentId: phaseId,
      dependencies: previousTaskId ? [{ predecessorId: previousTaskId, type: 'FS', lagDays: 0 }] : [],
    })
    previousTaskId = taskId
  })
  project.tasks = tasks
  return project
}
