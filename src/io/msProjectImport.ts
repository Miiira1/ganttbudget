/**
 * Import plánu z MS Project – soubor XML („Uložit jako → XML“) (I-06, fáze 13b). ČISTÁ FUNKCE s testy.
 *
 * Přenese se jen plán: úkoly → strom (OutlineLevel), souhrnné úkoly → fáze, milníky, délka v pracovních
 * dnech (Duration ÷ MinutesPerDay), % hotovo, poznámky, omezení „začít nejdříve / musí začít“ → 📌,
 * vazby (Type 0 = FF, 1 = FS, 2 = SF, 3 = SS) s prodlevou (LinkLag je v desetinách minuty) a začátek
 * projektu. Zdroje a náklady se nepřenášejí. Vazby se souhrnnými úkoly (u nás fáze vazby nemají)
 * se vynechají a ohlásí jako upozornění. Výsledek nahradí činnosti jako import tabulky (I-03) –
 * činnosti se stejným WBS, názvem a druhem si ponechají ID i skutečné náklady (keepIdentity).
 */
import { schedule } from '../engine/schedule'
import { isValidIsoDate } from '../model/dates'
import { createTask, MAX_TREE_DEPTH, ProjectSchema, type DependencyType, type Project, type Task, type TaskKind } from '../model/schema'
import { keepIdentity, MAX_IMPORT_ROWS, type ImportResult, type ImportWarning } from './tableImport'
import { childElement, childElements, childText, parseXml, type XmlElement } from './xml'

const LINK_TYPES: Record<string, DependencyType> = { '0': 'FF', '1': 'FS', '2': 'SF', '3': 'SS' }
/** Formáty prodlevy v procentech (z délky předchůdce) – u nás nejdou, prodleva se vynechá. */
const PERCENT_LAG_FORMATS = new Set(['19', '20'])

/** Délka ve formátu ISO 8601 (např. PT40H0M0S, P2DT4H) → minuty pracovní doby. */
function durationMinutes(text: string, minutesPerDay: number): number {
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(text.trim())
  if (!m) return 0
  const [, d, h, min, s] = m
  return Number(d ?? 0) * minutesPerDay + Number(h ?? 0) * 60 + Number(min ?? 0) + Number(s ?? 0) / 60
}

const isoDay = (text: string) => {
  const day = text.trim().slice(0, 10)
  return isValidIsoDate(day) ? day : null
}

export function importMsProject(text: string, base: Project, makeId: () => string): ImportResult {
  const fail = (code: string, row = 1): ImportResult => ({ ok: false, errors: [{ row, code: `msp.${code}` }] })
  let root: XmlElement
  try {
    root = parseXml(text)
  } catch {
    return fail('invalidXml')
  }
  if (root.name !== 'Project' || !childElement(root, 'Tasks')) return fail('notMsProject')

  const minutesPerDay = Number(childText(root, 'MinutesPerDay')) || 480
  const startDate = isoDay(childText(root, 'StartDate')) ?? base.startDate
  const source = childElements(childElement(root, 'Tasks')!, 'Task').filter(
    (t) => Number(childText(t, 'OutlineLevel')) >= 1 && childText(t, 'Name').trim() !== '' && childText(t, 'IsNull') !== '1',
  )
  if (source.length === 0) return fail('noTasks')
  if (source.length > MAX_IMPORT_ROWS) return fail('tooMany')

  // 1) Úkoly a strom.
  const tasks: Task[] = []
  const byUid = new Map<string, Task>()
  const parents: (Task | null)[] = [null] // parents[úroveň - 1] = rodič pro danou úroveň
  const orderUnder = new Map<string | null, number>()
  let previousLevel = 0
  for (const el of source) {
    const row = Number(childText(el, 'ID')) || tasks.length + 1
    // Přeskočená úroveň se srovná (úroveň nejvýš o 1 hlouběji než předchozí úkol).
    const level = Math.min(Number(childText(el, 'OutlineLevel')), previousLevel + 1)
    if (level > MAX_TREE_DEPTH) return fail('tooDeep', row)
    const parent = parents[level - 1] ?? null
    if (parent && parent.kind !== 'phase') parent.kind = 'phase' // úkol s podřízenými je u nás fáze
    const kind: TaskKind = childText(el, 'Summary') === '1' ? 'phase' : childText(el, 'Milestone') === '1' ? 'milestone' : 'task'
    const parentId = parent?.id ?? null
    const order = orderUnder.get(parentId) ?? 0
    orderUnder.set(parentId, order + 1)
    const minutes = durationMinutes(childText(el, 'Duration'), minutesPerDay)
    const constraintType = childText(el, 'ConstraintType')
    const constraint = constraintType === '2' || constraintType === '4' ? isoDay(childText(el, 'ConstraintDate')) : null
    const task: Task = {
      ...createTask({ id: makeId(), name: childText(el, 'Name').trim().slice(0, 200), order, kind, durationDays: kind === 'task' ? Math.round(minutes / minutesPerDay) : 0 }),
      parentId,
      percentComplete: Math.max(0, Math.min(100, Math.round(Number(childText(el, 'PercentComplete')) || 0))),
      notes: childText(el, 'Notes').slice(0, 5000),
      ...(constraint && kind !== 'phase' ? { constraintStart: constraint } : {}),
    }
    tasks.push(task)
    byUid.set(childText(el, 'UID'), task)
    parents[level] = task
    parents.length = level + 1
    previousLevel = level
  }
  // Fáze nemají délku ani omezení (spočítají se z podřízených).
  for (const t of tasks) {
    if (t.kind !== 'phase') continue
    t.durationDays = 0
    delete t.constraintStart
  }

  // 2) Vazby.
  const counts = { summaryLink: 0, unknownLink: 0, percentLag: 0 }
  source.forEach((el, index) => {
    const task = tasks[index]!
    const seen = new Set<string>()
    for (const link of childElements(el, 'PredecessorLink')) {
      const predecessor = byUid.get(childText(link, 'PredecessorUID'))
      if (!predecessor || predecessor === task) {
        counts.unknownLink++
        continue
      }
      if (predecessor.kind === 'phase' || task.kind === 'phase') {
        counts.summaryLink++
        continue
      }
      if (seen.has(predecessor.id)) continue
      seen.add(predecessor.id)
      let lagDays = Math.round((Number(childText(link, 'LinkLag')) || 0) / 10 / minutesPerDay)
      if (PERCENT_LAG_FORMATS.has(childText(link, 'LagFormat'))) {
        counts.percentLag++
        lagDays = 0
      }
      task.dependencies.push({
        predecessorId: predecessor.id,
        type: LINK_TYPES[childText(link, 'Type')] ?? 'FS',
        lagDays: Math.max(-1000, Math.min(1000, lagDays)),
      })
    }
  })

  // 3) Celý projekt: ponechat identitu shodných činností, zkontrolovat kruhy a schéma.
  const { tasks: kept } = keepIdentity(base, tasks)
  const candidate: Project = { ...base, startDate, tasks: kept }
  if (schedule(candidate).cycleTaskIds.size > 0) return fail('cycle')
  const result = ProjectSchema.safeParse(candidate)
  if (!result.success) return fail('invalid')
  const warnings: ImportWarning[] = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([code, count]) => ({ code, count }))
  return { ok: true, project: result.data, warnings }
}
