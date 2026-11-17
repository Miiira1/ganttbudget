/**
 * Import činností z CSV/XLSX (I-03, N-10) – čisté funkce, testy v tableImport.test.ts.
 *
 * Vstup je tabulka (první řádek = hlavička) z readCsv nebo readXlsx. Kontrola probíhá ve vrstvách
 * a zastaví se na první vrstvě s chybou (chyby se tak nevrší jedna na druhou):
 *   1. hlavička a jednotlivé řádky (název, typ, délka, datum, procenta, zápis předchůdců),
 *   2. hierarchie (sloupec Úroveň + pořadí řádků; podřízené jen pod fází),
 *   3. předchůdci (čísla ze sloupce Č.; fáze vazby nemají),
 *   4. kruhy ve vazbách (plánovací jádro),
 *   5. celý projekt ještě jednou schématem Zod.
 * Neplatná data se nepoužijí ani částečně – buď celý nový seznam činností, nebo seznam chyb
 * s čísly řádků v souboru. Hlavičky a typy se přijmou česky i anglicky.
 */
import Papa from 'papaparse'
import { z } from 'zod'
import { schedule } from '../engine/schedule'
import cs from '../i18n/locales/cs.json'
import en from '../i18n/locales/en.json'
import { isValidIsoDate } from '../model/dates'
import { wbsNumbers } from '../model/hierarchy'
import { parsePredecessors, type PredecessorItem } from '../model/predecessors'
import { createTask, MAX_TREE_DEPTH, nameKey, ProjectSchema, type Project, type Task, type TaskKind } from '../model/schema'
import { EXPORT_COLUMNS, type ExportColumn } from './tableExport'

/** Nejvíc řádků činností v jednom importu. */
export const MAX_IMPORT_ROWS = 5000

export interface ImportError {
  /** Řádek v souboru (1 = hlavička). */
  row: number
  code: string
}

/** Upozornění importu, které ho neblokuje (např. vynechané vazby) – kód a počet. */
export interface ImportWarning {
  code: string
  count: number
}

export type ImportResult = { ok: true; project: Project; warnings?: ImportWarning[] } | { ok: false; errors: ImportError[] }

/** Hodnota buňky, jak ji dodá čtení CSV/XLSX. Cokoli jiného se bere jako prázdné. */
export const CellSchema = z.union([z.string(), z.number(), z.date(), z.null()]).catch(null)
export type CellValue = z.infer<typeof CellSchema>

// --- Hlavička: názvy sloupců česky i anglicky ---
export const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // „Délka (dny)“ = „Délka“
    .replace(/\s+/g, ' ')
    .trim()

const HEADER_ALIASES = new Map<string, ExportColumn>()
for (const column of EXPORT_COLUMNS) {
  for (const locale of [cs, en]) HEADER_ALIASES.set(normalize(locale.export.columns[column]), column)
}

/** Typ položky: česky, anglicky nebo kódem. */
const KIND_ALIASES = new Map<string, TaskKind>()
for (const kind of ['task', 'phase', 'milestone'] as const) {
  for (const label of [kind, cs.kind[kind], en.kind[kind]]) KIND_ALIASES.set(label.toLowerCase(), kind)
}

// --- Převod hodnot buněk ---
/** Text buňky; apostrof z ochrany proti vzorcům (export) se odstraní. */
export function text(value: CellValue): string {
  if (value === null) return ''
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
  return /^'[=+\-@\t\r]/.test(raw) ? raw.slice(1) : raw
}

/** Celé číslo v rozsahu, nebo null (prázdná buňka = výchozí hodnota → undefined). */
function integer(value: CellValue, min: number, max: number): number | null | undefined {
  if (value === null || (typeof value === 'string' && value.trim() === '')) return undefined
  const number = typeof value === 'number' ? value : Number(String(value).replace(/%/g, '').replace(',', '.').trim())
  return Number.isInteger(number) && number >= min && number <= max ? number : null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Datum: z XLSX (Date), ISO „2026-11-18“, české „18.11.2026“, nebo pořadové číslo dne z Excelu. */
export function isoDate(value: CellValue): string | null | undefined {
  if (value === null || (typeof value === 'string' && value.trim() === '')) return undefined
  let iso: string
  if (value instanceof Date) {
    iso = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
  } else if (typeof value === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000)
    iso = date.toISOString().slice(0, 10)
  } else {
    const s = value.trim()
    const czech = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(s)
    iso = czech ? `${czech[3]}-${pad(Number(czech[2]))}-${pad(Number(czech[1]))}` : s
  }
  return isValidIsoDate(iso) ? iso : null
}

