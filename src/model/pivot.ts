/**
 * Kontingenční tabulka (fáze 8, A-01) – čistá funkce nad fakty (facts.ts), testy v pivot.test.ts.
 *
 * Uživatel volí 1–2 dimenze řádků, nejvýš 1 dimenzi sloupců, metriku (náklad / hodiny),
 * agregaci (součet, průměr na řádek činnosti, počet řádků, minimum, maximum), velikost období
 * a filtry s více volbami. Vlastní jednoduchá implementace (ZADANI kap. 6), bez knihovny.
 *
 * Pravidla:
 *  - „Řádek“ agregace = řádek činnosti (zdroj nebo náklad). Bez dimenze období se do buňky
 *    započte každý vyhovující řádek (i s nulou); s obdobím jen ty, které v něm mají hodnotu.
 *  - Štítky: řádek se dvěma štítky je v obou skupinách, ale v součtech přes štítky se počítá
 *    jednou (součty se počítají zvlášť, ne sečtením skupin).
 *  - Chybějící hodnota dimenze (bez štítku, bez střediska…) = klíč NONE („(neuvedeno)“).
 */
import { KIND_ORDER, rootsOf } from './costTimeline'
import type { Facts, LineFact } from './facts'
import { treeOrder } from './hierarchy'
import { splitPeriods, type DayRange } from './periods'
import type { Project } from './schema'

/** Klíč „(neuvedeno)“ – řádek nemá hodnotu dimenze. */
export const NONE = '∅'

export const FACT_DIMS = ['phase', 'task', 'category', 'tag', 'kind', 'resource', 'profession', 'department'] as const
export type FactDim = (typeof FACT_DIMS)[number]
export const PIVOT_DIMS = [...FACT_DIMS, 'period'] as const
export type PivotDim = (typeof PIVOT_DIMS)[number]
export type PivotMetric = 'cost' | 'hours'
export type PivotAgg = 'sum' | 'avg' | 'count' | 'min' | 'max'
export type PivotPeriod = 'week' | 'month' | 'quarter'

export interface PivotConfig {
  /** 1–2 dimenze řádků (druhá = vnořená). */
  rows: PivotDim[]
  /** Dimenze sloupců, nebo žádná. */
  column: PivotDim | null
  metric: PivotMetric
  agg: PivotAgg
  /** Velikost období pro dimenzi „period“. */
  period: PivotPeriod
  /** Filtry s více volbami; prázdný nebo chybějící seznam = bez omezení. */
  filters: Partial<Record<FactDim, string[]>>
}

export interface PivotRow {
  /** Klíče od první úrovně (délka 1 nebo 2). */
  path: string[]
}

export interface PivotResult {
  /** Řádky v pořadí zobrazení; u dvou úrovní vždy skupina a hned pod ní její podřádky. */
  rows: PivotRow[]
  columns: { key: string }[]
  /** Období (jen když je dimenze „period“ použitá) – klíč období = String(startDay). */
  periods: DayRange[]
  /** Hodnota buňky; path null = celkem přes řádky, column null = celkem přes sloupce. null = žádná data. */
  value: (path: string[] | null, column: string | null) => number | null
  /** Některý řádek činnosti je ve víc skupinách (štítky) – součty skupin nejsou součtem celku. */
  tagDuplicates: boolean
}

/** Klíče dimenze pro jeden řádek činnosti (štítků může být víc). */
function keysOf(line: LineFact, dim: FactDim): string[] {
  switch (dim) {
    case 'phase':
      return [line.rootId]
    case 'task':
      return [line.taskId]
    case 'category':
      return [line.categoryId]
    case 'tag':
      return line.tags.length > 0 ? line.tags : [NONE]
    case 'kind':
      return [line.kind]
    case 'resource':
      return [line.resource]
    case 'profession':
      return [line.professionId ?? NONE]
    case 'department':
      return [line.departmentId ?? NONE]
  }
}

