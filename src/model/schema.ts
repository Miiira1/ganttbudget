/**
 * Formát projektu popsaný knihovnou Zod (ZADANI.md, kap. 7).
 *
 * Schéma slouží ke dvěma věcem:
 *  1. Kontrola dat – každý načítaný soubor (JSON, CSV, XLSX, výstup z AI) se jím ověří,
 *     než se použije. Neplatná data se nepoužijí ani částečně.
 *  2. Typy TypeScriptu – typy Project, Task… vznikají přímo ze schématu, takže nemůžou
 *     se schématem „rozjet“.
 *
 * Při každé nezpětně slučitelné změně formátu se zvýší SCHEMA_VERSION a starší soubory
 * převede io/projectFile.ts (verze 1 → 2: databáze zdrojů, fáze 6a).
 */
import { z } from 'zod'
import { isValidIsoDate, todayIso } from './dates'
import { createDefaultCategories } from './defaultCategories'

export const SCHEMA_VERSION = 2

/** Den "YYYY-MM-DD". */
export const IsoDateSchema = z.string().refine(isValidIsoDate, { message: 'invalidDate' })

/** Typ vazby: FS = konec→začátek, SS = začátek→začátek, FF = konec→konec, SF = začátek→konec. */
export const DependencyTypeSchema = z.enum(['FS', 'SS', 'FF', 'SF'])

export const DependencySchema = z.object({
  predecessorId: z.string().min(1),
  type: DependencyTypeSchema,
  /** Prodleva v pracovních dnech; záporná = předstih. */
  lagDays: z.number().int().min(-1000).max(1000),
})

/** task = činnost, phase = fáze (sumární řádek), milestone = milník (délka 0). */
export const TaskKindSchema = z.enum(['task', 'phase', 'milestone'])

// ---------------------------------------------------------------------------
// Řádky zdrojů a nákladů činnosti (fáze 6b, Z-02, R-01, R-02). Peníze = haléře.
// ---------------------------------------------------------------------------

const LineIdSchema = z.string().min(1).max(100)
/** Částka v haléřích (stejná mez jako MoneySchema níže). */
const LineMoneySchema = z.number().int().min(0).max(1_000_000_000_000)
/** % zapojení / využití: 1–100 (desetiny povoleny). */
const SharePctSchema = z.number().min(1).max(100)

/** Nejvíc štítků u jednoho řádku (fáze 7, R-03). */
export const MAX_LINE_TAGS = 10
/** Nejdelší štítek (znaky). */
export const MAX_TAG_LENGTH = 30
/** Volný štítek řádku: 1–30 znaků bez okrajových mezer. */
const TagSchema = z
  .string()
  .min(1)
  .max(MAX_TAG_LENGTH)
  .refine((t) => t.trim() === t, { message: 'tagNotTrimmed' })

const lineBase = {
  id: LineIdSchema,
  /** Kategorie nákladů (výchozí podle databáze). */
  categoryId: LineIdSchema,
  note: z.string().max(500).optional(),
  /** Volné štítky (fáze 7) – např. „dotace“, „etapa 1“; bez opakování (velikost písmen se nerozlišuje). */
  tags: z.array(TagSchema).max(MAX_LINE_TAGS).optional(),
}

