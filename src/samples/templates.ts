/**
 * Seznam šablon projektů pro okno „Nový projekt“ (U-02, fáze 10).
 * Novou šablonu přidáte: popis dat (TemplateDef) + texty v překladech + řádek v TEMPLATES
 * + popis karty v překladech newProject.templates.<id>. Testy (templates.test.ts) pak zkontrolují,
 * že je platná, spočitatelná a přeložená do všech jazyků.
 */
import { isoToDay } from '../engine/calendar'
import { schedule } from '../engine/schedule'
import { computeCosts } from '../model/costs'
import type { Project } from '../model/schema'
import { AUTOMATION_TEMPLATE } from './automatizace'
import { PRODUCT_DEVELOPMENT_TEMPLATE } from './productDevelopment'
import { PRODUCTION_LINE_TEMPLATE } from './productionLine'
import { INVESTMENT_TEMPLATE } from './investment'
import { SHUTDOWN_TEMPLATE } from './shutdown'
import { buildTemplate, type TemplateDef } from './template'

export const TEMPLATES = [
  { id: 'automation', def: AUTOMATION_TEMPLATE },
  { id: 'productDevelopment', def: PRODUCT_DEVELOPMENT_TEMPLATE },
  { id: 'productionLine', def: PRODUCTION_LINE_TEMPLATE },
  { id: 'investment', def: INVESTMENT_TEMPLATE },
  { id: 'shutdown', def: SHUTDOWN_TEMPLATE },
] as const satisfies readonly { id: string; def: TemplateDef }[]

export type TemplateId = (typeof TEMPLATES)[number]['id']

/** Nový projekt ze šablony k danému začátku (bez baseline a skutečnosti). */
export function createFromTemplate(id: TemplateId, translate: (key: string) => string, language: string, startDate: string): Project {
  const template = TEMPLATES.find((x) => x.id === id)!
  return buildTemplate(template.def, translate, language, startDate)
}

/** Název šablony = název projektu, který z ní vznikne. */
export function templateName(id: TemplateId, translate: (key: string) => string): string {
  return translate(`${TEMPLATES.find((x) => x.id === id)!.def.keyPrefix}.projectName`)
}

export interface TemplateSummary {
  /** Počet položek plánu (fáze, činnosti, milníky). */
  items: number
  /** Konec projektu "YYYY-MM-DD" (null = nejde spočítat). */
  finish: string | null
  /** Délka v měsících zaokrouhleně (kalendářní dny ÷ 30,4). */
  months: number
  /** Plánované náklady v haléřích (nejmenší jednotce měny projektu). */
  cost: number
  currency: string
}

/** Údaje na kartu šablony: velikost, délka a rozpočet. */
export function summarizeProject(project: Project): TemplateSummary {
  const scheduled = schedule(project)
  const finish = scheduled.projectFinish
  const days = finish ? isoToDay(finish) - isoToDay(project.startDate) + 1 : 0
  return {
    items: project.tasks.length,
    finish,
    months: Math.max(1, Math.round(days / 30.4)),
    cost: computeCosts(project, scheduled).project.total,
    currency: project.currency,
  }
}
