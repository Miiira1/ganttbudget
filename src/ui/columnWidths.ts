/**
 * Šířky sloupců tabulky činností – uživatel je mění tažením okraje hlavičky.
 * Pamatuje si je prohlížeč (jako polohu oddělovače), neukládají se do projektu
 * a nejdou do historie Zpět/Znovu.
 *
 * Uložené hodnoty z prohlížeče se před použitím zkontrolují schématem Zod a omezí
 * na povolený rozsah – poškozená nebo podvržená data tabulku nerozbijí.
 */
import { create } from 'zustand'
import { z } from 'zod'
import { loadPreference, savePreference } from './preferences'

export type ColumnId =
  | 'number'
  | 'wbs'
  | 'name'
  | 'kind'
  | 'start'
  | 'finish'
  | 'duration'
  | 'slack'
  | 'predecessors'
  | 'percent'
  | 'cost'
  | 'notes'
  | 'actions'

/** Sloupce v pořadí zleva, výchozí a nejmenší šířka (px); `resizable: false` = pevná šířka. */
export const COLUMNS: { id: ColumnId; width: number; min: number; resizable: boolean }[] = [
  { id: 'number', width: 56, min: 48, resizable: true },
  { id: 'wbs', width: 64, min: 40, resizable: true },
  { id: 'name', width: 280, min: 120, resizable: true },
  { id: 'kind', width: 128, min: 90, resizable: true },
  { id: 'start', width: 144, min: 120, resizable: true },
  { id: 'finish', width: 144, min: 120, resizable: true },
  { id: 'duration', width: 96, min: 60, resizable: true },
  { id: 'slack', width: 84, min: 60, resizable: true },
  { id: 'predecessors', width: 128, min: 70, resizable: true },
  { id: 'percent', width: 84, min: 60, resizable: true },
  { id: 'cost', width: 128, min: 80, resizable: true },
  { id: 'notes', width: 200, min: 80, resizable: true },
  { id: 'actions', width: 56, min: 56, resizable: false },
]

export const MAX_WIDTH = 800

export const DEFAULT_WIDTHS = Object.fromEntries(COLUMNS.map((c) => [c.id, c.width])) as Record<ColumnId, number>

const minOf = (id: ColumnId) => COLUMNS.find((c) => c.id === id)?.min ?? 40

/** Šířka omezená na rozsah sloupce, celé pixely. */
export function clampWidth(id: ColumnId, width: number): number {
  return Math.min(MAX_WIDTH, Math.max(minOf(id), Math.round(width)))
}

/** Uložená data z prohlížeče: objekt „sloupec → číslo“; cokoli jiného se zahodí. */
const StoredWidthsSchema = z.record(z.string(), z.unknown())

/** Šířky z neznámých dat: platná čísla se omezí na rozsah, ostatní nahradí výchozí šířka. */
export function sanitizeWidths(raw: unknown): Record<ColumnId, number> {
  const parsed = StoredWidthsSchema.safeParse(raw)
  const stored = parsed.success && !Array.isArray(raw) ? parsed.data : {}
  const widths = { ...DEFAULT_WIDTHS }
  for (const column of COLUMNS) {
    const value = z.number().safeParse(stored[column.id])
    if (value.success && Number.isFinite(value.data)) widths[column.id] = clampWidth(column.id, value.data)
  }
  return widths
}

const STORAGE_KEY = 'columnWidths'

function loadWidths(): Record<ColumnId, number> {
  const saved = loadPreference(STORAGE_KEY)
  if (saved === null) return { ...DEFAULT_WIDTHS }
  try {
    return sanitizeWidths(JSON.parse(saved))
  } catch {
    return { ...DEFAULT_WIDTHS } // neplatný JSON
  }
}

interface ColumnWidthsState {
  widths: Record<ColumnId, number>
  setWidth: (id: ColumnId, width: number) => void
  resetWidth: (id: ColumnId) => void
}

export const useColumnWidths = create<ColumnWidthsState>((set, get) => {
  const save = (widths: Record<ColumnId, number>) => {
    set({ widths })
    savePreference(STORAGE_KEY, JSON.stringify(widths))
  }
  return {
    widths: loadWidths(),
    setWidth: (id, width) => {
      const value = clampWidth(id, width)
      if (get().widths[id] !== value) save({ ...get().widths, [id]: value })
    },
    resetWidth: (id) => save({ ...get().widths, [id]: DEFAULT_WIDTHS[id] }),
  }
})
