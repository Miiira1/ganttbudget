/**
 * Import celého projektu ze sešitu Excelu (doplněk po fázi 7) – čisté funkce, testy v workbookImport.test.ts.
 *
 * Vstup: listy sešitu (název → tabulka) ve tvaru exportu workbookExport.ts, česky i anglicky.
 * Postup: Projekt + Kalendář → databáze (Kategorie, Střediska, Profese, Pracovníci, Nepřítomnosti,
 * Stroje, Materiály) → Činnosti (importTable) → Řádky (importBudget). Vazby mezi listy jdou
 * přes názvy (jsou jedinečné) a WBS. Vypočtené sloupce a list Náběh se ignorují.
 * Položky databáze se stejným názvem jako v současném projektu si ponechají své ID.
 *
 * Při jakékoli chybě se nepoužije nic – vrátí se chyby s listem a číslem řádku.
 * Hotový projekt se ověří schématem Zod (N-10).
 */
import { HOLIDAY_COUNTRIES } from '../engine/calendar'
import cs from '../i18n/locales/cs.json'
import en from '../i18n/locales/en.json'
import { currencyVariants } from '../i18n/format'
import { createDefaultRateCalc, type RateCalc } from '../model/rates'
import {
  calendarDaysInclusive,
  MAX_ABSENCE_DAYS,
  MAX_ACTUALS,
  MAX_CATALOG_ITEMS,
  nameKey,
  ProjectSchema,
  RateCalcSchema,
  type Absence,
  type ActualCost,
  type Project,
} from '../model/schema'
import { decimal, importBudget, money } from './budgetImport'
import { CellSchema, importTable, isoDate, normalize, text, type CellValue } from './tableImport'
import { wbsNumbers } from '../model/hierarchy'
import { PROJECT_ITEMS, RATE_CALC_COLUMNS, WORKBOOK_SHEETS, type WorkbookSheetKey } from './workbookExport'

/** Nejvíc řádků listu Skutečnost. */
const MAX_ACTUAL_ROWS = 50_000

export interface WorkbookError {
  sheet: WorkbookSheetKey
  /** Řádek v listu (1 = hlavička). */
  row: number
  code: string
}

export interface WorkbookSummary {
  tasks: number
  lines: number
  categories: number
  departments: number
  professions: number
  workers: number
  absences: number
  machines: number
  materials: number
  /** Položky skutečných nákladů (fáze 9). */
  actuals: number
}

export type WorkbookImportResult = { ok: true; project: Project; summary: WorkbookSummary } | { ok: false; errors: WorkbookError[] }

// --- Názvy listů, sloupců, položek a hodnot česky i anglicky ---
const aliases = <K extends string>(keys: readonly K[], label: (l: { workbook: typeof cs.workbook }, k: K) => string, extra: (k: K) => string[] = () => []) => {
  const map = new Map<string, K>()
  // Hlavička s měnou („Částka {{currency}}“) se pozná s jakoukoli měnou i ve starší podobě „Kč“ (audit U3).
  for (const k of keys) for (const l of [cs, en]) for (const name of [label(l, k), ...extra(k)]) for (const v of currencyVariants(name)) map.set(normalize(v), k)
  return map
}
const SHEETS = aliases(WORKBOOK_SHEETS, (l, k) => l.workbook.sheets[k])
type ColumnKey = keyof typeof cs.workbook.columns
const COLUMNS = aliases(Object.keys(cs.workbook.columns) as ColumnKey[], (l, k) => l.workbook.columns[k])
// Starší sešity (do fáze 13c) měly položku „České státní svátky (ano / ne)“.
const ITEMS = aliases(PROJECT_ITEMS, (l, k) => l.workbook.project[k], (k) =>
  k === 'czechHolidays' ? ['České státní svátky (ano / ne)', 'Czech public holidays (yes / no)'] : [],
)
const YES_NO = new Map<string, boolean>([...['ano', 'yes', 'true', '1', 'a', 'y'].map((v) => [v, true] as const), ...['ne', 'no', 'false', '0', 'n'].map((v) => [v, false] as const)])
const OVERHEAD = aliases(['annual', 'percent'] as const, (l, k) => l.workbook.overheadMode[k], (k) => [k])
const RATE_UNIT = aliases(['hour', 'day'] as const, (l, k) => l.workbook.rateUnit[k], (k) => [k])
const CALENDAR_KIND = aliases(['custom', 'removed'] as const, (l, k) => l.workbook.calendarKind[k], (k) => [k])