export const TaskLineSchema = z.discriminatedUnion('kind', [
  /** Člověk: profese, volitelně konkrétní pracovník té profese; hodiny = dny × h/den × %. */
  z.object({ ...lineBase, kind: z.literal('labor'), professionId: LineIdSchema, workerId: LineIdSchema.optional(), sharePct: SharePctSchema }),
  /** Stroj: hodiny = dny × h/den × %. */
  z.object({ ...lineBase, kind: z.literal('machine'), machineId: LineIdSchema, sharePct: SharePctSchema }),
  /** Materiál: množství × cena (z databáze, nebo přepsaná na řádku). */
  z.object({
    ...lineBase,
    kind: z.literal('material'),
    materialId: LineIdSchema,
    quantity: z
      .number()
      .gt(0)
      .max(1_000_000_000)
      .refine((q) => Math.abs(Math.round(q * 1000) - q * 1000) < 1e-6, { message: 'tooManyDecimals' }),
    unitPriceOverride: LineMoneySchema.optional(),
  }),
  /** Jednorázový náklad k začátku, ke konci, nebo k pevnému datu. */
  z
    .object({
      ...lineBase,
      kind: z.literal('oneTime'),
      name: z.string().trim().min(1).max(200),
      amount: LineMoneySchema,
      timing: z.enum(['start', 'end', 'date']),
      date: IsoDateSchema.optional(),
    })
    .refine((l) => l.timing !== 'date' || l.date !== undefined, { message: 'missingDate', path: ['date'] }),
  /** Průběžný náklad za pracovní den, kalendářní týden nebo měsíc po dobu činnosti. */
  z.object({
    ...lineBase,
    kind: z.literal('recurring'),
    name: z.string().trim().min(1).max(200),
    amount: LineMoneySchema,
    period: z.enum(['day', 'week', 'month']),
  }),
])

/** Typy řádků, které smí mít milník (nulová délka – časově závislé řádky by byly vždy 0). */
export const MILESTONE_LINE_KINDS = ['oneTime', 'material'] as const

/** Nejvíc položek skutečných nákladů u jedné činnosti (fáze 9). */
export const MAX_ACTUALS = 200

/** Skutečný náklad k datu (fáze 9, Earned Value – AC): částka v haléřích, nepovinná poznámka. */
export const ActualCostSchema = z.object({
  id: LineIdSchema,
  date: IsoDateSchema,
  amount: LineMoneySchema,
  note: z.string().max(500).optional(),
})

export const TaskSchema = z
  .object({
    id: z.string().min(1),
    /** Nadřazená fáze; null = nejvyšší úroveň. Hierarchie se využije ve fázi 4a. */
    parentId: z.string().min(1).nullable(),
    /** Pořadí mezi sourozenci (0, 1, 2…). */
    order: z.number().int().min(0),
    name: z.string().trim().min(1).max(200),
    kind: TaskKindSchema,
    /** Délka v pracovních dnech; milník má 0. U fáze se později dopočítá z činností. */
    durationDays: z.number().int().min(0).max(10000),
    /** Omezení „začít nejdříve k datu“ (fáze 4b). */
    constraintStart: IsoDateSchema.optional(),
    dependencies: z.array(DependencySchema),
    percentComplete: z.number().int().min(0).max(100),
    notes: z.string().max(5000),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    /** Řádky zdrojů a nákladů (fáze 6b). */
    lines: z.array(TaskLineSchema).max(200),
    /** Skutečné náklady k datu (fáze 9) – nepovinné, starší soubory je nemají. */
    actuals: z.array(ActualCostSchema).max(MAX_ACTUALS).optional(),
  })
  .refine((t) => t.kind !== 'milestone' || t.durationDays === 0, {
    message: 'milestoneDuration',
    path: ['durationDays'],
  })

export const HolidayRangeSchema = z
  .object({
    start: IsoDateSchema,
    end: IsoDateSchema,
    name: z.string().max(200),
  })
  .refine((r) => r.start <= r.end, { message: 'rangeEndBeforeStart', path: ['end'] })

export const CalendarSchema = z.object({
  /** Pracovní dny v týdnu: 1 = pondělí … 7 = neděle. Aspoň jeden, bez opakování. */
  workingWeekdays: z
    .array(z.number().int().min(1).max(7))
    .min(1)
    .max(7)
    .refine((days) => new Set(days).size === days.length, { message: 'duplicateWeekday' }),
  useCzechHolidays: z.boolean(),
  /** Vlastní volné dny a odstávky (fáze 2). */
  customHolidays: z.array(HolidayRangeSchema),
  /** Státní svátky, které se nemají počítat (fáze 2). */
  removedHolidays: z.array(IsoDateSchema),
})

/** Nejvíc úrovní stromu fází (F-03) – stejné číslo jako MAX_DEPTH v hierarchy.ts. */
export const MAX_TREE_DEPTH = 6


