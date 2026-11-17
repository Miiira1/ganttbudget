/**
 * Společný „stavitel“ šablon projektů (U-02, fáze 10).
 *
 * Šablona je jen popis dat (TemplateDef): řádky plánu, databáze zdrojů a řádky nákladů.
 * buildTemplate z něj vyrobí kompletní projekt ke zvolenému datu začátku. Všechny názvy
 * jsou v překladech pod klíčem `keyPrefix` (projectName, tasks.*, resources.*, lines.*),
 * takže šablona jde vytvořit v každém jazyce. Jména lidí jsou smyšlená a nepřekládají se.
 * Peníze se zadávají v Kč (čitelnost) a převádějí se na haléře.
 *
 * Hierarchie: fáze je na nejvyšší úrovni, ostatní položky patří do poslední fáze nad nimi.
 */
import { defaultCategoryId, type DefaultCategoryKey } from '../model/defaultCategories'
import { createDefaultRateCalc, type RateCalc } from '../model/rates'
import { createEmptyProject, createTask, type DependencyType, type Project, type TaskKind, type TaskLine } from '../model/schema'

/** [klíč, typ, délka v pracovních dnech, předchůdci jako [klíč, prodleva, typ vazby (výchozí FS)]] */
export type TemplateRow = [key: string, kind: TaskKind, durationDays: number, predecessors?: [string, number, DependencyType?][]]

/** Kalkulace sazby: hrubá měsíční mzda v Kč a režie v % z mzdy. */
export type TemplateCalc = { wageKc: number; overheadPct: number }

export interface TemplateProfession {
  key: string
  category: DefaultCategoryKey
  capacityPerDay: number
  calc?: TemplateCalc
  /** Ruční sazba v Kč/h (např. fakturovaná sazba dodavatele). */
  manualRateKc?: number
}

export interface TemplateWorker {
  key: string
  name: string
  profession: string
  department?: string
  capacityPerDay: number
  calc?: TemplateCalc
  manualRateKc?: number
}

export interface TemplateMachine {
  key: string
  category: DefaultCategoryKey
  rateKc: number
  rateUnit: 'hour' | 'day'
  capacityPerDay: number
}

/** [klíč, klíč jednotky (resources.units.*), cena v Kč, kód] */
export type TemplateMaterial = [key: string, unit: string, priceKc: number, code?: string]

/**
 * Zápis řádku nákladu:
 *  ['labor', profese, pracovník | null, %] · ['machine', stroj, %] · ['material', materiál, množství]
 *  ['oneTime', klíč názvu, Kč, kdy, kategorie] · ['recurring', klíč názvu, Kč, období]
 */
export type TemplateLine =
  | ['labor', string, string | null, number]
  | ['machine', string, number]
  | ['material', string, number]
  | ['oneTime', string, number, 'start' | 'end', DefaultCategoryKey]
  | ['recurring', string, number, 'day' | 'week' | 'month']

export interface TemplateDef {
  /** Kořen překladů šablony, např. "sample" nebo "templates.productDevelopment". */
  keyPrefix: string
  /** Předpona ID všech položek (aby se ID různých šablon nepletla). */
  idPrefix: string
  rows: TemplateRow[]
  /** [klíč, kód střediska] */
  departments: [key: string, code: string][]
  professions: TemplateProfession[]
  workers: TemplateWorker[]
  machines: TemplateMachine[]
  materials: TemplateMaterial[]
  /** Řádky nákladů podle klíče položky. */
  lines: Record<string, TemplateLine[]>
}

const calc = (c: TemplateCalc): RateCalc => ({
  ...createDefaultRateCalc(),
  monthlyWage: c.wageKc * 100,
  overheadMode: 'percent',
  overheadValue: c.overheadPct,
})

const kc = (value: number) => Math.round(value * 100)

/** Sazba: ruční, nebo kalkulace (aspoň jedno z nich; pracovník smí mít i nic = sazba profese). */
function rateOf(item: { calc?: TemplateCalc; manualRateKc?: number }) {
  return {
    ...(item.calc ? { rateCalc: calc(item.calc) } : {}),
    ...(item.manualRateKc !== undefined ? { manualRate: kc(item.manualRateKc) } : {}),
  }
}

