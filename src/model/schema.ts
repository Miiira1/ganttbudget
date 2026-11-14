/**
 * Formát projektu popsaný knihovnou Zod (ZADANI.md, kap. 7).
 *
 * Schéma slouží ke dvěma věcem:
 *  1. Kontrola dat – každý načítaný soubor (JSON, CSV, XLSX, výstup z AI) se jím ověří,
 *     než se použije. Neplatná data se nepoužijí ani částečně.
 *  2. Typy TypeScriptu – typy Project, Task… vznikají přímo ze schématu, takže nemůžou
 *     se schématem „rozjet“.
 *
 * Při každé nezpětně slučitelné změně formátu se zvýší SCHEMA_VERSION.
 */
import { z } from 'zod'
import { isValidIsoDate, todayIso } from './dates'

export const SCHEMA_VERSION = 1

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

export const AssignmentSchema = z.object({
  resourceId: z.string().min(1),
  /** Podíl úvazku 0–1 (0,5 = 50 %). Používá se od fáze 6. */
  share: z.number().min(0).max(1),
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
    assignments: z.array(AssignmentSchema),
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

/**
 * Části, které přijdou v pozdějších fázích (zdroje 6, rozpočet 7, baseline 9).
 * Zatím musí být prázdné – z.never() nepustí žádnou položku. Upřesní se v dané fázi.
 */
const futureList = z.array(z.never())

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
    resources: futureList,
    costCategories: futureList,
    costItems: futureList,
    baselines: futureList,
  })
  .superRefine((project, ctx) => {
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
export type Calendar = z.infer<typeof CalendarSchema>
export type Project = z.infer<typeof ProjectSchema>

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
    resources: [],
    costCategories: [],
    costItems: [],
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
    assignments: [],
  }
}