// ---------------------------------------------------------------------------
// Databáze (číselníky) zdrojů – fáze 6a (Z-01, Z-04, R-03). Peníze = celá čísla v haléřích.
// ---------------------------------------------------------------------------

const IdSchema = z.string().min(1).max(100)
const NameSchema = z.string().trim().min(1).max(200)
/** Částka v haléřích: celé nezáporné číslo, nejvýš 10 miliard Kč. */
export const MoneySchema = z.number().int().min(0).max(1_000_000_000_000)
/** Kapacita v hodinách za den (0,5–24). */
const CapacitySchema = z.number().min(0.5).max(24)
const PercentSchema = z.number().min(0).max(100)

export const CategorySchema = z.object({ id: IdSchema, name: NameSchema })

/** Kalkulace hodinové sazby (Z-04) – výpočet v model/rates.ts. */
export const RateCalcSchema = z.object({
  monthlyWage: MoneySchema,
  contributionsPct: PercentSchema,
  overheadMode: z.enum(['annual', 'percent']),
  /** Režie: haléře za rok (annual), nebo % z mzdy (percent, 0–1000). */
  overheadValue: z.number().min(0).max(1_000_000_000_000),
  vacationDays: z.number().int().min(0).max(366),
  sickDays: z.number().int().min(0).max(366),
  hoursPerDay: CapacitySchema,
  productivityPct: PercentSchema,
})

export const ProfessionSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  categoryId: IdSchema,
  capacityPerDay: CapacitySchema,
  rateCalc: RateCalcSchema.optional(),
  /** Ruční hodinová sazba (haléře) – má přednost před kalkulací. */
  manualRate: MoneySchema.optional(),
})

/** Organizační jednotka / středisko – dimenze pro analytiku (náklady a vytížení po střediscích). */
export const DepartmentSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  code: z.string().max(50).optional(),
})

/** Nepřítomnost pracovníka (K-05): dovolená, nemoc… – rozsah dnů včetně obou krajních. */
/**
 * Nejdelší jedna nepřítomnost v kalendářních dnech (včetně obou krajů) – 2 roky.
 * Pojistka proti podvrženému souboru: rozsah „rok 1 – rok 9999“ by výpočty zamrazil.
 * Delší nepřítomnost se zadá jako víc záznamů.
 */
export const MAX_ABSENCE_DAYS = 731

/** Počet kalendářních dnů od–do včetně obou krajů (ISO data, bez časových pásem). */
export function calendarDaysInclusive(start: string, end: string): number {
  const toDay = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
    const date = new Date(Date.UTC(2000, m - 1, d))
    date.setUTCFullYear(y) // i roky 0–99 (Date.UTC by je posunul do 20. století)
    return Math.round(date.getTime() / 86_400_000)
  }
  return toDay(end) - toDay(start) + 1
}

export const AbsenceSchema = z
  .object({
    start: IsoDateSchema,
    end: IsoDateSchema,
    note: z.string().max(200).optional(),
  })
  .refine((a) => a.start <= a.end, { message: 'rangeEndBeforeStart', path: ['end'] })
  .refine((a) => a.start > a.end || calendarDaysInclusive(a.start, a.end) <= MAX_ABSENCE_DAYS, { message: 'absenceTooLong', path: ['end'] })

export const WorkerSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  professionId: IdSchema,
  /** Středisko (nepovinné). */
  departmentId: IdSchema.optional(),
  capacityPerDay: CapacitySchema,
  /** Bez vlastní sazby platí sazba profese. */
  rateCalc: RateCalcSchema.optional(),
  manualRate: MoneySchema.optional(),
  /** Nepřítomnosti (fáze 6c) – ovlivní jen vytížení a varování, termíny se samy nemění. */
  absences: z.array(AbsenceSchema).max(200).optional(),
})

export const MachineSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  categoryId: IdSchema,
  /** Sazba v haléřích za hodinu nebo za den. */
  rate: MoneySchema,
  rateUnit: z.enum(['hour', 'day']),
  capacityPerDay: CapacitySchema,
})