/** Rozebraný řádek (vrstva 1). */
interface ParsedRow {
  fileRow: number
  number: number
  level: number
  name: string
  kind: TaskKind
  duration: number
  predecessors: PredecessorItem[]
  constraint?: string
  percent: number
  notes: string
}

export function importTable(rawRows: unknown[][], base: Project, makeId: () => string): ImportResult {
  const fail = (row: number, code: string): ImportResult => ({ ok: false, errors: [{ row, code }] })
  const rows = rawRows.map((row) => (Array.isArray(row) ? row.map((cell) => CellSchema.parse(cell)) : []))
  const header = rows[0]
  if (!header) return fail(1, 'empty')

  // Které sloupce soubor má (podle hlavičky).
  const columnIndex = new Map<ExportColumn, number>()
  header.forEach((cell, i) => {
    const column = HEADER_ALIASES.get(normalize(text(cell)))
    if (column && !columnIndex.has(column)) columnIndex.set(column, i)
  })
  if (!columnIndex.has('name')) return fail(1, 'missingName')
  const cell = (row: CellValue[], column: ExportColumn): CellValue => {
    const i = columnIndex.get(column)
    return i === undefined ? null : (row[i] ?? null)
  }

  // Datové řádky bez úplně prázdných (číslo řádku v souboru se zachová).
  const data = rows
    .map((row, i) => ({ row, fileRow: i + 1 }))
    .slice(1)
    .filter(({ row }) => row.some((c) => text(c).trim() !== ''))
  if (data.length === 0) return fail(1, 'empty')
  if (data.length > MAX_IMPORT_ROWS) return fail(1, 'tooManyRows')

  // --- Vrstva 1: jednotlivé řádky ---
  const errors: ImportError[] = []
  const parsed: ParsedRow[] = []
  const seenNumbers = new Set<number>()
  data.forEach(({ row, fileRow }, index) => {
    const error = (code: string) => errors.push({ row: fileRow, code })
    const name = text(cell(row, 'name')).trim()
    if (name === '') return error('emptyName')
    if (name.length > 200) return error('nameTooLong')
    const kindText = text(cell(row, 'kind')).trim().toLowerCase()
    const kind = kindText === '' ? 'task' : KIND_ALIASES.get(kindText)
    if (!kind) return error('badKind')
    const level = integer(cell(row, 'level'), 1, MAX_TREE_DEPTH)
    if (level === null) return error('badLevel')
    const duration = integer(cell(row, 'duration'), 0, 10000)
    if (duration === null && kind !== 'phase') return error('badDuration')
    const percent = integer(cell(row, 'percent'), 0, 100)
    if (percent === null) return error('badPercent')
    const constraint = isoDate(cell(row, 'constraint'))
    if (constraint === null) return error('badDate')
    const number = integer(cell(row, 'number'), 1, 100000)
    if (number === null) return error('badNumber')
    const rowNumber = number ?? index + 1
    if (seenNumbers.has(rowNumber)) return error('duplicateNumber')
    seenNumbers.add(rowNumber)
    const predecessors = parsePredecessors(text(cell(row, 'predecessors')))
    if (!predecessors.ok) return error('badPredecessors')
    const notes = text(cell(row, 'notes'))
    if (notes.length > 5000) return error('notesTooLong')
    parsed.push({
      fileRow,
      number: rowNumber,
      level: level ?? 1,
      name,
      kind,
      duration: kind === 'milestone' ? 0 : (duration ?? 1),
      predecessors: predecessors.items,
      constraint,
      percent: percent ?? 0,
      notes,
    })
  })
  if (errors.length > 0) return { ok: false, errors }

  // --- Vrstva 2: hierarchie (úroveň smí stoupnout nejvýš o 1, podřízené jen pod fází) ---
  const ids = parsed.map(() => makeId())
  const parentIds: (string | null)[] = []
  const lastAtLevel: { id: string; kind: TaskKind; fileRow: number }[] = []
  parsed.forEach((row, i) => {
    if (row.level > lastAtLevel.length + 1) return void errors.push({ row: row.fileRow, code: 'badLevel' })
    const parent = row.level > 1 ? lastAtLevel[row.level - 2] : undefined
    if (parent && parent.kind !== 'phase') return void errors.push({ row: row.fileRow, code: 'parentNotPhase' })
    parentIds[i] = parent?.id ?? null
    lastAtLevel.length = row.level - 1
    lastAtLevel.push({ id: ids[i] as string, kind: row.kind, fileRow: row.fileRow })
  })
  if (errors.length > 0) return { ok: false, errors }

  // --- Vrstva 3: předchůdci podle čísel ze sloupce Č. ---
  const byNumber = new Map(parsed.map((row, i) => [row.number, { id: ids[i] as string, kind: row.kind }]))
  const tasks: Task[] = []
  const counters = new Map<string | null, number>()
  parsed.forEach((row, i) => {
    const id = ids[i] as string
    const parentId = parentIds[i] ?? null
    const order = counters.get(parentId) ?? 0
    counters.set(parentId, order + 1)
    const dependencies = []
    for (const item of row.predecessors) {
      const predecessor = byNumber.get(item.row)
      if (!predecessor) return void errors.push({ row: row.fileRow, code: 'unknownPredecessor' })
      if (predecessor.id === id) return void errors.push({ row: row.fileRow, code: 'selfDependency' })
      if (predecessor.kind === 'phase' || row.kind === 'phase') return void errors.push({ row: row.fileRow, code: 'phaseDependency' })
      dependencies.push({ predecessorId: predecessor.id, type: item.type, lagDays: item.lagDays })
    }
    tasks.push({
      ...createTask({ id, name: row.name, order, kind: row.kind, durationDays: row.duration }),
      parentId,
      dependencies,
      percentComplete: row.percent,
      notes: row.notes,
      ...(row.constraint ? { constraintStart: row.constraint } : {}),
    })
  })
  if (errors.length > 0) return { ok: false, errors }

  // --- Vrstva 4: kruhy ve vazbách ---
  const { tasks: kept, rename } = keepIdentity(base, tasks)
  const candidate: Project = { ...base, tasks: kept }
  const cycle = schedule(candidate).cycleTaskIds
  if (cycle.size > 0) {
    return { ok: false, errors: parsed.filter((_, i) => cycle.has(rename.get(ids[i] as string) ?? (ids[i] as string))).map((row) => ({ row: row.fileRow, code: 'cycle' })) }
  }

  // --- Vrstva 5: celý projekt ještě jednou schématem (pojistka) ---
  const result = ProjectSchema.safeParse(candidate)
  if (!result.success) return fail(1, 'invalid')
  return { ok: true, project: result.data }
}