/** Vytvoří projekt podle šablony. ID: `${idPrefix}-${klíč}`, zdroje `${idPrefix}-pr-…`, `-w…` atd. */
export function buildTemplate(def: TemplateDef, translate: (key: string) => string, language: string, startDate?: string): Project {
  const p = def.idPrefix
  const text = (key: string) => translate(`${def.keyPrefix}.${key}`)
  const res = (key: string) => text(`resources.${key}`)
  const ids = {
    task: (key: string) => `${p}-${key}`,
    department: (key: string) => `${p}-d-${key}`,
    profession: (key: string) => `${p}-pr-${key}`,
    worker: (key: string) => `${p}-${key}`,
    machine: (key: string) => `${p}-m-${key}`,
    material: (key: string) => `${p}-x-${key}`,
  }

  const project = createEmptyProject({ name: text('projectName'), language, startDate })

  // Plán: fáze a položky v nich.
  let phaseId: string | null = null
  const counters = new Map<string | null, number>()
  project.tasks = def.rows.map(([key, kind, durationDays, predecessors = []]) => {
    const parentId = kind === 'phase' ? null : phaseId
    if (kind === 'phase') phaseId = ids.task(key)
    const order = counters.get(parentId) ?? 0
    counters.set(parentId, order + 1)
    return {
      ...createTask({ id: ids.task(key), name: text(`tasks.${key}`), order, kind, durationDays }),
      parentId,
      dependencies: predecessors.map(([pred, lagDays, type = 'FS']) => ({ predecessorId: ids.task(pred), type, lagDays })),
    }
  })

  // Databáze zdrojů.
  project.departments = def.departments.map(([key, code]) => ({ id: ids.department(key), name: res(`departments.${key}`), code }))
  project.professions = def.professions.map((x) => ({
    id: ids.profession(x.key),
    name: res(`professions.${x.key}`),
    categoryId: defaultCategoryId(x.category),
    capacityPerDay: x.capacityPerDay,
    ...rateOf(x),
  }))
  project.workers = def.workers.map((w) => ({
    id: ids.worker(w.key),
    name: w.name,
    professionId: ids.profession(w.profession),
    ...(w.department ? { departmentId: ids.department(w.department) } : {}),
    capacityPerDay: w.capacityPerDay,
    ...rateOf(w),
  }))
  project.machines = def.machines.map((m) => ({
    id: ids.machine(m.key),
    name: res(`machines.${m.key}`),
    categoryId: defaultCategoryId(m.category),
    rate: kc(m.rateKc),
    rateUnit: m.rateUnit,
    capacityPerDay: m.capacityPerDay,
  }))
  project.materials = def.materials.map(([key, unit, priceKc, code]) => ({
    id: ids.material(key),
    name: res(`materials.${key}`),
    unit: res(`units.${unit}`),
    unitPrice: kc(priceKc),
    categoryId: defaultCategoryId('material'),
    ...(code ? { code } : {}),
  }))

  // Řádky nákladů: kategorie člověka a stroje se přebírá z databáze (jako při ručním zadání).
  const categoryOf = (catalog: { id: string; categoryId: string }[], id: string) => catalog.find((x) => x.id === id)?.categoryId ?? defaultCategoryId('services')
  project.tasks = project.tasks.map((task) => {
    const key = task.id.slice(p.length + 1)
    const lines: TaskLine[] = (def.lines[key] ?? []).map((spec, i): TaskLine => {
      const id = `${p}-l-${key}-${i + 1}`
      switch (spec[0]) {
        case 'labor': {
          const professionId = ids.profession(spec[1])
          return {
            id,
            kind: 'labor',
            categoryId: categoryOf(project.professions, professionId),
            professionId,
            ...(spec[2] ? { workerId: ids.worker(spec[2]) } : {}),
            sharePct: spec[3],
          }
        }
        case 'machine': {
          const machineId = ids.machine(spec[1])
          return { id, kind: 'machine', categoryId: categoryOf(project.machines, machineId), machineId, sharePct: spec[2] }
        }
        case 'material': {
          const materialId = ids.material(spec[1])
          return { id, kind: 'material', categoryId: categoryOf(project.materials, materialId), materialId, quantity: spec[2] }
        }
        case 'oneTime':
          return { id, kind: 'oneTime', categoryId: defaultCategoryId(spec[4]), name: text(`lines.${spec[1]}`), amount: kc(spec[2]), timing: spec[3] }
        case 'recurring':
          return { id, kind: 'recurring', categoryId: defaultCategoryId('services'), name: text(`lines.${spec[1]}`), amount: kc(spec[2]), period: spec[3] }
      }
    })
    return lines.length > 0 ? { ...task, lines } : task
  })
  return project
}