export const MaterialSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  /** Jednotka (ks, kg, m…). */
  unit: z.string().trim().min(1).max(20),
  /** Cena za jednotku v haléřích. */
  unitPrice: MoneySchema,
  categoryId: IdSchema,
  code: z.string().max(50).optional(),
  supplier: z.string().max(200).optional(),
})

/** Číselníky projektu (stejný tvar má i soubor knihovny). */
export const CATALOG_KEYS = ['costCategories', 'departments', 'professions', 'workers', 'machines', 'materials'] as const
export type CatalogKey = (typeof CATALOG_KEYS)[number]

/** Porovnání názvů v číselníku: bez ohledu na velikost písmen a okrajové mezery. */
export const nameKey = (name: string) => name.trim().toLocaleLowerCase('cs')

/**
 * Kontrola číselníků: jedinečná ID a názvy v každém číselníku, odkazy na existující
 * profese a kategorie. Používá ji schéma projektu i soubor knihovny.
 */
export function checkCatalogs(
  data: {
    costCategories: { id: string; name: string }[]
    departments: { id: string; name: string }[]
    professions: { id: string; name: string; categoryId: string }[]
    workers: { id: string; name: string; professionId: string; departmentId?: string }[]
    machines: { id: string; name: string; categoryId: string }[]
    materials: { id: string; name: string; categoryId: string }[]
  },
  ctx: z.RefinementCtx,
): void {
  for (const key of CATALOG_KEYS) {
    const ids = new Set<string>()
    const names = new Set<string>()
    data[key].forEach((item, index) => {
      if (ids.has(item.id)) ctx.addIssue({ code: 'custom', message: 'duplicateId', path: [key, index, 'id'] })
      if (names.has(nameKey(item.name))) ctx.addIssue({ code: 'custom', message: 'duplicateName', path: [key, index, 'name'] })
      ids.add(item.id)
      names.add(nameKey(item.name))
    })
  }
  const categories = new Set(data.costCategories.map((c) => c.id))
  const professions = new Set(data.professions.map((p) => p.id))
  for (const key of ['professions', 'machines', 'materials'] as const) {
    data[key].forEach((item, index) => {
      if (!categories.has(item.categoryId)) {
        ctx.addIssue({ code: 'custom', message: 'unknownCategory', path: [key, index, 'categoryId'] })
      }
    })
  }
  const departments = new Set(data.departments.map((d) => d.id))
  data.workers.forEach((worker, index) => {
    if (!professions.has(worker.professionId)) {
      ctx.addIssue({ code: 'custom', message: 'unknownProfession', path: ['workers', index, 'professionId'] })
    }
    if (worker.departmentId !== undefined && !departments.has(worker.departmentId)) {
      ctx.addIssue({ code: 'custom', message: 'unknownDepartment', path: ['workers', index, 'departmentId'] })
    }
  })
}

/**
 * Kontrola řádků činností: odkazy do databáze, pracovník patří k profesi řádku,
 * milník jen s povolenými typy, jedinečná ID řádků v projektu.
 */
function checkTaskLines(
  project: {
    tasks: { kind: string; lines: z.infer<typeof TaskLineSchema>[] }[]
    costCategories: { id: string }[]
    professions: { id: string }[]
    workers: { id: string; professionId: string }[]
    machines: { id: string }[]
    materials: { id: string }[]
  },
  ctx: z.RefinementCtx,
): void {
  const ids = (items: { id: string }[]) => new Set(items.map((x) => x.id))
  const categories = ids(project.costCategories)
  const professions = ids(project.professions)
  const machines = ids(project.machines)
  const materials = ids(project.materials)
  const workers = new Map(project.workers.map((w) => [w.id, w]))
  const lineIds = new Set<string>()
  project.tasks.forEach((task, taskIndex) => {
    task.lines.forEach((line, lineIndex) => {
      const path = ['tasks', taskIndex, 'lines', lineIndex]
      const issue = (message: string, field: string) => ctx.addIssue({ code: 'custom', message, path: [...path, field] })
      if (lineIds.has(line.id)) issue('duplicateLineId', 'id')
      if (line.tags && new Set(line.tags.map(nameKey)).size !== line.tags.length) issue('duplicateTag', 'tags')
      lineIds.add(line.id)
      if (!categories.has(line.categoryId)) issue('unknownCategory', 'categoryId')
      if (task.kind === 'milestone' && !(MILESTONE_LINE_KINDS as readonly string[]).includes(line.kind)) issue('lineNotAllowed', 'kind')
      if (line.kind === 'labor') {
        if (!professions.has(line.professionId)) issue('unknownProfession', 'professionId')
        if (line.workerId !== undefined) {
          const worker = workers.get(line.workerId)
          if (!worker) issue('unknownWorker', 'workerId')
          else if (worker.professionId !== line.professionId) issue('workerProfessionMismatch', 'workerId')
        }
      }
      if (line.kind === 'machine' && !machines.has(line.machineId)) issue('unknownMachine', 'machineId')
      if (line.kind === 'material' && !materials.has(line.materialId)) issue('unknownMaterial', 'materialId')
    })
  })
}

