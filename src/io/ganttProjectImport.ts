/**
 * Import plánu z GanttProject – soubor .gan (XML) (I-06, fáze 13b). ČISTÁ FUNKCE s testy.
 *
 * Přenese se jen plán: vnořené <task> → strom (úkol s podřízenými = fáze), meeting="true" → milník,
 * duration (pracovní dny), complete (% hotovo), <notes>, vazby a začátek projektu (nejdřívější úkol).
 * Vazba je v GanttProject uložená u předchůdce: <depend id="následník" type="…" difference="…">;
 * typy 1 = SS, 2 = FS, 3 = FF, 4 = SF, difference = prodleva ve dnech. Vazby s fázemi (u nás je fáze
 * mít nesmějí) se vynechají s upozorněním. Úkol bez předchůdce, který začíná později než projekt,
 * dostane omezení „začít nejdříve“ (📌), aby zůstal na svém místě. Zdroje a náklady se nepřenášejí.
 * Výsledek nahradí činnosti jako import tabulky (I-03), shodné činnosti si ponechají ID (keepIdentity).
 */
import { schedule } from '../engine/schedule'
import { isValidIsoDate } from '../model/dates'
import { createTask, MAX_TREE_DEPTH, ProjectSchema, type DependencyType, type Project, type Task } from '../model/schema'
import { keepIdentity, MAX_IMPORT_ROWS, type ImportResult, type ImportWarning } from './tableImport'
import { childElement, childElements, childText, parseXml, type XmlElement } from './xml'

const LINK_TYPES: Record<string, DependencyType> = { '1': 'SS', '2': 'FS', '3': 'FF', '4': 'SF' }

const isoDay = (text: string | undefined) => {
  const day = (text ?? '').trim().slice(0, 10)
  return isValidIsoDate(day) ? day : null
}

export function importGanttProject(text: string, base: Project, makeId: () => string): ImportResult {
  const fail = (code: string, row = 1): ImportResult => ({ ok: false, errors: [{ row, code: `gan.${code}` }] })
  let root: XmlElement
  try {
    root = parseXml(text)
  } catch {
    return fail('invalidXml')
  }
  const tasksEl = childElement(root, 'tasks')
  if (root.name !== 'project' || !tasksEl) return fail('notGanttProject')

  // 1) Úkoly do hloubky – strom podle vnoření.
  const tasks: Task[] = []
  const byGanId = new Map<string, Task>()
  const starts = new Map<Task, string | null>()
  const links: { from: string; el: XmlElement }[] = []
  let tooDeepRow = 0
  const walk = (el: XmlElement, parent: Task | null, depth: number) => {
    childElements(el, 'task').forEach((child, order) => {
      const ganId = child.attrs.id ?? ''
      if (depth >= MAX_TREE_DEPTH) {
        tooDeepRow ||= tasks.length + 1
        return
      }
      const hasChildren = childElements(child, 'task').length > 0
      const kind = hasChildren ? 'phase' : child.attrs.meeting === 'true' ? 'milestone' : 'task'
      const task: Task = {
        ...createTask({ id: makeId(), name: (child.attrs.name ?? '').trim().slice(0, 200) || '…', order, kind, durationDays: kind === 'task' ? Math.max(0, Math.round(Number(child.attrs.duration) || 0)) : 0 }),
        parentId: parent?.id ?? null,
        percentComplete: Math.max(0, Math.min(100, Math.round(Number(child.attrs.complete) || 0))),
        notes: childText(child, 'notes').slice(0, 5000),
      }
      tasks.push(task)
      byGanId.set(ganId, task)
      starts.set(task, isoDay(child.attrs.start))
      for (const link of childElements(child, 'depend')) links.push({ from: ganId, el: link })
      walk(child, task, depth + 1)
    })
  }
  walk(tasksEl, null, 0)
  if (tooDeepRow) return fail('tooDeep', tooDeepRow)
  if (tasks.length === 0) return fail('noTasks')
  if (tasks.length > MAX_IMPORT_ROWS) return fail('tooMany')

  // 2) Vazby (u předchůdce, míří na následníka).
  const counts = { summaryLink: 0, unknownLink: 0 }
  for (const { from, el } of links) {
    const predecessor = byGanId.get(from)
    const successor = byGanId.get(el.attrs.id ?? '')
    if (!predecessor || !successor || predecessor === successor) {
      counts.unknownLink++
      continue
    }
    if (predecessor.kind === 'phase' || successor.kind === 'phase') {
      counts.summaryLink++
      continue
    }
    if (successor.dependencies.some((d) => d.predecessorId === predecessor.id)) continue
    successor.dependencies.push({
      predecessorId: predecessor.id,
      type: LINK_TYPES[el.attrs.type ?? ''] ?? 'FS',
      lagDays: Math.max(-1000, Math.min(1000, Math.round(Number(el.attrs.difference) || 0))),
    })
  }

  // 3) Začátek projektu = nejdřívější úkol; pozdější začátek bez předchůdce → 📌.
  const days = [...starts.values()].filter((d): d is string => d !== null).sort()
  const startDate = days[0] ?? base.startDate
  for (const task of tasks) {
    const start = starts.get(task)
    if (task.kind !== 'phase' && task.dependencies.length === 0 && start && start > startDate) task.constraintStart = start
  }

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