/** Pořadí klíčů dimenze: jako v projektu (databáze, plán), štítky a názvy podle abecedy, NONE na konci. */
function sorter(project: Project, dim: PivotDim): (a: string, b: string) => number {
  const indexOf = (list: readonly string[]) => {
    const map = new Map(list.map((k, i) => [k, i]))
    return (k: string) => map.get(k) ?? Number.MAX_SAFE_INTEGER
  }
  let rank: (k: string) => number | string
  switch (dim) {
    case 'phase':
      rank = indexOf(rootsOf(project).order)
      break
    case 'task':
      rank = indexOf(treeOrder(project).map((t) => t.id))
      break
    case 'category':
      rank = indexOf(project.costCategories.map((c) => c.id))
      break
    case 'kind':
      rank = indexOf(KIND_ORDER)
      break
    case 'profession':
      rank = indexOf(project.professions.map((p) => p.id))
      break
    case 'department':
      rank = indexOf(project.departments.map((d) => d.id))
      break
    case 'resource': {
      const order = indexOf([
        ...project.workers.map((w) => `worker:${w.id}`),
        ...project.professions.map((p) => `profession:${p.id}`),
        ...project.machines.map((m) => `machine:${m.id}`),
        ...project.materials.map((m) => `material:${m.id}`),
      ])
      rank = (k) => (k.startsWith('name:') ? `~${k}` : order(k))
      break
    }
    case 'period':
      rank = (k) => Number(k)
      break
    default:
      rank = (k) => k
  }
  return (a, b) => {
    if (a === NONE || b === NONE) return a === b ? 0 : a === NONE ? 1 : -1
    const ra = rank(a)
    const rb = rank(b)
    if (typeof ra === 'number' && typeof rb === 'number') return ra - rb
    if (typeof ra === 'number') return -1
    if (typeof rb === 'number') return 1
    return ra.localeCompare(rb, 'cs')
  }
}

const SEP = '\u0001'