/** Nejvíc položek v jednom číselníku. */
export const MAX_CATALOG_ITEMS = 2000

/**
 * Uložené pohledy analýzy (fáze 8, A-06): nastavení kontingenční tabulky pod názvem.
 * Dimenze jsou zde jako text (ne import z pivot.ts – zabránilo by to kruhovému importu);
 * test v pivot.test.ts hlídá, že se seznamy shodují.
 */
export const VIEW_FACT_DIMS = ['phase', 'task', 'category', 'tag', 'kind', 'resource', 'profession', 'department'] as const
export const VIEW_DIMS = [...VIEW_FACT_DIMS, 'period'] as const
/** Nejvíc uložených pohledů v projektu. */
export const MAX_VIEWS = 50

export const PivotConfigSchema = z.object({
  rows: z.array(z.enum(VIEW_DIMS)).min(1).max(2),
  column: z.enum(VIEW_DIMS).nullable(),
  metric: z.enum(['cost', 'hours']),
  agg: z.enum(['sum', 'avg', 'count', 'min', 'max']),
  period: z.enum(['week', 'month', 'quarter']),
  filters: z.partialRecord(z.enum(VIEW_FACT_DIMS), z.array(z.string().max(200)).max(MAX_CATALOG_ITEMS)),
})

export const SavedViewSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(100),
  config: PivotConfigSchema,
})

/** Nejvíc uzlů myšlenkové mapy (fáze 12, MM-01) – ochrana proti „nafouknutému“ souboru. */
export const MAX_MIND_MAP_NODES = 500
/** Nejvíc úrovní pod středním tématem (= limit stromu plánu, MAX_TREE_DEPTH). */
export const MAX_MIND_MAP_DEPTH = 6
export const MAX_MIND_MAP_TEXT = 200

export const MindMapNodeSchema = z.object({
  id: IdSchema,
  /** null = střední téma (kořen). */
  parentId: IdSchema.nullable(),
  /** Pořadí mezi sourozenci (0, 1, 2…). */
  order: z.number().int().min(0).max(MAX_MIND_MAP_NODES),
  text: z.string().trim().min(1).max(MAX_MIND_MAP_TEXT),
  /** Sbalená větev (podřízené uzly se nekreslí). */
  collapsed: z.boolean().optional(),
})

/**
 * Myšlenková mapa (fáze 12, MM-01): plochý seznam uzlů, strom přes parentId + pořadí.
 * Právě jeden kořen, rodiče existují, žádný kruh, nejvýš MAX_MIND_MAP_DEPTH úrovní pod kořenem.
 */
