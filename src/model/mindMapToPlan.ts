/**
 * Vytvořit plán z myšlenkové mapy (fáze 12, MM-02) – ČISTÁ FUNKCE s testy (mindMapToPlan.test.ts).
 *
 * Hierarchie mapy se stane hierarchií plánu: podřízení středního tématu = nejvyšší úroveň plánu,
 * uzel s podřízenými = fáze, list = činnost s délkou MIND_MAP_TASK_DAYS pracovních dnů bez vazeb
 * (délky a vazby doplní uživatel; Kontrola plánu ho na chybějící vazby upozorní). Střední téma se
 * nepřevádí, sbalené větve se převádějí také. Mapa v projektu zůstane beze změny.
 *
 * Režim 'append' přidá položky za stávající plán, 'replace' plán nahradí – řádky nákladů a skutečné
 * náklady nahrazených položek zmizí (souhrn je spočítá, aby je okno mohlo předem ohlásit).
 * Výsledek se ověří stejnou kontrolou jako soubor projektu.
 */
import { childrenOf, rootOf } from './mindMap'
import { createTask, ProjectSchema, type MindMap, type Project, type Task } from './schema'

/** Délka činnosti vzniklé z mapy (pracovní dny). */
export const MIND_MAP_TASK_DAYS = 5

export type PlanFromMapMode = 'append' | 'replace'

export interface PlanFromMapSummary {
  phases: number
  tasks: number
  /** Jen u 'replace': co z dosavadního plánu zmizí. */
  removedTasks: number
  removedLines: number
  removedActuals: number
}

export type PlanFromMapResult = { ok: true; project: Project; summary: PlanFromMapSummary } | { ok: false; reason: 'emptyMap' | 'invalid' }

export function planFromMindMap(project: Project, map: MindMap, mode: PlanFromMapMode, newId: () => string): PlanFromMapResult {
  const root = rootOf(map)
  const topLevel = childrenOf(map, root.id)
  if (topLevel.length === 0) return { ok: false, reason: 'emptyMap' }

  const kept = mode === 'append' ? project.tasks : []
  // Nové položky nejvyšší úrovně až za stávající.
  let nextTopOrder = kept.filter((t) => t.parentId === null).reduce((max, t) => Math.max(max, t.order + 1), 0)
  const created: Task[] = []
  let phases = 0
  let tasks = 0

  const convert = (nodeId: string, text: string, parentId: string | null, order: number) => {
    const children = childrenOf(map, nodeId)
    const id = newId()
    if (children.length > 0) {
      phases++
      created.push({ ...createTask({ id, name: text, order, kind: 'phase' }), parentId })
      children.forEach((child, index) => convert(child.id, child.text, id, index))
    } else {
      tasks++
      created.push({ ...createTask({ id, name: text, order, kind: 'task', durationDays: MIND_MAP_TASK_DAYS }), parentId })
    }
  }
  for (const node of topLevel) convert(node.id, node.text, null, nextTopOrder++)

  const removed = mode === 'replace' ? project.tasks : []
  const summary: PlanFromMapSummary = {
    phases,
    tasks,
    removedTasks: removed.length,
    removedLines: removed.reduce((sum, t) => sum + t.lines.length, 0),
    removedActuals: removed.reduce((sum, t) => sum + (t.actuals?.length ?? 0), 0),
  }
  const next: Project = { ...project, tasks: [...kept, ...created] }
  const check = ProjectSchema.safeParse(next)
  if (!check.success) return { ok: false, reason: 'invalid' }
  // Vrací se původní objekt (ne výstup kontroly), aby mapa zůstala tatáž (beze změny).
  return { ok: true, project: next, summary }
}
