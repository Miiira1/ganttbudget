/**
 * Import řádků rozpočtu z CSV/XLSX (fáze 7, I-04, N-10) – čisté funkce, testy v budgetImport.test.ts.
 *
 * Vstup je tabulka (první řádek = hlavička) ve tvaru listu Řádky z exportu rozpočtu.
 * Činnost se pozná podle WBS; profese, pracovníci, stroje, materiály a kategorie podle názvu
 * (bez ohledu na velikost písmen). Nic se nevytvoří samo. Sloupce Hodiny a Náklad se ignorují
 * (aplikace je spočítá). Hlavičky, typy a načasování se přijmou česky i anglicky.
 *
 * Výsledek: řádky činností uvedených v souboru se nahradí řádky ze souboru (v jeho pořadí),
 * ostatní činnosti zůstanou beze změny. Při jakékoli chybě se nepoužije nic – vrátí se seznam
 * chyb s čísly řádků v souboru. Hotový projekt se ještě ověří schématem Zod.
 */
import cs from '../i18n/locales/cs.json'
import en from '../i18n/locales/en.json'
import { currencyVariants } from '../i18n/format'
import { defaultCategoryId } from '../model/defaultCategories'
import { wbsNumbers } from '../model/hierarchy'
import { parseMoney } from '../model/money'
import { MAX_LINE_TAGS, MAX_TAG_LENGTH, MILESTONE_LINE_KINDS, nameKey, ProjectSchema, type Project, type TaskLine } from '../model/schema'
import { normalizeTags } from '../model/tags'
import { BUDGET_COLUMNS, type BudgetColumn } from './budgetExport'
import { CellSchema, isoDate, normalize, text, type CellValue, type ImportError } from './tableImport'

/** Nejvíc řádků rozpočtu v jednom importu. */
export const MAX_BUDGET_ROWS = 20_000

export type BudgetImportResult =
  | { ok: true; project: Project; summary: { lines: number; tasks: number; replaced: number } }
  | { ok: false; errors: ImportError[] }

const HEADER_ALIASES = new Map<string, BudgetColumn>()
// Hlavička s měnou („Sazba {{currency}}/h“) se pozná s jakoukoli měnou i ve starší podobě „Kč“ (audit U3).
for (const column of BUDGET_COLUMNS) for (const l of [cs, en]) for (const v of currencyVariants(l.budgetExport.columns[column])) HEADER_ALIASES.set(normalize(v), column)
const REQUIRED: BudgetColumn[] = ['wbs', 'kind', 'resource']

const KINDS = ['labor', 'machine', 'material', 'oneTime', 'recurring'] as const
/** Klíč pro porovnání hodnot: jako nameKey, navíc nezlomitelná mezera = obyčejná (česká typografie v textech). */
const labelKey = (label: string) => nameKey(label.replace(/\s+/g, ' '))
const KIND_ALIASES = new Map<string, TaskLine['kind']>()
for (const kind of KINDS) for (const label of [kind, cs.detail.kind[kind], en.detail.kind[kind]]) KIND_ALIASES.set(labelKey(label), kind)

const TIMINGS = ['start', 'end', 'date', 'day', 'week', 'month'] as const
type Timing = (typeof TIMINGS)[number]
const TIMING_ALIASES = new Map<string, Timing>()
for (const timing of TIMINGS) for (const label of [timing, cs.budgetExport.timing[timing], en.budgetExport.timing[timing]]) TIMING_ALIASES.set(labelKey(label), timing)

/** Desetinné číslo z buňky (číslo, „2,5“, „50 %“); undefined = prázdné, null = nesmysl. */
export function decimal(value: CellValue): number | null | undefined {
  if (value === null) return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = text(value).replace(/%/g, '').replace(/\s/g, '').replace(',', '.')
  if (raw === '') return undefined
  return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : null
}

