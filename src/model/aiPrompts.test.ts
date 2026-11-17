import { describe, expect, it } from 'vitest'
import { isoToDay } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import { LANGUAGES } from '../i18n/languages'
import { addSampleTracking, createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import { parseAiPlan, type AiPlanError, type AiPlanErrorCode } from './aiPlan'
import { AI_QUESTIONS, describeAiError, fixPrompt, planPrompt, projectForAi, type AiExportData, type Translate } from './aiPrompts'
import { computeCosts } from './costs'
import { budgetStatus, computeCostTimeline } from './costTimeline'
import { earnedValue } from './earnedValue'
import { computeLoad } from './load'
import { checkPlan } from './planCheck'

/** Překlad podle souboru jazyka s dosazením {{proměnných}} (jako i18next bez ošetření HTML). */
const translator =
  (translation: unknown): Translate =>
  (key, options = {}) => {
    const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], translation)
    if (typeof value !== 'string') throw new Error(`Chybí překlad ${key}`)
    return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''))
  }
const [cs, en] = LANGUAGES.map((l) => translator(l.translation)) as [Translate, Translate]

const SETTINGS = { name: 'Modernizace lakovny', startDate: '2026-11-23', currency: 'CZK', language: 'cs' }

/** První blok ```json z textu. */
const jsonBlock = (text: string) => /```json\s*([\s\S]*?)```/.exec(text)?.[1] ?? ''

describe('prompt na vytvoření plánu', () => {
  it.each([
    ['cs', cs],
    ['en', en],
  ] as const)('%s: obsahuje zadání, nastavení a platný příklad formátu', (language, t) => {
    const prompt = planPrompt(t, language, { ...SETTINGS, description: 'Nová lakovací linka pro díly karoserie.' })
    expect(prompt).toContain('Nová lakovací linka pro díly karoserie.')
    expect(prompt).toContain('Modernizace lakovny')
    expect(prompt).toContain('CZK')
    expect(prompt).toContain('"miro-ai-plan"')
    // Příklad v promptu musí projít stejnou kontrolou jako odpověď AI.
    const example = parseAiPlan(jsonBlock(prompt), { ...SETTINGS, language }, () => crypto.randomUUID())
    expect(example.ok).toBe(true)
  })

  it('jazyk promptu odpovídá jazyku aplikace', () => {
    expect(planPrompt(cs, 'cs', { ...SETTINGS, description: 'x' })).toContain('pracovních dnech')
    expect(planPrompt(en, 'en', { ...SETTINGS, description: 'x' })).toContain('working days')
  })
})

describe('chyby odpovědi AI a prompt na opravu', () => {
  const ALL: AiPlanErrorCode[] = [
    'tooLarge', 'noJson', 'invalidJson', 'notPlan', 'noTasks', 'tooManyTasks', 'missingField', 'invalidField', 'duplicateId', 'unknownParent',
    'parentNotPhase', 'parentCycle', 'tooDeep', 'unknownPredecessor', 'selfDependency', 'phaseDependency', 'duplicateDependency', 'milestoneRecurring', 'cycle', 'invalidResult',
  ]

  it.each([cs, en])('každá chyba má srozumitelný text bez nevyplněných proměnných', (t) => {
    for (const code of ALL) {
      const text = describeAiError(t, { code, item: 3, taskId: 'T1', field: 'duration', other: 'X', detail: 'A, B' })
      expect(text.length, code).toBeGreaterThan(10)
      expect(text, code).not.toContain('{{')
    }
  })

  it('prompt na opravu obsahuje chyby, technické detaily a původní odpověď', () => {
    const errors: AiPlanError[] = [
      { code: 'unknownPredecessor', item: 4, taskId: 'T4', other: 'T9' },
      { code: 'invalidJson', detail: 'Unexpected token } in JSON at position 120' },
    ]
    const prompt = fixPrompt(cs, errors, '{"tasks": [ }')
    expect(prompt).toContain('T9')
    expect(prompt).toContain('Unexpected token')
    expect(prompt).toContain('{"tasks": [ }')
    expect(prompt).toContain('"miro-ai-plan"')
  })
})

