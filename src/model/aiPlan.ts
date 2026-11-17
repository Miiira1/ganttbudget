/**
 * Formát „AI plán“ (AI-02, AI-04, fáze 11): JSON, který vrací chatová AI na prompt aplikace,
 * a jeho převod na nový projekt. ČISTÁ FUNKCE s testy (aiPlan.test.ts).
 *
 * Formát (popsaný i v promptu):
 *   { "format": "miro-ai-plan", "version": 1, "tasks": [
 *       { "id", "name", "kind": "phase|task|milestone", "parent"?, "duration",
 *         "dependsOn"?: [{ "id", "type"?: "FS|SS|FF|SF", "lag"? }],
 *         "costs"?: [{ "name", "amount" (v měně projektu), "category", "when": "start|end|perDay|perWeek|perMonth" }] } ] }
 *
 * Bezpečnost (N-10): text nejvýš MAX_AI_TEXT znaků, jen JSON.parse (nikdy eval), schéma Zod a kontroly
 * vazeb a stromu. Při jakékoli chybě se nevytvoří nic – žádné částečné použití.
 * ID z odpovědi AI se do projektu nepřenášejí; položky dostanou nová ID.
 */
import { z } from 'zod'
import { schedule } from '../engine/schedule'
import { DEFAULT_CATEGORY_KEYS, defaultCategoryId } from './defaultCategories'
import { createEmptyProject, createTask, MAX_TREE_DEPTH, ProjectSchema, type Project, type Task, type TaskLine } from './schema'

/** Nejvíc znaků vložené odpovědi (500 kB). */
export const MAX_AI_TEXT = 500_000
/** Nejvíc položek plánu z AI (stejně jako cílová velikost projektu, kap. 2). */
export const MAX_AI_TASKS = 300

const DependencySchema = z.object({
  id: z.string().trim().min(1).max(100),
  type: z.enum(['FS', 'SS', 'FF', 'SF']).default('FS'),
  lag: z.number().int().min(-1000).max(1000).default(0),
})

const CostSchema = z.object({
  name: z.string().trim().min(1).max(200),
  amount: z.number().min(0).max(10_000_000_000),
  category: z.enum(DEFAULT_CATEGORY_KEYS),
  when: z.enum(['start', 'end', 'perDay', 'perWeek', 'perMonth']),
})

const TaskSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(['phase', 'task', 'milestone']),
  parent: z.string().trim().max(100).nullable().optional(),
  duration: z.number().int().min(0).max(10_000).default(0),
  dependsOn: z.array(DependencySchema).max(50).default([]),
  costs: z.array(CostSchema).max(50).default([]),
})

export const AiPlanSchema = z.object({
  format: z.literal('miro-ai-plan').optional(),
  version: z.literal(1).optional(),
  tasks: z.array(z.unknown()),
})

export type AiPlanTask = z.infer<typeof TaskSchema>

export type AiPlanErrorCode =
  | 'tooLarge'
  | 'noJson'
  | 'invalidJson'
  | 'notPlan'
  | 'noTasks'
  | 'tooManyTasks'
  | 'missingField'
  | 'invalidField'
  | 'duplicateId'
  | 'unknownParent'
  | 'parentNotPhase'
  | 'parentCycle'
  | 'tooDeep'
  | 'unknownPredecessor'
  | 'selfDependency'
  | 'phaseDependency'
  | 'duplicateDependency'
  | 'milestoneRecurring'
  | 'cycle'
  | 'invalidResult'

export interface AiPlanError {
  code: AiPlanErrorCode
  /** Pořadí položky v odpovědi (od 1). */
  item?: number
  /** ID položky z odpovědi AI. */
  taskId?: string
  /** Pole, které je špatně (např. "duration", "dependsOn.0.type"). */
  field?: string
  /** Druhé ID (předchůdce, rodič). */
  other?: string
  /** Technický detail – jen do promptu na opravu, uživateli se neukazuje. */
  detail?: string
}

