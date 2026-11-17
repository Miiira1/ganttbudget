/**
 * Texty pro chatovou AI (AI-01, AI-03, AI-04, fáze 11) – ČISTÉ FUNKCE s testy (aiPrompts.test.ts).
 *  - planPrompt: prompt na vytvoření plánu z popisu projektu (s popisem formátu „AI plán“ a příkladem),
 *  - fixPrompt: prompt na opravu odpovědi, která neprošla kontrolou (aiPlan.ts),
 *  - describeAiError: srozumitelný text chyby pro uživatele,
 *  - projectForAi: projekt jako Markdown s otázkou na konci.
 * Všechny texty jsou v překladech (ai.*); funkce dostanou překladovou funkci a jazyk.
 *
 * Soukromí: bez `includeNames` export neobsahuje jména pracovníků ani žádné sazby a mzdy –
 * pracovníci se uvádějí jen profesí. Do AI se nic neposílá samo, text jen zkopíruje uživatel.
 */
import type { ScheduleResult } from '../engine/schedule'
import { formatIsoDate } from '../i18n/format'
import type { AiPlanError } from './aiPlan'
import type { CostsResult } from './costs'
import { totalsByCategory, type BudgetStatus, type CostTimeline } from './costTimeline'
import type { EarnedValueResult } from './earnedValue'
import { wbsNumbers } from './hierarchy'
import type { LoadResult } from './load'
import { formatMoney } from './money'
import type { PlanIssue } from './planCheck'
import { mindMapToOutline } from './outline'
import { formatPredecessorsWith, rowNumbers, rowOrder } from './predecessors'
import { effectiveWorkerRate, professionRate, workingDaysInYear } from './rates'
import type { Project, Task, TaskLine } from './schema'
import { dayToIso } from '../engine/calendar'

/** Překladová funkce (t z i18next nebo náhrada v testech). */
export type Translate = (key: string, options?: Record<string, unknown>) => string

/** Přednastavené otázky k exportu projektu (texty v ai.questions.<id>). */
export const AI_QUESTIONS = ['risks', 'shorten', 'budget', 'criticalPath', 'status'] as const
export type AiQuestion = (typeof AI_QUESTIONS)[number]

/** Kolik znaků původní odpovědi se vloží do promptu na opravu. */
const MAX_ANSWER_IN_FIX = 100_000

// --- Prompt na vytvoření plánu ---------------------------------------------------------------

/** Příklad odpovědi ve formátu „AI plán“ (názvy v jazyce promptu), jedna položka na řádek. */
function exampleJson(t: Translate): string {
  const tasks = [
    { id: 'F1', name: t('ai.example.phase'), kind: 'phase', duration: 0 },
    { id: 'T1', name: t('ai.example.task1'), kind: 'task', parent: 'F1', duration: 10, costs: [{ name: t('ai.example.cost1'), amount: 40000, category: 'labor', when: 'perWeek' }] },
    { id: 'T2', name: t('ai.example.task2'), kind: 'task', parent: 'F1', duration: 5, dependsOn: [{ id: 'T1', type: 'FS', lag: 0 }], costs: [{ name: t('ai.example.cost2'), amount: 25000, category: 'services', when: 'end' }] },
    { id: 'M1', name: t('ai.example.milestone'), kind: 'milestone', parent: 'F1', duration: 0, dependsOn: [{ id: 'T2', type: 'FS', lag: 0 }] },
  ]
  return `{\n  "format": "miro-ai-plan",\n  "version": 1,\n  "tasks": [\n${tasks.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]\n}`
}

export interface PlanPromptSettings {
  description: string
  name: string
  startDate: string
  currency: string
}

export function planPrompt(t: Translate, language: string, s: PlanPromptSettings): string {
  return t('ai.planPrompt', {
    name: s.name.trim(),
    start: formatIsoDate(s.startDate, language),
    currency: s.currency,
    description: s.description.trim(),
    example: '```json\n' + exampleJson(t) + '\n```',
  })
}

// --- Chyby a prompt na opravu ----------------------------------------------------------------

export function describeAiError(t: Translate, e: AiPlanError): string {
  return t(`ai.errors.${e.code}`, { item: e.item ?? '?', id: e.taskId ?? '?', field: e.field ?? '?', other: e.other ?? '?', detail: e.detail ?? '' })
}

export function fixPrompt(t: Translate, errors: readonly AiPlanError[], answer: string): string {
  const list = errors.map((e) => `- ${describeAiError(t, e)}${e.detail && e.code !== 'cycle' ? ` (${e.detail})` : ''}`).join('\n')
  return t('ai.fixPrompt', {
    errors: list,
    answer: answer.length > MAX_ANSWER_IN_FIX ? answer.slice(0, MAX_ANSWER_IN_FIX) : answer,
    example: '```json\n' + exampleJson(t) + '\n```',
  })
}

// --- Projekt pro AI (Markdown) ---------------------------------------------------------------

export interface AiExportData {
  project: Project
  scheduled: ScheduleResult
  costs: CostsResult
  timeline: CostTimeline
  budget: BudgetStatus
  load: LoadResult
  issues: readonly PlanIssue[]
  /** Earned Value k datu stavu (null = projekt nemá baseline). */
  ev: EarnedValueResult | null
}