export const MindMapSchema = z
  .object({ nodes: z.array(MindMapNodeSchema).min(1).max(MAX_MIND_MAP_NODES) })
  .superRefine((map, ctx) => {
    const byId = new Map<string, { parentId: string | null }>()
    map.nodes.forEach((node, index) => {
      if (byId.has(node.id)) ctx.addIssue({ code: 'custom', message: 'duplicateNodeId', path: ['nodes', index, 'id'] })
      byId.set(node.id, node)
    })
    if (map.nodes.filter((n) => n.parentId === null).length !== 1) ctx.addIssue({ code: 'custom', message: 'rootCount', path: ['nodes'] })
    map.nodes.forEach((node, index) => {
      if (node.parentId !== null && !byId.has(node.parentId)) {
        ctx.addIssue({ code: 'custom', message: 'unknownParent', path: ['nodes', index, 'parentId'] })
        return
      }
      // Cesta ke kořeni: kruh, nebo příliš hluboko.
      const seen = new Set<string>([node.id])
      let depth = 0
      for (let p = node.parentId; p !== null; p = byId.get(p)?.parentId ?? null) {
        if (seen.has(p) || !byId.has(p)) {
          ctx.addIssue({ code: 'custom', message: 'parentCycle', path: ['nodes', index, 'parentId'] })
          return
        }
        seen.add(p)
        depth++
      }
      if (depth > MAX_MIND_MAP_DEPTH) ctx.addIssue({ code: 'custom', message: 'tooDeep', path: ['nodes', index, 'parentId'] })
    })
  })

/** Limit rozpočtu v haléřích: kladné celé číslo (fáze 7, R-06). */
const LimitSchema = z.number().int().min(1).max(1_000_000_000_000)

/** Limity rozpočtu: celého projektu a volitelně jednotlivých kategorií nákladů. */
export const BudgetSchema = z.object({
  limit: LimitSchema.optional(),
  categoryLimits: z.array(z.object({ categoryId: IdSchema, limit: LimitSchema })).max(MAX_CATALOG_ITEMS).default([]),
})

// ---------------------------------------------------------------------------
// Baseline – uložený snímek plánu ke srovnání (fáze 9, G-08, A-05).
// ---------------------------------------------------------------------------

/** Nejvíc baseline v projektu. */
export const MAX_BASELINES = 10
/** Nejdelší náběh nákladů jedné položky v baseline (dny, ≈ 10 let). */
export const MAX_BASELINE_DAYS = 3660
/** Nejvíc čísel náběhu v jedné baseline dohromady (ochrana proti obřím souborům). */
export const MAX_BASELINE_COSTS = 500_000

/** Položka plánu v okamžiku uložení baseline: termíny, délka a plánovaný náklad po dnech. */
export const BaselineTaskSchema = z
  .object({
    taskId: IdSchema,
    parentId: IdSchema.nullable(),
    /** Název v okamžiku uložení – ukáže se, i když činnost mezitím zmizí z plánu. */
    name: z.string().max(200),
    kind: TaskKindSchema,
    start: IsoDateSchema,
    finish: IsoDateSchema,
    durationDays: z.number().int().min(0).max(10000),
    /** První den náběhu nákladů (může ležet mimo termín – jednorázový náklad k datu). */
    costStart: IsoDateSchema.optional(),
    /** Plánovaný náklad po dnech od costStart (haléře) – jen vlastní řádky položky; fáze sčítá své podřízené. */
    costs: z.array(MoneySchema).max(MAX_BASELINE_DAYS),
  })
  .refine((t) => t.start <= t.finish, { message: 'rangeEndBeforeStart', path: ['finish'] })
  .refine((t) => t.costs.length === 0 || t.costStart !== undefined, { message: 'missingCostStart', path: ['costStart'] })

export const BaselineSchema = z
  .object({
    id: IdSchema,
    name: z.string().trim().min(1).max(100),
    /** Den uložení. */
    savedAt: IsoDateSchema,
    tasks: z.array(BaselineTaskSchema).max(5000),
  })
  .superRefine((baseline, ctx) => {
    const ids = new Set<string>()
    let costs = 0
    baseline.tasks.forEach((t, index) => {
      if (ids.has(t.taskId)) ctx.addIssue({ code: 'custom', message: 'duplicateTaskId', path: ['tasks', index, 'taskId'] })
      ids.add(t.taskId)
      costs += t.costs.length
    })
    if (costs > MAX_BASELINE_COSTS) ctx.addIssue({ code: 'custom', message: 'baselineTooLarge', path: ['tasks'] })
  })