export interface AiPlanWarning {
  code: 'milestoneDuration'
  item: number
  taskId: string
}

export type AiPlanResult = { ok: true; project: Project; warnings: AiPlanWarning[] } | { ok: false; errors: AiPlanError[] }

export interface AiPlanSettings {
  name: string
  startDate: string
  currency: string
  language: string
}

/** Nejvíc chyb najednou (zbytek by jen zahltil okno i prompt na opravu). */
const MAX_ERRORS = 20

type Extracted = { ok: true; value: unknown } | { ok: false; code: 'noJson' | 'invalidJson'; detail?: string }

/** Vytáhne JSON z odpovědi AI: blok ```json, jinak od první „{“ po poslední „}“. */
export function extractJson(text: string): Extracted {
  const candidates: string[] = []
  for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) candidates.push(match[1]!.trim())
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1))
  if (candidates.length === 0) return { ok: false, code: 'noJson' }
  let detail = ''
  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) as unknown }
    } catch (error) {
      detail ||= error instanceof Error ? error.message : String(error)
    }
  }
  return { ok: false, code: 'invalidJson', detail }
}

/** Hodnota v datech podle cesty z chyby Zod (aby šlo rozlišit „chybí“ a „je špatně“). */
function valueAt(data: unknown, path: readonly PropertyKey[]): unknown {
  return path.reduce<unknown>((node, key) => (node !== null && typeof node === 'object' ? (node as Record<PropertyKey, unknown>)[key] : undefined), data)
}

