/**
 * Hlavička tabulky činností s nastavitelnou šířkou sloupců.
 *
 * U pravého okraje každé buňky hlavičky je úzký úchyt (kurzor ↔):
 *  - tažení myší mění šířku sloupce,
 *  - dvojklik vrátí výchozí šířku,
 *  - z klávesnice: Tab na úchyt, šipky ←/→ po 10 px (se Shiftem po 50 px), Home = výchozí.
 * Šířky drží columnWidths.ts (pamatuje si je prohlížeč, ne projekt).
 */
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { HEADER_HEIGHT } from '../gantt/geometry'
import { COLUMNS, MAX_WIDTH, useColumnWidths, type ColumnId } from './columnWidths'

const th =
  'sticky top-0 z-10 overflow-hidden text-ellipsis whitespace-nowrap border-b border-slate-300 bg-slate-100 px-2 py-0 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'

/** Texty hlavičky: klíč názvu, bublina, zarovnání. */
const HEADERS: Record<ColumnId, { label: string; hint?: string; align?: 'right' | 'center'; srOnly?: boolean }> = {
  number: { label: 'table.rowNumber', align: 'right' },
  wbs: { label: 'table.wbs', hint: 'table.wbsHint' },
  name: { label: 'table.name' },
  kind: { label: 'table.kind' },
  start: { label: 'table.start', hint: 'table.startHint' },
  finish: { label: 'table.finish', hint: 'table.finishHint' },
  duration: { label: 'table.duration', hint: 'table.durationHint', align: 'right' },
  slack: { label: 'table.slack', hint: 'table.slackHint', align: 'right' },
  predecessors: { label: 'table.predecessors', hint: 'table.predecessorsHint' },
  percent: { label: 'table.percentComplete', align: 'right' },
  cost: { label: 'table.cost', hint: 'table.costHint', align: 'right' },
  notes: { label: 'table.notes' },
  actions: { label: 'table.actions', align: 'center', srOnly: true },
}

/** Šířky sloupců pro pevné rozvržení tabulky (table-layout: fixed). */
export function TableColumns() {
  const widths = useColumnWidths((s) => s.widths)
  return (
    <colgroup>
      {COLUMNS.map((c) => (
        <col key={c.id} style={{ width: widths[c.id] }} />
      ))}
    </colgroup>
  )
}

/** Celková šířka tabulky = součet šířek sloupců. */
export function useTableWidth(): number {
  const widths = useColumnWidths((s) => s.widths)
  return COLUMNS.reduce((sum, c) => sum + widths[c.id], 0)
}

function ResizeHandle({ id, label }: { id: ColumnId; label: string }) {
  const { t } = useTranslation()
  const width = useColumnWidths((s) => s.widths[id])
  const { setWidth, resetWidth } = useColumnWidths.getState()
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)
  const min = COLUMNS.find((c) => c.id === id)?.min ?? 40

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault() // neoznačovat text při tažení
    drag.current = { startX: event.clientX, startWidth: width }
    event.currentTarget.focus()
    try {
      // Pohyb myši chodí do úchytu, i když myš z úzkého úchytu „uteče“.
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Zařízení zachycení neumí – tažení funguje, dokud je myš nad úchytem.
    }
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    setWidth(id, drag.current.startWidth + event.clientX - drag.current.startX)
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 50 : 10
    if (event.key === 'ArrowLeft') setWidth(id, width - step)
    else if (event.key === 'ArrowRight') setWidth(id, width + step)
    else if (event.key === 'Home') resetWidth(id)
    else return
    event.preventDefault()
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('table.resizeColumn', { name: label })}
      aria-valuemin={min}
      aria-valuemax={MAX_WIDTH}
      aria-valuenow={width}
      title={t('table.resizeHint')}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => resetWidth(id)}
      onKeyDown={onKeyDown}
      className="absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize touch-none border-r-2 border-transparent hover:border-miro-turquoise focus:outline-none focus-visible:border-focus dark:hover:border-miro-turquoise"
    />
  )
}

export function TableHeader() {
  const { t } = useTranslation()
  return (
    <thead>
      <tr style={{ height: HEADER_HEIGHT }}>
        {COLUMNS.map((column) => {
          const header = HEADERS[column.id]
          const label = t(header.label)
          const align = header.align === 'right' ? 'text-right' : header.align === 'center' ? 'text-center' : ''
          return (
            <th key={column.id} scope="col" className={`${th} ${align}`} title={header.hint ? t(header.hint) : undefined}>
              {header.srOnly ? <span className="sr-only">{label}</span> : label}
              {column.resizable && <ResizeHandle id={column.id} label={label} />}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