describe('projekt pro AI (Markdown)', () => {
  const project = createSampleProject(translateCs, 'cs', '2026-09-21')
  addSampleTracking(project, translateCs, '2026-11-16')
  const scheduled = schedule(project)
  const costs = computeCosts(project, scheduled)
  const timeline = computeCostTimeline(project, scheduled, costs)
  const budget = budgetStatus(project, timeline)
  const load = computeLoad(project, scheduled)
  const data: AiExportData = {
    project,
    scheduled,
    costs,
    timeline,
    budget,
    load,
    issues: checkPlan({ project, scheduled, load, budget, today: '2026-11-16' }),
    ev: earnedValue(project, scheduled, project.baselines[0]!, isoToDay('2026-11-16')),
  }
  const workerNames = project.workers.map((w) => w.name)

  it('bez zaškrtnutí neobsahuje jména pracovníků ani sazby', () => {
    const text = projectForAi(cs, 'cs', data, { question: cs('ai.questions.risks.text'), includeNames: false })
    for (const name of workerNames) expect(text, name).not.toContain(name)
    expect(text).not.toContain('/h')
  })

  it('se zaškrtnutím obsahuje jména pracovníků a sazby', () => {
    const text = projectForAi(cs, 'cs', data, { question: '', includeNames: true })
    expect(text).toContain('Eva Horáková')
    expect(text).toContain('/h')
  })

  it('obsahuje plán, rozpočet, varování a Earned Value; otázka je na konci', () => {
    const question = 'Najdi největší riziko.'
    const text = projectForAi(cs, 'cs', data, { question, includeNames: false })
    expect(text.startsWith('# ')).toBe(true)
    expect(text).toContain(project.name)
    expect(text).toContain(project.tasks[1]!.name)
    expect(text).toContain('| ') // tabulka
    expect(text).toContain('CPI')
    expect(text.trimEnd().endsWith(question)).toBe(true)
  })

  it('myšlenková mapa je v exportu jako osnova před otázkou; mapa jen se středním tématem ne (fáze 12)', () => {
    const question = 'Otázka?'
    const mindMap = { nodes: [{ id: 'r', parentId: null, order: 0, text: 'Střed' }, { id: 'a', parentId: 'r', order: 0, text: 'Větev mapy' }] }
    const withMap = projectForAi(cs, 'cs', { ...data, project: { ...project, mindMap } }, { question, includeNames: false })
    expect(withMap).toContain(cs('ai.export.mindMapHeading'))
    expect(withMap).toContain('  - Větev mapy')
    expect(withMap.indexOf('Větev mapy')).toBeLessThan(withMap.indexOf(question))
    const rootOnly = { nodes: [mindMap.nodes[0]!] }
    expect(projectForAi(cs, 'cs', { ...data, project: { ...project, mindMap: rootOnly } }, { question, includeNames: false })).not.toContain(cs('ai.export.mindMapHeading'))
  })

  it('anglická verze má anglické nadpisy', () => {
    const text = projectForAi(en, 'en', data, { question: en('ai.questions.risks.text'), includeNames: false })
    expect(text).toContain(en('ai.export.planHeading'))
    expect(text).not.toContain(cs('ai.export.planHeading'))
  })

  it('svislá čára v názvu nerozbije tabulku', () => {
    const tricky = { ...data, project: { ...project, tasks: project.tasks.map((t, i) => (i === 1 ? { ...t, name: 'A | B' } : t)) } }
    expect(projectForAi(cs, 'cs', tricky, { question: '', includeNames: false })).toContain('A \\| B')
  })

  it('všechny přednastavené otázky mají název i text v obou jazycích', () => {
    for (const t of [cs, en]) for (const q of AI_QUESTIONS) expect(t(`ai.questions.${q}.text`).length).toBeGreaterThan(20)
  })
})