/** Ověří a převede odpověď AI na nový projekt. `newId` vyrábí jedinečná ID. */
export function parseAiPlan(text: string, settings: AiPlanSettings, newId: () => string): AiPlanResult {
  const fail = (errors: AiPlanError[]): AiPlanResult => ({ ok: false, errors: errors.slice(0, MAX_ERRORS) })
  if (text.length > MAX_AI_TEXT) return fail([{ code: 'tooLarge' }])

  const extracted = extractJson(text)
  if (!extracted.ok) return fail([{ code: extracted.code, ...(extracted.detail ? { detail: extracted.detail } : {}) }])

  const outer = AiPlanSchema.safeParse(extracted.value)
  if (!outer.success) return fail([{ code: 'notPlan', detail: outer.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }])
  const rawTasks = outer.data.tasks
  if (rawTasks.length === 0) return fail([{ code: 'noTasks' }])
  if (rawTasks.length > MAX_AI_TASKS) return fail([{ code: 'tooManyTasks', detail: String(rawTasks.length) }])

  // 1) Každá položka zvlášť podle schématu.
  const errors: AiPlanError[] = []
  const tasks: AiPlanTask[] = []
  rawTasks.forEach((raw, index) => {
    const parsed = TaskSchema.safeParse(raw)
    if (parsed.success) {
      tasks.push(parsed.data)
      return
    }
    const rawId = valueAt(raw, ['id'])
    for (const issue of parsed.error.issues) {
      errors.push({
        code: valueAt(raw, issue.path) === undefined ? 'missingField' : 'invalidField',
        item: index + 1,
        ...(typeof rawId === 'string' ? { taskId: rawId } : {}),
        field: issue.path.map(String).join('.'),
        detail: issue.message,
      })
    }
  })
  if (errors.length > 0) return fail(errors)

  // 2) ID, strom a vazby.
  const byId = new Map<string, { task: AiPlanTask; item: number }>()
  tasks.forEach((task, index) => {
    if (byId.has(task.id)) errors.push({ code: 'duplicateId', item: index + 1, taskId: task.id })
    else byId.set(task.id, { task, item: index + 1 })
  })
  tasks.forEach((task, index) => {
    const item = index + 1
    const parentId = task.parent ?? null
    if (parentId !== null && parentId !== '') {
      const parent = byId.get(parentId)
      if (!parent) errors.push({ code: 'unknownParent', item, taskId: task.id, other: parentId })
      else if (parent.task.kind !== 'phase') errors.push({ code: 'parentNotPhase', item, taskId: task.id, other: parentId })
    }
    const seen = new Set<string>()
    for (const dep of task.dependsOn) {
      const predecessor = byId.get(dep.id)
      if (dep.id === task.id) errors.push({ code: 'selfDependency', item, taskId: task.id })
      else if (!predecessor) errors.push({ code: 'unknownPredecessor', item, taskId: task.id, other: dep.id })
      else if (task.kind === 'phase' || predecessor.task.kind === 'phase') errors.push({ code: 'phaseDependency', item, taskId: task.id, other: dep.id })
      else if (seen.has(dep.id)) errors.push({ code: 'duplicateDependency', item, taskId: task.id, other: dep.id })
      seen.add(dep.id)
    }
    if (task.kind === 'milestone' && task.costs.some((c) => c.when !== 'start' && c.when !== 'end')) errors.push({ code: 'milestoneRecurring', item, taskId: task.id })
  })
  if (errors.length > 0) return fail(errors)

  // Kruh v rodičích a hloubka stromu (stačí jedna chyba).
  const parentOf = (id: string) => {
    const p = byId.get(id)!.task.parent
    return p ? p : null
  }
  for (const [id, { item }] of byId) {
    let depth = 0
    let current: string | null = id
    while (current !== null && depth <= byId.size) {
      current = parentOf(current)
      depth++
    }
    if (current !== null) return fail([{ code: 'parentCycle', item, taskId: id }])
    if (depth > MAX_TREE_DEPTH) return fail([{ code: 'tooDeep', item, taskId: id }])
  }

  // 3) Převod na projekt.
  const warnings: AiPlanWarning[] = []
  const project = createEmptyProject({ name: settings.name, language: settings.language, startDate: settings.startDate })
  project.currency = settings.currency
  const newIds = new Map(tasks.map((t) => [t.id, newId()]))
  const order = new Map<string | null, number>()
  project.tasks = tasks.map((task, index): Task => {
    const parentId = task.parent ? newIds.get(task.parent)! : null
    const position = order.get(parentId) ?? 0
    order.set(parentId, position + 1)
    if (task.kind === 'milestone' && task.duration > 0) warnings.push({ code: 'milestoneDuration', item: index + 1, taskId: task.id })
    const id = newIds.get(task.id)!
    const lines = task.costs.map((cost): TaskLine => {
      const base = { id: newId(), categoryId: defaultCategoryId(cost.category), name: cost.name, amount: Math.round(cost.amount * 100) }
      if (cost.when === 'start' || cost.when === 'end') return { ...base, kind: 'oneTime', timing: cost.when }
      return { ...base, kind: 'recurring', period: cost.when === 'perDay' ? 'day' : cost.when === 'perWeek' ? 'week' : 'month' }
    })
    return {
      ...createTask({ id, name: task.name, order: position, kind: task.kind, durationDays: task.kind === 'phase' ? 0 : task.duration }),
      parentId,
      dependencies: task.dependsOn.map((d) => ({ predecessorId: newIds.get(d.id)!, type: d.type, lagDays: d.lag })),
      lines,
    }
  })

  // Kruh ve vazbách pozná plánovací jádro.
  const cycle = schedule(project).cycleTaskIds
  if (cycle.size > 0) {
    const aiIdOf = new Map([...newIds].map(([ai, real]) => [real, ai]))
    const first = tasks.findIndex((t) => cycle.has(newIds.get(t.id)!))
    return fail([{ code: 'cycle', item: first + 1, taskId: tasks[first]!.id, detail: [...cycle].map((id) => aiIdOf.get(id)).join(', ') }])
  }

  // Poslední pojistka: výsledek musí projít stejnou kontrolou jako soubor projektu.
  const check = ProjectSchema.safeParse(project)
  if (!check.success) return fail([{ code: 'invalidResult', detail: check.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }])
  return { ok: true, project: check.data, warnings }
}