export function pivot(project: Project, facts: Facts, config: PivotConfig): PivotResult {
  const rowDims = config.rows.slice(0, 2)
  const columnDim = config.column
  const usesPeriod = rowDims.includes('period') || columnDim === 'period'
  const periods = usesPeriod && facts.range ? splitPeriods(facts.range, config.period) : []
  // Den → index období (v rozsahu faktů).
  const range = facts.range
  const periodOfDay = new Int32Array(range ? range.endDay - range.startDay + 1 : 0).fill(-1)
  if (range) periods.forEach((p, i) => periodOfDay.fill(i, p.startDay - range.startDay, p.endDay - range.startDay + 1))

  // Filtry (prázdný seznam = bez omezení).
  const filters = Object.entries(config.filters)
    .filter(([, values]) => values && values.length > 0)
    .map(([dim, values]) => ({ dim: dim as FactDim, values: new Set(values) }))
  const lines = facts.lines.filter((line) => filters.every((f) => keysOf(line, f.dim).some((k) => f.values.has(k))))

  // Hodnota řádku činnosti po obdobích (index → hodnota).
  const perPeriod = (line: LineFact): Map<number, number> => {
    const out = new Map<number, number>()
    if (!range) return out
    const [start, values] = config.metric === 'cost' ? [line.costStart, line.cost] : [line.hoursStart, line.hours]
    values.forEach((v, i) => {
      if (v === 0) return
      const p = periodOfDay[start + i - range.startDay] ?? -1
      if (p >= 0) out.set(p, (out.get(p) ?? 0) + v)
    })
    return out
  }

  // Všechny kombinace dimenzí, které tabulka potřebuje (buňky, mezisoučty, součty).
  const signatures: PivotDim[][] = []
  const rowPrefixes = rowDims.map((_, i) => rowDims.slice(0, i + 1))
  for (const prefix of [[], ...rowPrefixes]) {
    signatures.push(prefix)
    if (columnDim) signatures.push([...prefix, columnDim])
  }
  // klíč podpisu → klíč buňky → (řádek činnosti → hodnota)
  const acc = new Map<string, Map<string, Map<string, number>>>()
  for (const sig of signatures) acc.set(sig.join(','), new Map())

  const usedDims = [...new Set([...rowDims, ...(columnDim ? [columnDim] : [])])].filter((d): d is FactDim => d !== 'period')
  for (const line of lines) {
    const total = config.metric === 'cost' ? line.totalCost : line.totalHours
    const byPeriod = usesPeriod ? perPeriod(line) : null
    // Klíče dimenzí řádku se zjistí jen jednou (použijí se pro všechny součty).
    const lineKeys = new Map(usedDims.map((d) => [d, keysOf(line, d)]))
    for (const sig of signatures) {
      const target = acc.get(sig.join(','))!
      const sigUsesPeriod = sig.includes('period')
      // Kombinace klíčů (kartézský součin) – s obdobím jen období s hodnotou.
      let combos: { keys: string[]; value: number }[] = [{ keys: [], value: total }]
      for (const dim of sig) {
        const next: typeof combos = []
        for (const combo of combos) {
          if (dim === 'period') {
            for (const [p, v] of byPeriod!) next.push({ keys: [...combo.keys, String(periods[p]!.startDay)], value: v })
          } else {
            for (const k of lineKeys.get(dim)!) next.push({ keys: [...combo.keys, k], value: combo.value })
          }
        }
        combos = next
      }
      if (!sigUsesPeriod && usesPeriod && byPeriod && byPeriod.size === 0 && total === 0) {
        // Řádek bez hodnoty v žádném období se nezapočte ani do součtů (aby součty odpovídaly buňkám).
        continue
      }
      for (const combo of combos) {
        const key = combo.keys.join(SEP)
        let cell = target.get(key)
        if (!cell) target.set(key, (cell = new Map()))
        cell.set(line.lineId, (cell.get(line.lineId) ?? 0) + combo.value)
      }
    }
  }

  const finalize = (cell: Map<string, number> | undefined): number | null => {
    if (!cell || cell.size === 0) return null
    const values = [...cell.values()]
    const sum = values.reduce((a, b) => a + b, 0)
    switch (config.agg) {
      case 'sum':
        return sum
      case 'count':
        return values.length
      case 'avg':
        return sum / values.length
      case 'min':
        return Math.min(...values)
      case 'max':
        return Math.max(...values)
    }
  }

  const value = (path: string[] | null, column: string | null): number | null => {
    const keys = path ?? []
    const sig = [...rowDims.slice(0, keys.length), ...(column !== null && columnDim ? [columnDim] : [])]
    const target = acc.get(sig.join(','))
    return finalize(target?.get([...keys, ...(column !== null && columnDim ? [column] : [])].join(SEP)))
  }

  // Řádky a sloupce v pořadí.
  const keysAt = (sig: PivotDim[]) => [...(acc.get(sig.join(','))?.keys() ?? [])].map((k) => k.split(SEP))
  const rows: PivotRow[] = []
  if (rowDims.length > 0) {
    const firstSort = sorter(project, rowDims[0]!)
    const first = keysAt([rowDims[0]!])
      .map((k) => k[0]!)
      .sort(firstSort)
    if (rowDims.length === 1) for (const k of first) rows.push({ path: [k] })
    else {
      const secondSort = sorter(project, rowDims[1]!)
      const pairs = keysAt(rowDims)
      for (const k of first) {
        rows.push({ path: [k] })
        pairs
          .filter((p) => p[0] === k)
          .map((p) => p[1]!)
          .sort(secondSort)
          .forEach((k2) => rows.push({ path: [k, k2] }))
      }
    }
  }
  const columns = columnDim
    ? keysAt([columnDim])
        .map((k) => k[0]!)
        .sort(sorter(project, columnDim))
        .map((key) => ({ key }))
    : []

  const tagDuplicates = (rowDims.includes('tag') || columnDim === 'tag') && lines.some((l) => l.tags.length > 1)
  return { rows, columns, periods, value, tagDuplicates }
}

/** Všechny klíče dimenze ve faktech (pro filtry) v pořadí projektu; NONE na konci. */
export function dimensionKeys(project: Project, facts: Facts, dim: FactDim): string[] {
  const keys = new Set<string>()
  for (const line of facts.lines) for (const k of keysOf(line, dim)) keys.add(k)
  return [...keys].sort(sorter(project, dim))
}