/** Tabulka listu: sloupce podle hlavičky a datové řádky (bez prázdných, s číslem řádku v listu). */
function table(raw: unknown[][]) {
  const rows = raw.map((row) => (Array.isArray(row) ? row.map((c) => CellSchema.parse(c)) : []))
  const columns = new Map<ColumnKey, number>()
  ;(rows[0] ?? []).forEach((cell, i) => {
    const key = COLUMNS.get(normalize(text(cell)))
    if (key && !columns.has(key)) columns.set(key, i)
  })
  const data = rows
    .map((cells, i) => ({ cells, fileRow: i + 1 }))
    .slice(1)
    .filter((r) => r.cells.some((c) => text(c).trim() !== ''))
  return { columns, data }
}

export function importWorkbook(sheetsByName: Map<string, unknown[][]>, base: Project, makeId: () => string): WorkbookImportResult {
  const errors: WorkbookError[] = []
  const sheets = new Map<WorkbookSheetKey, unknown[][]>()
  for (const [name, rows] of sheetsByName) {
    const key = SHEETS.get(normalize(name))
    if (key && !sheets.has(key)) sheets.set(key, rows)
  }
  // Náběh je jen vypočtený; Skutečnost přibyla ve fázi 9 – starší sešity ji nemají.
  for (const key of WORKBOOK_SHEETS) if (key !== 'phasing' && key !== 'actuals' && !sheets.has(key)) errors.push({ sheet: key, row: 1, code: 'missingSheet' })
  if (errors.length > 0) return { ok: false, errors }

  /** Projde řádky listu; `parse` vrátí položku, nebo kód chyby. */
  function each<T>(sheet: WorkbookSheetKey, required: ColumnKey[], parse: (cell: (c: ColumnKey) => CellValue, str: (c: ColumnKey) => string) => T | string): T[] {
    const { columns, data } = table(sheets.get(sheet)!)
    if (required.some((c) => !columns.has(c))) {
      errors.push({ sheet, row: 1, code: 'missingColumns' })
      return []
    }
    if (data.length > MAX_CATALOG_ITEMS) {
      errors.push({ sheet, row: 1, code: 'tooManyRows' })
      return []
    }
    const out: T[] = []
    for (const { cells, fileRow } of data) {
      const cell = (c: ColumnKey): CellValue => {
        const i = columns.get(c)
        return i === undefined ? null : (cells[i] ?? null)
      }
      const result = parse(cell, (c) => text(cell(c)).trim())
      if (typeof result === 'string') errors.push({ sheet, row: fileRow, code: result })
      else out.push(result)
    }
    return out
  }

  // --- Projekt (položka / hodnota) ---
  const items = new Map<(typeof PROJECT_ITEMS)[number], { value: CellValue; row: number }>()
  sheets.get('project')!.forEach((raw, i) => {
    if (!Array.isArray(raw)) return
    const item = ITEMS.get(normalize(text(CellSchema.parse(raw[0]))))
    if (item && !items.has(item)) items.set(item, { value: CellSchema.parse(raw[1]), row: i + 1 })
  })
  const projectError = (item: (typeof PROJECT_ITEMS)[number], code: string) => errors.push({ sheet: 'project', row: items.get(item)?.row ?? 1, code })
  const name = text(items.get('name')?.value ?? null).trim()
  if (name === '' || name.length > 200) projectError('name', 'badName')
  const startDate = isoDate(items.get('startDate')?.value ?? null)
  if (!startDate) projectError('startDate', 'badDate')
  const currency = text(items.get('currency')?.value ?? null).trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) projectError('currency', 'badCurrency')
  const language = text(items.get('language')?.value ?? null).trim() || base.language
  const projectLimit = money(items.get('limit')?.value ?? null)
  if (projectLimit === null || projectLimit === 0) projectError('limit', 'badAmount')
  const weekdayCell = items.get('workingWeekdays')?.value ?? null
  const weekdays = text(weekdayCell)
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(Number)
  if (weekdays.length === 0 || weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7) || new Set(weekdays).size !== weekdays.length) {
    projectError('workingWeekdays', 'badWeekdays')
  }
  const holidays = YES_NO.get(nameKey(text(items.get('czechHolidays')?.value ?? null)))
  if (holidays === undefined) projectError('czechHolidays', 'badYesNo')
  // Země státních svátků (fáze 13d); prázdné nebo chybí = Česko.
  const countryText = text(items.get('holidayCountry')?.value ?? null).trim().toUpperCase()
  const country = HOLIDAY_COUNTRIES.find((c) => c === countryText)
  if (countryText !== '' && !country) projectError('holidayCountry', 'badCountry')

  // --- Kalendář ---
  const customHolidays: Project['calendar']['customHolidays'] = []
  const removedHolidays: string[] = []
  each('calendar', ['kind', 'from'], (cell, str) => {
    const kind = CALENDAR_KIND.get(normalize(str('kind')))
    if (!kind) return 'badKind'
    const from = isoDate(cell('from'))
    const to = isoDate(cell('to'))
    if (!from || to === null) return 'badDate'
    if (kind === 'removed') return void removedHolidays.push(from)
    if ((to ?? from) < from) return 'badRange'
    if (str('name').length > 200) return 'nameTooLong'
    customHolidays.push({ start: from, end: to ?? from, name: str('name') })
  })

  // --- Databáze: ID podle názvu ze současného projektu, jinak nové ---
  const idFor = (list: { id: string; name: string }[]) => {
    const byName = new Map(list.map((x) => [nameKey(x.name), x.id]))
    return (n: string) => byName.get(nameKey(n)) ?? makeId()
  }
  /** Hlídá jedinečné názvy v listu. */
  const unique = () => {
    const seen = new Set<string>()
    return (n: string) => {
      if (n === '' || n.length > 200) return 'badName'
      if (seen.has(nameKey(n))) return 'duplicateName'
      seen.add(nameKey(n))
      return null
    }
  }
  const capacity = (cell: CellValue) => {
    const v = decimal(cell)
    return v === undefined || v === null || v < 0.5 || v > 24 ? null : v
  }
  const optionalMoney = (cell: CellValue) => money(cell) // undefined = prázdné, null = chyba

  const categoryId = idFor(base.costCategories)
  const categoryNames = unique()
  const categoryLimits: { categoryId: string; limit: number }[] = []
  const costCategories = each('categories', ['name'], (cell, str) => {
    const problem = categoryNames(str('name'))
    if (problem) return problem
    const limit = optionalMoney(cell('limit'))
    if (limit === null || limit === 0) return 'badAmount'
    const id = categoryId(str('name'))
    if (limit !== undefined) categoryLimits.push({ categoryId: id, limit })
    return { id, name: str('name') }
  })
  const categoryByName = new Map(costCategories.map((c) => [nameKey(c.name), c.id]))

  const departmentNames = unique()
  const departmentId = idFor(base.departments)
  const departments = each('departments', ['name'], (_, str) => {
    const problem = departmentNames(str('name'))
    if (problem) return problem
    if (str('code').length > 50) return 'codeTooLong'
    return { id: departmentId(str('name')), name: str('name'), ...(str('code') ? { code: str('code') } : {}) }
  })
  const departmentByName = new Map(departments.map((d) => [nameKey(d.name), d.id]))

  /** Kalkulace sazby z buněk; undefined = bez kalkulace (prázdná mzda). */
  const rateCalc = (cell: (c: ColumnKey) => CellValue, str: (c: ColumnKey) => string): RateCalc | undefined | 'badRateCalc' => {
    if (RATE_CALC_COLUMNS.every((c) => str(c) === '')) return undefined
    const d = createDefaultRateCalc()
    const mode = str('overheadMode') === '' ? d.overheadMode : OVERHEAD.get(normalize(str('overheadMode')))
    if (!mode) return 'badRateCalc'
    const num = (c: ColumnKey, fallback: number) => {
      const v = decimal(cell(c))
      return v === undefined ? fallback : v
    }
    const wage = money(cell('monthlyWage'))
    const overhead = mode === 'annual' ? money(cell('overheadValue')) : decimal(cell('overheadValue'))
    const calc = {
      monthlyWage: wage === undefined ? d.monthlyWage : wage,
      contributionsPct: num('contributionsPct', d.contributionsPct),
      overheadMode: mode,
      overheadValue: overhead === undefined ? d.overheadValue : overhead,
      vacationDays: num('vacationDays', d.vacationDays),
      sickDays: num('sickDays', d.sickDays),
      hoursPerDay: num('calcHoursPerDay', d.hoursPerDay),
      productivityPct: num('productivityPct', d.productivityPct),
    }
    const parsed = RateCalcSchema.safeParse(calc)
    return parsed.success ? parsed.data : 'badRateCalc'
  }

  const professionNames = unique()
  const professionId = idFor(base.professions)
  const professions = each('professions', ['name', 'category', 'capacity'], (cell, str) => {
    const problem = professionNames(str('name'))
    if (problem) return problem
    const category = categoryByName.get(nameKey(str('category')))
    if (!category) return 'unknownCategory'
    const cap = capacity(cell('capacity'))
    if (cap === null) return 'badCapacity'
    const manual = optionalMoney(cell('manualRate'))
    if (manual === null) return 'badAmount'
    const calc = rateCalc(cell, str)
    if (calc === 'badRateCalc') return calc
    return {
      id: professionId(str('name')),
      name: str('name'),
      categoryId: category,
      capacityPerDay: cap,
      ...(calc ? { rateCalc: calc } : {}),
      ...(manual !== undefined ? { manualRate: manual } : {}),
    }
  })
  const professionByName = new Map(professions.map((p) => [nameKey(p.name), p.id]))

  const workerNames = unique()
  const workerId = idFor(base.workers)
  const workers = each('workers', ['name', 'profession', 'capacity'], (cell, str) => {
    const problem = workerNames(str('name'))
    if (problem) return problem
    const profession = professionByName.get(nameKey(str('profession')))
    if (!profession) return 'unknownProfession'
    const department = str('department') === '' ? undefined : departmentByName.get(nameKey(str('department')))
    if (str('department') !== '' && !department) return 'unknownDepartment'
    const cap = capacity(cell('capacity'))
    if (cap === null) return 'badCapacity'
    const manual = optionalMoney(cell('manualRate'))
    if (manual === null) return 'badAmount'
    const calc = rateCalc(cell, str)
    if (calc === 'badRateCalc') return calc
    return {
      id: workerId(str('name')),
      name: str('name'),
      professionId: profession,
      ...(department ? { departmentId: department } : {}),
      capacityPerDay: cap,
      ...(calc ? { rateCalc: calc } : {}),
      ...(manual !== undefined ? { manualRate: manual } : {}),
    } as Project['workers'][number]
  })
  const workerByName = new Map(workers.map((w) => [nameKey(w.name), w]))

  let absenceCount = 0
  each('absences', ['worker', 'from'], (cell, str) => {
    const worker = workerByName.get(nameKey(str('worker')))
    if (!worker) return 'unknownWorker'
    const from = isoDate(cell('from'))
    const to = isoDate(cell('to'))
    if (!from || to === null) return 'badDate'
    const end = to ?? from
    if (end < from || calendarDaysInclusive(from, end) > MAX_ABSENCE_DAYS) return 'badRange'
    if (str('note').length > 200) return 'noteTooLong'
    if ((worker.absences?.length ?? 0) >= 200) return 'tooManyRows'
    const absence: Absence = { start: from, end, ...(str('note') ? { note: str('note') } : {}) }
    worker.absences = [...(worker.absences ?? []), absence]
    absenceCount++
  })

  const machineNames = unique()
  const machineId = idFor(base.machines)
  const machines = each('machines', ['name', 'category', 'machineRate', 'rateUnit', 'capacity'], (cell, str) => {
    const problem = machineNames(str('name'))
    if (problem) return problem
    const category = categoryByName.get(nameKey(str('category')))
    if (!category) return 'unknownCategory'
    const rate = money(cell('machineRate'))
    if (rate === null || rate === undefined) return 'badAmount'
    const unit = RATE_UNIT.get(normalize(str('rateUnit')))
    if (!unit) return 'badRateUnit'
    const cap = capacity(cell('capacity'))
    if (cap === null) return 'badCapacity'
    return { id: machineId(str('name')), name: str('name'), categoryId: category, rate, rateUnit: unit, capacityPerDay: cap }
  })

  const materialNames = unique()
  const materialId = idFor(base.materials)
  const materials = each('materials', ['name', 'unit', 'unitPrice', 'category'], (cell, str) => {
    const problem = materialNames(str('name'))
    if (problem) return problem
    if (str('unit') === '' || str('unit').length > 20) return 'badUnit'
    const price = money(cell('unitPrice'))
    if (price === null || price === undefined) return 'badAmount'
    const category = categoryByName.get(nameKey(str('category')))
    if (!category) return 'unknownCategory'
    if (str('code').length > 50) return 'codeTooLong'
    if (str('supplier').length > 200) return 'nameTooLong'
    return {
      id: materialId(str('name')),
      name: str('name'),
      unit: str('unit'),
      unitPrice: price,
      categoryId: category,
      ...(str('code') ? { code: str('code') } : {}),
      ...(str('supplier') ? { supplier: str('supplier') } : {}),
    }
  })
  if (errors.length > 0) return { ok: false, errors }

  // --- Projekt bez činností → Činnosti → Řádky ---
  const budget = projectLimit !== undefined || categoryLimits.length > 0 ? { ...(projectLimit ? { limit: projectLimit } : {}), categoryLimits } : undefined
  const { budget: _oldBudget, ...rest } = base
  void _oldBudget
  const interim: Project = {
    ...rest,
    name,
    startDate: startDate as string,
    currency,
    language,
    calendar: {
      workingWeekdays: weekdays,
      useCzechHolidays: holidays as boolean,
      ...(country && country !== 'CZ' ? { holidayCountry: country } : {}),
      customHolidays,
      removedHolidays,
    },
    costCategories,
    departments,
    professions,
    workers,
    machines,
    materials,
    tasks: [],
    ...(budget ? { budget } : {}),
  }

  const hasData = (key: WorkbookSheetKey) => table(sheets.get(key)!).data.length > 0
  let project = interim
  if (hasData('tasks')) {
    // Současné činnosti jen pro porovnání: stejné WBS a název = stejné ID (baseline, skutečné náklady).
    const tasks = importTable(sheets.get('tasks')!, { ...interim, tasks: base.tasks }, makeId)
    if (!tasks.ok) return { ok: false, errors: tasks.errors.map((e) => ({ sheet: 'tasks', ...e })) }
    project = tasks.project
  }
  let lines = 0
  if (hasData('lines')) {
    const result = importBudget(sheets.get('lines')!, project, makeId)
    if (!result.ok) return { ok: false, errors: result.errors.map((e) => ({ sheet: 'lines', ...e })) }
    project = result.project
    lines = result.summary.lines
  }

  // --- Skutečnost (fáze 9): je-li list v sešitu, nahradí skutečné náklady všech činností ---
  let actualCount = project.tasks.reduce((sum, task) => sum + (task.actuals?.length ?? 0), 0)
  if (sheets.has('actuals')) {
    const taskByWbs = new Map([...wbsNumbers(project)].map(([id, wbs]) => [wbs, id]))
    const byTask = new Map<string, ActualCost[]>()
    const { columns, data } = table(sheets.get('actuals')!)
    if (data.length > 0 && (['wbs', 'date', 'amount'] as const).some((c) => !columns.has(c))) errors.push({ sheet: 'actuals', row: 1, code: 'missingColumns' })
    else if (data.length > MAX_ACTUAL_ROWS) errors.push({ sheet: 'actuals', row: 1, code: 'tooManyRows' })
    else {
      for (const { cells, fileRow } of data) {
        const cell = (c: ColumnKey): CellValue => {
          const i = columns.get(c)
          return i === undefined ? null : (cells[i] ?? null)
        }
        const fail = (code: string) => errors.push({ sheet: 'actuals', row: fileRow, code })
        const taskId = taskByWbs.get(text(cell('wbs')).trim())
        if (!taskId) {
          fail('unknownTask')
          continue
        }
        const date = isoDate(cell('date'))
        if (!date) {
          fail('badDate')
          continue
        }
        const amount = money(cell('amount'))
        if (amount === null || amount === undefined || amount > 1_000_000_000_000) {
          fail('badAmount')
          continue
        }
        const note = text(cell('note')).trim()
        if (note.length > 500) {
          fail('actualNoteTooLong')
          continue
        }
        const list = byTask.get(taskId) ?? []
        if (list.length >= MAX_ACTUALS) {
          fail('tooManyActuals')
          continue
        }
        list.push({ id: makeId(), date, amount, ...(note ? { note } : {}) })
        byTask.set(taskId, list)
      }
    }
    if (errors.length > 0) return { ok: false, errors }
    project = {
      ...project,
      tasks: project.tasks.map((task) => {
        const { actuals: _old, ...rest } = task
        void _old
        const list = byTask.get(task.id)
        return list ? { ...rest, actuals: list.sort((a, b) => a.date.localeCompare(b.date)) } : rest
      }),
    }
    actualCount = [...byTask.values()].reduce((sum, list) => sum + list.length, 0)
  }

  const parsed = ProjectSchema.safeParse(project)
  if (!parsed.success) return { ok: false, errors: [{ sheet: 'project', row: 1, code: 'invalid' }] }
  return {
    ok: true,
    project: parsed.data,
    summary: {
      tasks: project.tasks.length,
      lines,
      categories: costCategories.length,
      departments: departments.length,
      professions: professions.length,
      workers: workers.length,
      absences: absenceCount,
      actuals: actualCount,
      machines: machines.length,
      materials: materials.length,
    },
  }
}