export const ProjectSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    name: z.string().trim().min(1).max(200),
    startDate: IsoDateSchema,
    /** Kód měny ISO 4217, např. "CZK". */
    currency: z.string().regex(/^[A-Z]{3}$/),
    /** Jazyk obsahu projektu (názvy činností). Jazyk ovládání si pamatuje prohlížeč zvlášť. */
    language: z.string().min(2).max(10),
    calendar: CalendarSchema,
    tasks: z.array(TaskSchema).max(5000),
    costCategories: z.array(CategorySchema).max(MAX_CATALOG_ITEMS),
    /** Střediska přibyla až během fáze 6a – rozpracované soubory verze 2 je nemají, proto výchozí []. */
    departments: z.array(DepartmentSchema).max(MAX_CATALOG_ITEMS).default([]),
    professions: z.array(ProfessionSchema).max(MAX_CATALOG_ITEMS),
    workers: z.array(WorkerSchema).max(MAX_CATALOG_ITEMS),
    machines: z.array(MachineSchema).max(MAX_CATALOG_ITEMS),
    materials: z.array(MaterialSchema).max(MAX_CATALOG_ITEMS),
    /** Uložené baseline (fáze 9); starší soubory mají []. */
    baselines: z.array(BaselineSchema).max(MAX_BASELINES),
    /** Baseline vybraná ke srovnání (fáze 9). */
    activeBaselineId: IdSchema.optional(),
    /** Datum stavu pro Earned Value (fáze 9); chybí = dnes. */
    statusDate: IsoDateSchema.optional(),
    /** Limity rozpočtu (fáze 7) – nepovinné, starší soubory je nemají. */
    budget: BudgetSchema.optional(),
    /** Uložené pohledy analýzy (fáze 8) – nepovinné. */
    views: z.array(SavedViewSchema).max(MAX_VIEWS).optional(),
    /** Myšlenková mapa (fáze 12) – nepovinná, starší soubory ji nemají. */
    mindMap: MindMapSchema.optional(),
  })
  .superRefine((project, ctx) => {
    checkCatalogs(project, ctx)
    if (project.activeBaselineId !== undefined && !project.baselines.some((b) => b.id === project.activeBaselineId)) {
      ctx.addIssue({ code: 'custom', message: 'unknownBaseline', path: ['activeBaselineId'] })
    }
    checkTaskLines(project, ctx)
    // Limit kategorie míří na existující kategorii a každá kategorie má nejvýš jeden limit.
    const categoryIds = new Set(project.costCategories.map((c) => c.id))
    const limited = new Set<string>()
    project.budget?.categoryLimits.forEach((item, index) => {
      const path = ['budget', 'categoryLimits', index, 'categoryId']
      if (!categoryIds.has(item.categoryId)) ctx.addIssue({ code: 'custom', message: 'unknownCategory', path })
      if (limited.has(item.categoryId)) ctx.addIssue({ code: 'custom', message: 'duplicateCategoryLimit', path })
      limited.add(item.categoryId)
    })
    // Každá činnost musí mít jedinečné ID a odkazy musí mířit na existující činnosti.
    const ids = new Set<string>()
    project.tasks.forEach((task, index) => {
      if (ids.has(task.id)) {
        ctx.addIssue({ code: 'custom', message: 'duplicateTaskId', path: ['tasks', index, 'id'] })
      }
      ids.add(task.id)
    })
    const byId = new Map(project.tasks.map((t) => [t.id, t]))
    project.tasks.forEach((task, index) => {
      if (task.parentId !== null && !ids.has(task.parentId)) {
        ctx.addIssue({ code: 'custom', message: 'unknownParent', path: ['tasks', index, 'parentId'] })
      }
      // Strom (fáze 5 – soubor zvenku): podřízené má jen fáze, žádný kruh, nejvýš MAX_TREE_DEPTH úrovní.
      const parent = task.parentId !== null ? byId.get(task.parentId) : undefined
      if (parent && parent.kind !== 'phase') {
        ctx.addIssue({ code: 'custom', message: 'parentNotPhase', path: ['tasks', index, 'parentId'] })
      }
      const chain = new Set<string>([task.id])
      let depth = 0
      for (let p = parent; p; p = p.parentId !== null ? byId.get(p.parentId) : undefined) {
        if (chain.has(p.id)) {
          ctx.addIssue({ code: 'custom', message: 'parentCycle', path: ['tasks', index, 'parentId'] })
          break
        }
        chain.add(p.id)
        depth++
      }
      if (depth >= MAX_TREE_DEPTH) {
        ctx.addIssue({ code: 'custom', message: 'tooDeep', path: ['tasks', index, 'parentId'] })
      }

      const seen = new Set<string>()
      task.dependencies.forEach((dep, depIndex) => {
        const path = ['tasks', index, 'dependencies', depIndex, 'predecessorId']
        const predecessor = byId.get(dep.predecessorId)
        if (!predecessor) ctx.addIssue({ code: 'custom', message: 'unknownPredecessor', path })
        else if (dep.predecessorId === task.id) ctx.addIssue({ code: 'custom', message: 'selfDependency', path })
        else if (predecessor.kind === 'phase' || task.kind === 'phase') {
          // Fáze zatím vazby nemají (ani jako předchůdce, ani jako následník).
          ctx.addIssue({ code: 'custom', message: 'phaseDependency', path })
        }
        if (seen.has(dep.predecessorId)) ctx.addIssue({ code: 'custom', message: 'duplicateDependency', path })
        seen.add(dep.predecessorId)
      })
    })
  })

