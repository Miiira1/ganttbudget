/**
 * Celý projekt v jednom sešitu Excelu (doplněk po fázi 7) – čisté funkce, testy v workbookExport.test.ts.
 *
 * Listy: Projekt, Kalendář, Činnosti, Řádky, Kategorie, Střediska, Profese, Pracovníci,
 * Nepřítomnosti, Stroje, Materiály, Náběh. Listy se propojují názvy (profese, pracovník, kategorie…)
 * a čísly / WBS činností – názvy jsou v projektu jedinečné. Vypočtené sloupce (termíny, sazby,
 * hodiny, náklady, celý list Náběh) jsou jen pro kontrolu; import je ignoruje a spočítá znovu.
 * Peníze v celých jednotkách měny (Kč) s haléři jako desetinná místa.
 */
import type { ScheduleResult } from '../engine/schedule'
import { absenceWorkingDays } from '../model/catalogs'
import { totalsByCategory, type CostTimeline } from '../model/costTimeline'
import type { CostsResult } from '../model/costs'
import { splitPeriods } from '../model/periods'
import { effectiveWorkerRate, professionRate, workingDaysInYear, type RateCalc } from '../model/rates'
import type { Project } from '../model/schema'
import { dayToIso } from '../engine/calendar'
import { formatMonth } from '../i18n/format'
import { BUDGET_COLUMNS, BUDGET_COMPUTED_COLUMNS, BUDGET_DATE_COLUMNS, BUDGET_MONEY_COLUMNS, buildBudgetLines, buildBudgetPhasing, type BudgetLabels } from './budgetExport'
import { treeOrder, wbsNumbers } from '../model/hierarchy'
import { buildExportTable, DATE_COLUMNS, EXPORT_COLUMNS, type Cell } from './tableExport'

export const WORKBOOK_SHEETS = [
  'project',
  'calendar',
  'tasks',
  'lines',
  'actuals',
  'categories',
  'departments',
  'professions',
  'workers',
  'absences',
  'machines',
  'materials',
  'phasing',
] as const
export type WorkbookSheetKey = (typeof WORKBOOK_SHEETS)[number]

export interface WorkbookSheet {
  key: WorkbookSheetKey
  name: string
  headers: string[]
  rows: Cell[][]
  /** Indexy vypočtených sloupců (šedě, import je ignoruje). */
  computed: ReadonlySet<number>
  dateColumns: ReadonlySet<number>
  moneyColumns: ReadonlySet<number>
  widths?: number[]
  frozenColumns?: number
}

/** Položky listu Projekt (první sloupec = popisek, druhý = hodnota). */
export const PROJECT_ITEMS = ['format', 'name', 'startDate', 'currency', 'language', 'limit', 'workingWeekdays', 'czechHolidays'] as const

/** Sloupce kalkulace sazby (profese i pracovník). */
export const RATE_CALC_COLUMNS = ['monthlyWage', 'contributionsPct', 'overheadMode', 'overheadValue', 'vacationDays', 'sickDays', 'calcHoursPerDay', 'productivityPct'] as const

/** Sloupce listů databáze (klíče překladů workbook.columns.*). */
export const SHEET_COLUMNS = {
  calendar: ['kind', 'from', 'to', 'name'],
  categories: ['name', 'limit', 'planned'],
  departments: ['name', 'code'],
  professions: ['name', 'category', 'capacity', 'manualRate', ...RATE_CALC_COLUMNS, 'rate', 'rateSource'],
  workers: ['name', 'profession', 'department', 'capacity', 'manualRate', ...RATE_CALC_COLUMNS, 'rate', 'rateSource', 'absenceDays'],
  absences: ['worker', 'from', 'to', 'note'],
  machines: ['name', 'category', 'machineRate', 'rateUnit', 'capacity'],
  materials: ['name', 'code', 'unit', 'unitPrice', 'category', 'supplier'],
  actuals: ['wbs', 'task', 'date', 'amount', 'note'],
} as const

/** Vypočtené sloupce listů databáze. */
const COMPUTED: Partial<Record<WorkbookSheetKey, readonly string[]>> = {
  categories: ['planned'],
  professions: ['rate', 'rateSource'],
  workers: ['rate', 'rateSource', 'absenceDays'],
  actuals: ['task'],
}
const MONEY = new Set(['limit', 'planned', 'manualRate', 'monthlyWage', 'rate', 'machineRate', 'unitPrice', 'amount'])
const DATES = new Set(['from', 'to', 'date'])

const toUnits = (minor: number | undefined) => (minor === undefined ? null : Math.round(minor) / 100)

