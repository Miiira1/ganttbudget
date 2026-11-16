/**
 * Export rozpočtu (fáze 7, I-04) – čisté funkce, testy v budgetExport.test.ts.
 *
 * 1) Řádky: jeden řádek tabulky = jeden řádek činnosti (zdroj nebo náklad). Sloupce:
 *    WBS, Činnost, Typ, Zdroj / Název, Pracovník, Podíl % / Množství, Částka / Cena, Kdy / Období,
 *    Datum, Kategorie, Štítky, Poznámka, h/den, Sazba, Hodiny, Náklad. Poslední čtyři jsou vypočtené
 *    (aby bylo vidět, jak náklad vznikl: h/den × dny × sazba) – import je ignoruje. Peníze v celých jednotkách měny (Kč) s haléři jako desetinná místa.
 * 2) Náběh: kategorie × období (náklady za období), součty, celkem a kumulativně.
 * Ochranu proti CSV injection přidá toCsv / xlsxExport (protectText).
 */
import { createResourceLookup, lineHoursPerDay, type CostsResult } from '../model/costs'
import { effectiveWorkerRate, professionRate, workingDaysInYear } from '../model/rates'
import { cumulative, summarizeCosts, type CostTimeline } from '../model/costTimeline'
import { treeOrder, wbsNumbers } from '../model/hierarchy'
import type { DayRange } from '../model/periods'
import type { Project, TaskLine } from '../model/schema'
import type { Cell } from './tableExport'

export const BUDGET_COLUMNS = ['wbs', 'task', 'kind', 'resource', 'worker', 'quantity', 'amount', 'timing', 'date', 'category', 'tags', 'note', 'hoursPerDay', 'rate', 'hours', 'cost'] as const
export type BudgetColumn = (typeof BUDGET_COLUMNS)[number]
/** Vypočtené sloupce – v XLSX šedé s poznámkou „vypočteno“, import je ignoruje. */
export const BUDGET_COMPUTED_COLUMNS: readonly BudgetColumn[] = ['hoursPerDay', 'rate', 'hours', 'cost']
/** Sloupce s penězi (v XLSX formát s haléři). */
export const BUDGET_MONEY_COLUMNS: readonly BudgetColumn[] = ['amount', 'rate', 'cost']
/** Sloupce s datem (v XLSX opravdové datum). */
export const BUDGET_DATE_COLUMNS: readonly BudgetColumn[] = ['date']

/** Načasování v exportu: jednorázový (začátek / konec / datum) a průběžný (den / týden / měsíc). */
export type BudgetTiming = 'start' | 'end' | 'date' | 'day' | 'week' | 'month'

export interface BudgetLabels {
  kind: (kind: TaskLine['kind']) => string
  timing: (timing: BudgetTiming) => string
  /** Popisky souhrnných řádků listu Náběh. */
  total: string
  cumulative: string
  /** Popisek sloupce období. */
  period: (period: DayRange) => string
}

/** Haléře → Kč (číslo se dvěma desetinnými místy). */
const toUnits = (minor: number) => Math.round(minor) / 100
const round2 = (x: number) => Math.round(x * 100) / 100

export function buildBudgetLines(project: Project, costs: CostsResult, labels: BudgetLabels): { columns: readonly BudgetColumn[]; rows: Cell[][] } {
  const wbs = wbsNumbers(project)
  const name = <T extends { id: string; name: string }>(list: T[], id: string | undefined) => (id ? (list.find((x) => x.id === id)?.name ?? '') : '')
  const rows: Cell[][] = []
  // Sazby stejně jako costs.ts (fond pracovních dnů roku začátku projektu).
  const fundDays = workingDaysInYear(project.calendar, Number(project.startDate.slice(0, 4)))
  const lookup = createResourceLookup(project)
  const rateOf = (line: TaskLine): number | null => {
    if (line.kind === 'labor') {
      const profession = lookup.professions.get(line.professionId)
      const worker = line.workerId ? lookup.workers.get(line.workerId) : undefined
      if (!profession) return null
      return worker ? effectiveWorkerRate(worker, profession, fundDays).rate : professionRate(profession, fundDays)
    }
    if (line.kind === 'machine') {
      const machine = lookup.machines.get(line.machineId)
      return machine && machine.rateUnit === 'hour' ? machine.rate : null // denní sazba se do Kč/h nepřevádí
    }
    return null
  }
  for (const task of treeOrder(project)) {
    for (const line of task.lines) {
      const cost = costs.lines.get(line.id)
      const values: Record<BudgetColumn, Cell> = {
        wbs: wbs.get(task.id) ?? '',
        task: task.name,
        kind: labels.kind(line.kind),
        resource: '',
        worker: null,
        quantity: null,
        amount: null,
        timing: null,
        date: null,
        category: name(project.costCategories, line.categoryId),
        tags: (line.tags ?? []).join(', '),
        note: line.note ?? '',
        hoursPerDay: (() => {
          const h = lineHoursPerDay(line, lookup)
          return h === null ? null : round2(h)
        })(),
        rate: (() => {
          const r = rateOf(line)
          return r === null ? null : toUnits(r)
        })(),
        hours: cost?.hours != null ? round2(cost.hours) : null,
        cost: cost ? toUnits(cost.amount) : null,
      }
      switch (line.kind) {
        case 'labor':
          values.resource = name(project.professions, line.professionId)
          values.worker = line.workerId ? name(project.workers, line.workerId) : null
          values.quantity = line.sharePct
          break
        case 'machine':
          values.resource = name(project.machines, line.machineId)
          values.quantity = line.sharePct
          break
        case 'material':
          values.resource = name(project.materials, line.materialId)
          values.quantity = line.quantity
          values.amount = line.unitPriceOverride !== undefined ? toUnits(line.unitPriceOverride) : null
          break
        case 'oneTime':
          values.resource = line.name
          values.amount = toUnits(line.amount)
          values.timing = labels.timing(line.timing)
          values.date = line.timing === 'date' ? (line.date ?? null) : null
          break
        case 'recurring':
          values.resource = line.name
          values.amount = toUnits(line.amount)
          values.timing = labels.timing(line.period)
          break
      }
      rows.push(BUDGET_COLUMNS.map((c) => values[c]))
    }
  }
  return { columns: BUDGET_COLUMNS, rows }
}

/** List Náběh: kategorie (jen s nákladem, v pořadí databáze) × období + Celkem; dole celkem a kumulativně. */
export function buildBudgetPhasing(project: Project, timeline: CostTimeline, periods: readonly DayRange[], labels: BudgetLabels): { headers: string[]; rows: Cell[][] } {
  const summary = summarizeCosts(project, timeline, periods, { groupBy: 'category' })
  const headers = ['', ...periods.map(labels.period), labels.total]
  const rows: Cell[][] = summary.rows
    .filter((r) => r.total !== 0)
    .map((r) => [project.costCategories.find((c) => c.id === r.key)?.name ?? r.key, ...r.values.map(toUnits), toUnits(r.total)])
  rows.push([labels.total, ...summary.totals.map(toUnits), toUnits(summary.grandTotal)])
  rows.push([labels.cumulative, ...cumulative(summary.totals).map(toUnits), null])
  return { headers, rows }
}