/** Částka v haléřích z buňky (číslo v Kč, nebo text „1 234,50 Kč“); undefined = prázdné, null = nesmysl. */
export function money(value: CellValue): number | null | undefined {
  if (value === null) return undefined
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null
  const raw = text(value).trim()
  if (raw === '') return undefined
  return parseMoney(raw)
}

export function importBudget(rawRows: unknown[][], base: Project, makeId: () => string): BudgetImportResult {
  const rows = rawRows.map((row) => (Array.isArray(row) ? row.map((cell) => CellSchema.parse(cell)) : []))
  const fail = (errors: ImportError[]): BudgetImportResult => ({ ok: false, errors })

  // --- Hlavička ---
  const columnIndex = new Map<BudgetColumn, number>()
  ;(rows[0] ?? []).forEach((cell, i) => {
    const column = HEADER_ALIASES.get(normalize(text(cell)))
    if (column && !columnIndex.has(column)) columnIndex.set(column, i)
  })
  if (REQUIRED.some((c) => !columnIndex.has(c))) return fail([{ row: 1, code: 'missingColumns' }])
  const dataRows = rows
    .map((cells, index) => ({ cells, fileRow: index + 1 }))
    .slice(1)
    .filter((r) => r.cells.some((c) => text(c).trim() !== ''))
  if (dataRows.length === 0) return fail([{ row: 1, code: 'empty' }])
  if (dataRows.length > MAX_BUDGET_ROWS) return fail([{ row: 1, code: 'tooManyRows' }])

  // --- Číselníky podle názvu, činnosti podle WBS ---
  const byName = <T extends { id: string; name: string }>(list: T[]) => new Map(list.map((x) => [nameKey(x.name), x]))
  const professions = byName(base.professions)
  const workers = byName(base.workers)
  const machines = byName(base.machines)
  const materials = byName(base.materials)
  const categories = byName(base.costCategories)
  const taskByWbs = new Map([...wbsNumbers(base)].map(([id, wbs]) => [wbs, base.tasks.find((t) => t.id === id)!]))
  const servicesCategory = base.costCategories.find((c) => c.id === defaultCategoryId('services'))?.id ?? base.costCategories[0]?.id

  const errors: ImportError[] = []
  const linesByTask = new Map<string, TaskLine[]>()
  for (const { cells, fileRow } of dataRows) {
    const cell = (column: BudgetColumn): CellValue => {
      const i = columnIndex.get(column)
      return i === undefined ? null : (cells[i] ?? null)
    }
    const str = (column: BudgetColumn) => text(cell(column)).trim()
    const error = (code: string) => {
      errors.push({ row: fileRow, code })
      return null
    }

    const line = ((): TaskLine | null => {
      const task = taskByWbs.get(str('wbs'))
      if (!task) return error('unknownTask')
      const kind = KIND_ALIASES.get(labelKey(str('kind')))
      if (!kind) return error('badKind')
      if (task.kind === 'milestone' && !(MILESTONE_LINE_KINDS as readonly string[]).includes(kind)) return error('lineNotAllowed')
      const resource = str('resource')
      if (resource === '') return error('missingName')

      // Kategorie: zadaná podle názvu, jinak výchozí podle zdroje / Služby.
      const categoryName = str('category')
      const category = categoryName === '' ? null : categories.get(nameKey(categoryName))
      if (categoryName !== '' && !category) return error('unknownCategory')

      // Štítky oddělené čárkou nebo středníkem; příliš dlouhé nebo moc štítků = chyba.
      const rawTags = str('tags')
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean)
      if (rawTags.some((t) => t.length > MAX_TAG_LENGTH) || rawTags.length > MAX_LINE_TAGS) return error('badTags')
      const tags = normalizeTags(rawTags)
      const note = str('note')
      if (note.length > 500) return error('noteTooLong')
      const extra = { ...(note ? { note } : {}), ...(tags.length > 0 ? { tags } : {}) }
      const share = () => {
        const value = decimal(cell('quantity'))
        if (value === undefined) return 100
        return value === null || value < 1 || value > 100 ? error('badShare') : value
      }

      switch (kind) {
        case 'labor': {
          const profession = professions.get(nameKey(resource))
          if (!profession) return error('unknownProfession')
          const workerName = str('worker')
          const worker = workerName === '' ? undefined : workers.get(nameKey(workerName))
          if (workerName !== '' && !worker) return error('unknownWorker')
          if (worker && worker.professionId !== profession.id) return error('workerProfessionMismatch')
          const sharePct = share()
          if (sharePct === null) return null
          return { id: makeId(), kind, categoryId: category?.id ?? profession.categoryId, professionId: profession.id, ...(worker ? { workerId: worker.id } : {}), sharePct, ...extra }
        }
        case 'machine': {
          const machine = machines.get(nameKey(resource))
          if (!machine) return error('unknownMachine')
          const sharePct = share()
          if (sharePct === null) return null
          return { id: makeId(), kind, categoryId: category?.id ?? machine.categoryId, machineId: machine.id, sharePct, ...extra }
        }
        case 'material': {
          const material = materials.get(nameKey(resource))
          if (!material) return error('unknownMaterial')
          const quantity = decimal(cell('quantity'))
          if (quantity === undefined || quantity === null || quantity <= 0 || quantity > 1_000_000_000 || Math.abs(Math.round(quantity * 1000) - quantity * 1000) > 1e-6) {
            return error('badQuantity')
          }
          const price = money(cell('amount'))
          if (price === null) return error('badAmount')
          return {
            id: makeId(),
            kind,
            categoryId: category?.id ?? material.categoryId,
            materialId: material.id,
            quantity,
            ...(price !== undefined ? { unitPriceOverride: price } : {}),
            ...extra,
          }
        }
        default: {
          if (resource.length > 200) return error('nameTooLong')
          const amount = money(cell('amount'))
          if (amount === null || amount === undefined) return error('badAmount')
          const timingText = str('timing')
          const timing = timingText === '' ? undefined : TIMING_ALIASES.get(labelKey(timingText))
          if (timingText !== '' && timing === undefined) return error('badTiming') // neznámý text, ne výchozí hodnota
          const categoryId = category?.id ?? servicesCategory
          if (!categoryId) return error('unknownCategory')
          if (kind === 'oneTime') {
            const when = timing ?? 'start'
            if (when !== 'start' && when !== 'end' && when !== 'date') return error('badTiming')
            if (when !== 'date') return { id: makeId(), kind, categoryId, name: resource, amount, timing: when, ...extra }
            const date = isoDate(cell('date'))
            if (date === undefined) return error('missingDate')
            if (date === null) return error('badDate')
            return { id: makeId(), kind, categoryId, name: resource, amount, timing: when, date, ...extra }
          }
          const period = timing ?? 'month'
          if (period !== 'day' && period !== 'week' && period !== 'month') return error('badTiming')
          return { id: makeId(), kind, categoryId, name: resource, amount, period, ...extra }
        }
      }
    })()
    if (line) linesByTask.set(taskByWbs.get(str('wbs'))!.id, [...(linesByTask.get(taskByWbs.get(str('wbs'))!.id) ?? []), line])
  }
  if (errors.length > 0) return fail(errors)

  let replaced = 0
  const project: Project = {
    ...base,
    tasks: base.tasks.map((task) => {
      const lines = linesByTask.get(task.id)
      if (!lines) return task
      replaced += task.lines.length
      return { ...task, lines }
    }),
  }
  if (!ProjectSchema.safeParse(project).success) return fail([{ row: 1, code: 'invalid' }])
  const lines = [...linesByTask.values()].reduce((sum, l) => sum + l.length, 0)
  return { ok: true, project, summary: { lines, tasks: linesByTask.size, replaced } }
}