/** Kalkulace sazby jako buňky (null = profese / pracovník kalkulaci nemá). */
function rateCalcCells(calc: RateCalc | undefined, t: (key: string) => string): Cell[] {
  if (!calc) return RATE_CALC_COLUMNS.map(() => null)
  return [
    toUnits(calc.monthlyWage),
    calc.contributionsPct,
    t(`workbook.overheadMode.${calc.overheadMode}`),
    calc.overheadMode === 'annual' ? toUnits(calc.overheadValue) : calc.overheadValue,
    calc.vacationDays,
    calc.sickDays,
    calc.hoursPerDay,
    calc.productivityPct,
  ]
}

export function buildWorkbook(
  project: Project,
  scheduleResult: ScheduleResult,
  costs: CostsResult,
  timeline: CostTimeline,
  t: (key: string) => string,
  language: string,
): WorkbookSheet[] {
  const fundDays = workingDaysInYear(project.calendar, Number(project.startDate.slice(0, 4)))
  const nameOf = <T extends { id: string; name: string }>(list: T[], id: string | undefined) => (id === undefined ? null : (list.find((x) => x.id === id)?.name ?? null))
  const budgetLabels: BudgetLabels = {
    kind: (kind) => t(`detail.kind.${kind}`),
    timing: (timing) => t(`budgetExport.timing.${timing}`),
    total: t('costs.total'),
    cumulative: t('costs.totalCumulative'),
    period: (p) => {
      const [y, m] = dayToIso(p.startDay).split('-').map(Number) as [number, number]
      return formatMonth(y, m, language, 'withYear')
    },
  }

  /** List databáze z klíčů sloupců a řádků. */
  const catalog = (key: keyof typeof SHEET_COLUMNS & WorkbookSheetKey, rows: Cell[][]): WorkbookSheet => {
    const columns: readonly string[] = SHEET_COLUMNS[key]
    const indexes = (pred: (c: string) => boolean) => new Set(columns.map((c, i) => (pred(c) ? i : -1)).filter((i) => i >= 0))
    return {
      key,
      name: t(`workbook.sheets.${key}`),
      headers: columns.map((c) => t(`workbook.columns.${c}`)),
      rows,
      computed: indexes((c) => (COMPUTED[key] ?? []).includes(c)),
      dateColumns: indexes((c) => DATES.has(c)),
      moneyColumns: indexes((c) => MONEY.has(c)),
      widths: columns.map((c) => (c === 'name' || c === 'worker' ? 28 : c === 'supplier' || c === 'note' ? 24 : c === 'category' || c === 'profession' || c === 'department' ? 18 : 13)),
      frozenColumns: 1,
    }
  }

  // --- Projekt ---
  const projectValues: Record<(typeof PROJECT_ITEMS)[number], Cell> = {
    format: t('workbook.formatValue'),
    name: project.name,
    startDate: project.startDate,
    currency: project.currency,
    language: project.language,
    limit: toUnits(project.budget?.limit),
    workingWeekdays: [...project.calendar.workingWeekdays].sort().join(', '),
    czechHolidays: t(project.calendar.useCzechHolidays ? 'workbook.yes' : 'workbook.no'),
  }
  const projectSheet: WorkbookSheet = {
    key: 'project',
    name: t('workbook.sheets.project'),
    headers: [t('workbook.project.item'), t('workbook.project.value')],
    rows: PROJECT_ITEMS.map((item) => [t(`workbook.project.${item}`), projectValues[item]]),
    computed: new Set(),
    dateColumns: new Set(),
    moneyColumns: new Set(),
    widths: [44, 40],
  }

  // --- Kalendář ---
  const calendarSheet = catalog('calendar', [
    ...project.calendar.customHolidays.map((h) => [t('workbook.calendarKind.custom'), h.start, h.end, h.name] as Cell[]),
    ...project.calendar.removedHolidays.map((d) => [t('workbook.calendarKind.removed'), d, d, null] as Cell[]),
  ])

  // --- Činnosti (stejné sloupce jako export činností) ---
  const tasks = buildExportTable(project, scheduleResult, (kind) => t(`kind.${kind}`))
  const taskComputed = ['wbs', 'start', 'finish']
  const tasksSheet: WorkbookSheet = {
    key: 'tasks',
    name: t('workbook.sheets.tasks'),
    headers: EXPORT_COLUMNS.map((c) => t(`export.columns.${c}`)),
    rows: tasks.rows,
    computed: new Set(EXPORT_COLUMNS.map((c, i) => (taskComputed.includes(c) ? i : -1)).filter((i) => i >= 0)),
    dateColumns: new Set(EXPORT_COLUMNS.map((c, i) => (DATE_COLUMNS.includes(c) ? i : -1)).filter((i) => i >= 0)),
    moneyColumns: new Set(),
    widths: EXPORT_COLUMNS.map((c) => (c === 'name' ? 45 : c === 'notes' ? 40 : c === 'predecessors' ? 16 : 12)),
    frozenColumns: 4,
  }

  // --- Řádky rozpočtu ---
  const lines = buildBudgetLines(project, costs, budgetLabels)
  const col = (set: readonly string[]) => new Set(BUDGET_COLUMNS.map((c, i) => (set.includes(c) ? i : -1)).filter((i) => i >= 0))
  const linesSheet: WorkbookSheet = {
    key: 'lines',
    name: t('workbook.sheets.lines'),
    headers: BUDGET_COLUMNS.map((c) => t(`budgetExport.columns.${c}`)),
    rows: lines.rows,
    computed: col(BUDGET_COMPUTED_COLUMNS),
    dateColumns: col(BUDGET_DATE_COLUMNS),
    moneyColumns: col(BUDGET_MONEY_COLUMNS),
    widths: BUDGET_COLUMNS.map((c) => ({ task: 36, resource: 28, worker: 18, category: 16, tags: 20, note: 30, kind: 14, timing: 12 })[c as string] ?? 11),
    frozenColumns: 2,
  }

  // --- Databáze ---
  const planned = totalsByCategory(timeline)
  const limits = new Map((project.budget?.categoryLimits ?? []).map((c) => [c.categoryId, c.limit]))
  const categoriesSheet = catalog(
    'categories',
    project.costCategories.map((c) => [c.name, toUnits(limits.get(c.id)), toUnits(planned.get(c.id) ?? 0)]),
  )
  const departmentsSheet = catalog(
    'departments',
    project.departments.map((d) => [d.name, d.code ?? null]),
  )
  const professionsSheet = catalog(
    'professions',
    project.professions.map((p) => {
      const rate = professionRate(p, fundDays)
      const source = p.manualRate !== undefined ? 'manual' : rate !== null ? 'calc' : null
      return [
        p.name,
        nameOf(project.costCategories, p.categoryId),
        p.capacityPerDay,
        toUnits(p.manualRate),
        ...rateCalcCells(p.rateCalc, t),
        rate === null ? null : toUnits(rate),
        source === null ? null : t(`resources.rateSource.${source}`),
      ]
    }),
  )
  const workersSheet = catalog(
    'workers',
    project.workers.map((w) => {
      const profession = project.professions.find((p) => p.id === w.professionId)
      const eff = profession ? effectiveWorkerRate(w, profession, fundDays) : { rate: null, source: 'profession' as const }
      return [
        w.name,
        profession?.name ?? null,
        nameOf(project.departments, w.departmentId),
        w.capacityPerDay,
        toUnits(w.manualRate),
        ...rateCalcCells(w.rateCalc, t),
        eff.rate === null ? null : toUnits(eff.rate),
        t(`resources.rateSource.${eff.source}`),
        absenceWorkingDays(w, project.calendar),
      ]
    }),
  )
  const absencesSheet = catalog(
    'absences',
    project.workers.flatMap((w) => (w.absences ?? []).map((a) => [w.name, a.start, a.end, a.note ?? null] as Cell[])),
  )
  const machinesSheet = catalog(
    'machines',
    project.machines.map((m) => [m.name, nameOf(project.costCategories, m.categoryId), toUnits(m.rate), t(`workbook.rateUnit.${m.rateUnit}`), m.capacityPerDay]),
  )
  const materialsSheet = catalog(
    'materials',
    project.materials.map((m) => [m.name, m.code ?? null, m.unit, toUnits(m.unitPrice), nameOf(project.costCategories, m.categoryId), m.supplier ?? null]),
  )

  // --- Skutečné náklady (fáze 9): činnost podle WBS, název jen pro orientaci ---
  const wbs = wbsNumbers(project)
  const actualsSheet = catalog(
    'actuals',
    treeOrder(project).flatMap((task) => (task.actuals ?? []).map((a) => [wbs.get(task.id) ?? '', task.name, a.date, toUnits(a.amount), a.note ?? null])),
  )

  // --- Náběh (celý vypočtený) ---
  const phasing = timeline.range ? buildBudgetPhasing(project, timeline, splitPeriods(timeline.range, 'month'), budgetLabels) : { headers: [''], rows: [] }
  const all = new Set(phasing.headers.map((_, i) => i))
  const phasingSheet: WorkbookSheet = {
    key: 'phasing',
    name: t('workbook.sheets.phasing'),
    headers: phasing.headers,
    rows: phasing.rows,
    computed: all,
    dateColumns: new Set(),
    moneyColumns: new Set([...all].filter((i) => i > 0)),
    widths: phasing.headers.map((_, i) => (i === 0 ? 22 : 15)),
    frozenColumns: 1,
  }

  return [
    projectSheet,
    calendarSheet,
    tasksSheet,
    linesSheet,
    actualsSheet,
    categoriesSheet,
    departmentsSheet,
    professionsSheet,
    workersSheet,
    absencesSheet,
    machinesSheet,
    materialsSheet,
    phasingSheet,
  ]
}