export interface AiExportOptions {
  /** Otázka na konec textu (prázdná = bez otázky). */
  question: string
  /** Zahrnout jména pracovníků a sazby (výchozí ne – soukromí). */
  includeNames: boolean
}

/** Text do buňky Markdown tabulky: bez svislých čar a zalomení řádků. */
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')

const table = (header: string[], rows: string[][]) =>
  [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n')

export function projectForAi(t: Translate, language: string, data: AiExportData, options: AiExportOptions): string {
  const { project, scheduled, costs } = data
  const money = (v: number) => formatMoney(v, project.currency, language)
  const date = (iso: string | null | undefined) => (iso ? formatIsoDate(iso, language) : '–')
  const index = (v: number | null) => (v === null ? '–' : new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v))
  const wbs = wbsNumbers(project)
  const numbers = rowNumbers(project)
  const tasks = new Map(project.tasks.map((x) => [x.id, x]))
  const professions = new Map(project.professions.map((p) => [p.id, p]))
  const workers = new Map(project.workers.map((w) => [w.id, w]))
  const machines = new Map(project.machines.map((m) => [m.id, m]))
  const materials = new Map(project.materials.map((m) => [m.id, m]))
  const fund = workingDaysInYear(project.calendar, Number(project.startDate.slice(0, 4)))
  const yesNo = (v: boolean) => t(v ? 'ai.export.yes' : 'ai.export.no')
  const out: string[] = []

  out.push(`# ${project.name}`, '', t('ai.export.intro', { currency: project.currency }), '')

  // Přehled
  const count = (kind: Task['kind']) => project.tasks.filter((x) => x.kind === kind).length
  const weekdays = project.calendar.workingWeekdays.map((d) => new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, d)))).join(', ')
  out.push(`## ${t('ai.export.overviewHeading')}`)
  out.push(`- ${t('ai.export.start')}: ${date(project.startDate)}`)
  out.push(`- ${t('ai.export.finish')}: ${date(scheduled.projectFinish)}`)
  out.push(`- ${t('ai.export.items', { phases: count('phase'), tasks: count('task'), milestones: count('milestone') })}`)
  const holidayText = project.calendar.useCzechHolidays ? t(`calendar.country.${project.calendar.holidayCountry ?? 'CZ'}`) : yesNo(false)
  out.push(`- ${t('ai.export.calendar', { weekdays, holidays: holidayText })}`)
  for (const h of project.calendar.customHolidays) out.push(`  - ${t('ai.export.shutdown', { name: h.name, from: date(h.start), to: date(h.end) })}`)
  out.push(`- ${t('ai.export.totalCost')}: ${money(costs.project.total)}`)
  if (data.budget.project) out.push(`- ${t('ai.export.limit')}: ${money(data.budget.project.limit)} (${Math.round((data.budget.project.spent / data.budget.project.limit) * 100)} %)`)
  out.push('')

  // Plán
  const resourceOf = (line: TaskLine): string => {
    switch (line.kind) {
      case 'labor': {
        const profession = professions.get(line.professionId)?.name ?? '?'
        const worker = line.workerId ? workers.get(line.workerId)?.name : undefined
        return `${options.includeNames && worker ? `${worker} (${profession})` : profession} ${line.sharePct} %`
      }
      case 'machine':
        return `${machines.get(line.machineId)?.name ?? '?'} ${line.sharePct} %`
      case 'material': {
        const m = materials.get(line.materialId)
        return `${m?.name ?? '?'} ${line.quantity} ${m?.unit ?? ''}`.trim()
      }
      default:
        return line.name
    }
  }
  out.push(`## ${t('ai.export.planHeading')}`, '')
  out.push(
    table(
      ['#', 'WBS', t('ai.export.col.name'), t('ai.export.col.kind'), t('ai.export.col.start'), t('ai.export.col.finish'), t('ai.export.col.duration'), t('ai.export.col.predecessors'), t('ai.export.col.slack'), t('ai.export.col.critical'), t('ai.export.col.percent'), t('ai.export.col.cost'), t('ai.export.col.resources')],
      rowOrder(project).map((task) => {
        const s = scheduled.tasks.get(task.id)
        const cost = costs.byTask.get(task.id)?.total.total ?? 0
        return [
          String(numbers.get(task.id) ?? ''),
          wbs.get(task.id) ?? '',
          task.name,
          t(`kind.${task.kind}`),
          date(s?.start),
          date(s?.finish),
          s?.durationDays === null || s?.durationDays === undefined ? '–' : String(s.durationDays),
          formatPredecessorsWith(numbers, task),
          s?.totalSlack === null || s?.totalSlack === undefined ? '–' : String(s.totalSlack),
          s?.critical ? t('ai.export.yes') : '',
          task.kind === 'phase' ? '' : `${task.percentComplete} %`,
          cost > 0 ? money(cost) : '',
          task.lines.map(resourceOf).join(', '),
        ]
      }),
    ),
    '',
  )

  // Rozpočet podle kategorií
  const byCategory = totalsByCategory(data.timeline)
  const limits = new Map(data.budget.categories.map((c) => [c.categoryId, c.limit]))
  out.push(`## ${t('ai.export.budgetHeading')}`, '')
  out.push(
    table(
      [t('ai.export.col.category'), t('ai.export.col.cost'), t('ai.export.col.limit')],
      project.costCategories.filter((c) => (byCategory.get(c.id) ?? 0) > 0 || limits.has(c.id)).map((c) => [c.name, money(byCategory.get(c.id) ?? 0), limits.has(c.id) ? money(limits.get(c.id)!) : '']),
    ),
    '',
  )

  // Zdroje: bez jmen jen profese a počty pracovníků; se jmény i sazby.
  if (project.professions.length > 0 || project.machines.length > 0) {
    out.push(`## ${t('ai.export.resourcesHeading')}`, '')
    if (options.includeNames) {
      const rate = (r: number | null) => (r === null ? '–' : `${money(r)}/h`)
      out.push(
        table(
          [t('ai.export.col.worker'), t('ai.export.col.profession'), t('ai.export.col.rate')],
          project.workers.map((w) => {
            const p = professions.get(w.professionId)
            return [w.name, p?.name ?? '?', p ? rate(effectiveWorkerRate(w, p, fund).rate) : '–']
          }),
        ),
        '',
        table(
          [t('ai.export.col.profession'), t('ai.export.col.rate')],
          project.professions.map((p) => [p.name, rate(professionRate(p, fund))]),
        ),
        '',
      )
      if (project.machines.length > 0) {
        out.push(table([t('ai.export.col.machine'), t('ai.export.col.rate')], project.machines.map((m) => [m.name, `${money(m.rate)}/${m.rateUnit === 'hour' ? 'h' : t('ai.export.day')}`])), '')
      }
    } else {
      out.push(
        table(
          [t('ai.export.col.profession'), t('ai.export.col.workers')],
          project.professions.map((p) => [p.name, String(project.workers.filter((w) => w.professionId === p.id).length)]),
        ),
        '',
      )
      if (project.machines.length > 0) out.push(`${t('ai.export.machines')}: ${project.machines.map((m) => m.name).join(', ')}`, '')
    }
  }

  // Varování kontroly plánu (přetížení bez jmen jen profesí).
  if (data.issues.length > 0) {
    const label = (id: string) => `${wbs.get(id) ?? ''} ${tasks.get(id)?.name ?? id}`.trim()
    const subject = (issue: PlanIssue): string => {
      switch (issue.kind) {
        case 'budgetOver':
          return `${issue.categoryId === null ? t('ai.export.project') : (project.costCategories.find((c) => c.id === issue.categoryId)?.name ?? issue.categoryId)} +${money(issue.over)}`
        case 'overload': {
          const worker = issue.resourceKind === 'worker' ? workers.get(issue.resourceId) : undefined
          const name = worker && !options.includeNames ? `${t('ai.export.worker')} (${professions.get(worker.professionId)?.name ?? '?'})` : issue.name
          return t('ai.export.overload', { name, days: issue.days, date: date(issue.firstDate) })
        }
        case 'leadBeforePredecessor':
          return `${label(issue.taskId)} (${issue.type}${issue.lagDays} → ${label(issue.predecessorId)})`
        case 'notStarted':
          return `${label(issue.taskId)} (${date(issue.start)})`
        default:
          return label(issue.taskId)
      }
    }
    out.push(`## ${t('ai.export.issuesHeading')}`, '')
    for (const issue of data.issues) out.push(`- ${t(`check.kinds.${issue.kind}`)}: ${subject(issue)}`)
    out.push('')
  }

  // Earned Value
  if (data.ev) {
    const baseline = project.baselines.find((b) => b.id === project.activeBaselineId)
    const x = data.ev.totals
    out.push(`## ${t('ai.export.trackingHeading')}`, '')
    out.push(`- ${t('ai.export.baseline')}: ${baseline?.name ?? '–'}`)
    out.push(`- ${t('ai.export.statusDate')}: ${date(dayToIso(data.ev.statusDay))}`)
    out.push(`- BAC ${money(x.bac)} · PV ${money(x.pv)} · EV ${money(x.ev)} · AC ${money(x.ac)}`)
    out.push(`- SPI ${index(x.spi)} · CPI ${index(x.cpi)} · EAC ${x.eac === null ? '–' : money(x.eac)} · VAC ${x.vac === null ? '–' : money(x.vac)}`)
    out.push('')
  }

  // Myšlenková mapa (fáze 12) jako odsazený text – jen když má aspoň jednu větev.
  if (project.mindMap && project.mindMap.nodes.length > 1) {
    out.push(`## ${t('ai.export.mindMapHeading')}`, '', '```', mindMapToOutline(project.mindMap).trimEnd(), '```', '')
  }

  const question = options.question.trim()
  if (question) out.push(`## ${t('ai.export.questionHeading')}`, '', question)
  return out.join('\n').trimEnd() + '\n'
}