export type DependencyType = z.infer<typeof DependencyTypeSchema>
export type Dependency = z.infer<typeof DependencySchema>
export type TaskKind = z.infer<typeof TaskKindSchema>
export type Task = z.infer<typeof TaskSchema>
export type TaskLine = z.infer<typeof TaskLineSchema>
export type TaskLineKind = TaskLine['kind']
export type Calendar = z.infer<typeof CalendarSchema>
export type Project = z.infer<typeof ProjectSchema>
export type Category = z.infer<typeof CategorySchema>
export type RateCalcData = z.infer<typeof RateCalcSchema>
export type Profession = z.infer<typeof ProfessionSchema>
export type Worker = z.infer<typeof WorkerSchema>
export type Department = z.infer<typeof DepartmentSchema>
export type Absence = z.infer<typeof AbsenceSchema>
export type SavedView = z.infer<typeof SavedViewSchema>
export type MindMap = z.infer<typeof MindMapSchema>
export type MindMapNode = z.infer<typeof MindMapNodeSchema>
export type Baseline = z.infer<typeof BaselineSchema>
export type BaselineTask = z.infer<typeof BaselineTaskSchema>
export type ActualCost = z.infer<typeof ActualCostSchema>
export type Machine = z.infer<typeof MachineSchema>
export type Material = z.infer<typeof MaterialSchema>

export const TASK_KINDS: TaskKind[] = ['task', 'phase', 'milestone']

export function createDefaultCalendar(): Calendar {
  return {
    workingWeekdays: [1, 2, 3, 4, 5],
    useCzechHolidays: true,
    customHolidays: [],
    removedHolidays: [],
  }
}

/** Nový prázdný projekt s rozumnými výchozími hodnotami (U-05). */
export function createEmptyProject(options: { name: string; language: string; startDate?: string }): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: options.name,
    startDate: options.startDate ?? todayIso(),
    currency: 'CZK',
    language: options.language,
    calendar: createDefaultCalendar(),
    tasks: [],
    costCategories: createDefaultCategories(options.language),
    departments: [],
    professions: [],
    workers: [],
    machines: [],
    materials: [],
    baselines: [],
  }
}

/** Nová činnost s výchozími hodnotami. */
export function createTask(options: { id: string; name: string; order: number; kind?: TaskKind; durationDays?: number }): Task {
  const kind = options.kind ?? 'task'
  return {
    id: options.id,
    parentId: null,
    order: options.order,
    name: options.name,
    kind,
    durationDays: kind === 'milestone' ? 0 : (options.durationDays ?? 1),
    dependencies: [],
    percentComplete: 0,
    notes: '',
    lines: [],
  }
}