/**
 * Činnost se stejným WBS, názvem (bez ohledu na velikost písmen) a druhem jako v současném projektu
 * si ponechá své ID a skutečné náklady (fáze 9) – uložená baseline ji tak dál pozná a utracené
 * peníze se neztratí. Ostatní dostanou nová ID. Vrací i převod nové ID → ponechané ID.
 */
export function keepIdentity(base: Project, tasks: Task[]): { tasks: Task[]; rename: Map<string, string> } {
  const baseWbs = wbsNumbers(base)
  const byWbs = new Map(base.tasks.map((t) => [baseWbs.get(t.id) ?? '', t]))
  const newWbs = wbsNumbers({ ...base, tasks })
  const rename = new Map<string, string>()
  const kept = new Map<string, Task>()
  for (const task of tasks) {
    const old = byWbs.get(newWbs.get(task.id) ?? '')
    if (old && old.kind === task.kind && nameKey(old.name) === nameKey(task.name)) {
      rename.set(task.id, old.id)
      kept.set(task.id, old)
    }
  }
  if (rename.size === 0) return { tasks, rename }
  const id = (value: string) => rename.get(value) ?? value
  return {
    rename,
    tasks: tasks.map((task) => {
      const old = kept.get(task.id)
      return {
        ...task,
        id: id(task.id),
        parentId: task.parentId === null ? null : id(task.parentId),
        dependencies: task.dependencies.map((d) => ({ ...d, predecessorId: id(d.predecessorId) })),
        ...(old?.actuals ? { actuals: old.actuals } : {}),
      }
    }),
  }
}

/** Text CSV → tabulka. Oddělovač (středník / čárka / tabulátor) se pozná sám. */
export function readCsv(content: string): string[][] {
  const parsed = Papa.parse<string[]>(content.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  return parsed.data
}
