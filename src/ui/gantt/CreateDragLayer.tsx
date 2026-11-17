/**
 * Nová činnost tažením v prázdném místě grafu pod plánem (fáze 13c).
 *
 * - Pod posledním řádkem je pruh „Táhněte sem…“. Tah vodorovně (myší i prstem) ukáže náhled
 *   nové úsečky s daty a délkou; po puštění vznikne činnost na konci plánu se začátkem 📌 a délkou
 *   podle tahu (gantt/drag.ts → createFromDrag, otestované) – jeden krok Zpět.
 * - Krátké kliknutí nic nevytvoří. Esc tažení zruší.
 * - Po vytvoření se činnost vybere a kurzor skočí do jejího názvu v tabulce, ať jde hned psát.
 */
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { dayToIso, isoToDay, type WorkCalendar } from '../../engine/calendar'
import { createFromDrag, type DragResult } from '../../gantt/drag'
import { BAR_HALF_HEIGHT, ROW_HEIGHT } from '../../gantt/geometry'
import { dayToX, xToDay, type Timeline } from '../../gantt/timeline'
import { formatIsoDate } from '../../i18n/format'
import { projectStore } from '../../store/useProject'
import { useViewState } from '../viewState'

/** O kolik bodů se musí ukazatel pohnout, aby to bylo tažení, ne kliknutí. */
const MIN_DRAG_PX = 6

interface Active {
  pointerId: number
  startX: number
  fromDay: number
  result: DragResult | null
}

interface CreateDragLayerProps {
  tl: Timeline
  calendar: WorkCalendar
  /** Index řádku, kam se nová činnost nakreslí (= počet viditelných řádků). */
  rowIndex: number
  projectStart: string
}

export function CreateDragLayer({ tl, calendar, rowIndex, projectStart }: CreateDragLayerProps) {
  const { t, i18n } = useTranslation()
  const [active, setActive] = useState<Active | null>(null)
  const activeRef = useRef<Active | null>(null)
  const update = (next: Active | null) => {
    activeRef.current = next
    setActive(next)
  }

  // Esc tažení zruší.
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      update(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])

  /** Pozice ukazatele v grafu (px od levého okraje SVG). */
  const xIn = (event: PointerEvent<SVGRectElement>) => event.clientX - (event.currentTarget.ownerSVGElement?.getBoundingClientRect().left ?? 0)

  function onPointerDown(event: PointerEvent<SVGRectElement>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Bez zachycení to funguje taky, jen dokud je ukazatel nad pruhem.
    }
    update({ pointerId: event.pointerId, startX: event.clientX, fromDay: xToDay(tl, xIn(event)), result: null })
  }

  function onPointerMove(event: PointerEvent<SVGRectElement>) {
    const drag = activeRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    if (Math.abs(event.clientX - drag.startX) < MIN_DRAG_PX) {
      if (drag.result) update({ ...drag, result: null })
      return
    }
    const toDay = xToDay(tl, xIn(event))
    const result = createFromDrag(calendar, { fromDay: drag.fromDay, toDay, projectStartDay: isoToDay(projectStart) })
    if (result.startDay !== drag.result?.startDay || result.finishDay !== drag.result?.finishDay) update({ ...drag, result })
  }

  function onPointerUp(event: PointerEvent<SVGRectElement>) {
    const drag = activeRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    update(null)
    if (!drag.result) return // jen kliknutí
    const id = projectStore.getState().addTask(t('task.defaultName'), 'task', null, {
      durationDays: drag.result.durationDays,
      constraintStart: drag.result.constraintStart,
    })
    useViewState.getState().select(id)
    // Kurzor do názvu nové činnosti v tabulce (po vykreslení řádku).
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(`[data-task-id="${CSS.escape(id)}"] input[type="text"]`)
      input?.focus()
      input?.select()
    }, 0)
  }

  const top = rowIndex * ROW_HEIGHT
  const result = active?.result ?? null
  let preview = null
  if (result) {
    const x = dayToX(tl, result.startDay)
    const width = Math.max(2, dayToX(tl, result.finishDay + 1) - x)
    const lang = i18n.language
    const from = formatIsoDate(dayToIso(result.startDay), lang)
    const to = formatIsoDate(dayToIso(result.finishDay), lang)
    const label = t('gantt.dragLabel', {
      range: from === to ? from : t('gantt.range', { from, to }),
      duration: t('gantt.workingDays', { count: result.durationDays }),
    })
    const labelWidth = label.length * 6.5 + 12
    const labelX = x + width + 8 + labelWidth < tl.width ? x + width + 8 : Math.max(0, x - 8 - labelWidth)
    const cy = top + ROW_HEIGHT / 2
    preview = (
      <g pointerEvents="none" aria-hidden="true">
        <rect
          x={x}
          y={cy - BAR_HALF_HEIGHT}
          width={width}
          height={2 * BAR_HALF_HEIGHT}
          rx={3}
          className="fill-miro-turquoise/30 stroke-miro-turquoise-dark dark:stroke-miro-turquoise"
          strokeDasharray="4 2"
          strokeWidth={1.5}
        />
        <rect x={labelX} y={cy - 10} width={labelWidth} height={20} rx={4} className="fill-slate-800 dark:fill-slate-100" />
        <text x={labelX + 6} y={cy + 4} className="fill-white text-xs dark:fill-slate-900">
          {label}
        </text>
      </g>
    )
  }

  return (
    <g>
      {/* Nápověda v pruhu pod plánem (u začátku projektu, kde se většinou začíná). */}
      {!active && (
        <text
          x={Math.max(0, dayToX(tl, isoToDay(projectStart))) + 8}
          y={top + ROW_HEIGHT / 2 + 4}
          className="pointer-events-none select-none fill-slate-400 text-xs dark:fill-slate-500"
          aria-hidden="true"
        >
          {t('gantt.createHint')}
        </text>
      )}
      {/* Neviditelná plocha pro tah: celé prázdné místo pod plánem. Svislý pohyb prstem dál posouvá graf. */}
      <rect
        x={0}
        y={top}
        width={tl.width}
        height="100%"
        fill="transparent"
        style={{ touchAction: 'pan-y' }}
        className="cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => update(null)}
      >
        <title>{t('gantt.createHint')}</title>
      </rect>
      {preview}
    </g>
  )
}
