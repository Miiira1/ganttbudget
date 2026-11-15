/**
 * Tažení úseček v grafu (G-02): posun celé úsečky, levý okraj (začátek), pravý okraj (konec).
 *
 * - Úchyty kreslí TaskBars.tsx (prvky s atributy data-drag-mode a data-drag-task).
 * - Tahle vrstva poslouchá ukazatel myši (Pointer Events) na celém grafu, během tažení
 *   kreslí jen průhledný náhled a bublinu s novými daty – projekt se nemění.
 * - Po puštění se změna zapíše jedním krokem (setTasksTiming → jeden krok Zpět).
 * - Úsečka z hromadného výběru (Ctrl / Shift) táhne při posunu všechny vybrané činnosti a milníky:
 *   posunou se o stejný počet pracovních dnů (gantt/drag.ts → applyGroupMove). Okraje (délka)
 *   se táhnou vždy jen u jedné úsečky; fáze se neposouvají (počítají se ze svých položek).
 * - Esc tažení zruší. Výpočty přichycení na pracovní dny: gantt/drag.ts (otestované).
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { dayToIso, isoToDay, type WorkCalendar } from '../../engine/calendar'
import type { ScheduledTask } from '../../engine/schedule'
import { applyDrag, applyGroupMove, pixelsToDays, type DragMode, type DragResult, type GroupDragItem } from '../../gantt/drag'
import { barGeometry, BAR_HALF_HEIGHT, MILESTONE_HALF } from '../../gantt/geometry'
import type { Timeline } from '../../gantt/timeline'
import { formatIsoDate } from '../../i18n/format'
import type { Task } from '../../model/schema'
import { getSchedule, projectStore } from '../../store/useProject'
import { showNotice } from '../notice'
import { currentSelection, finishPlainClick, selectWithModifiers } from '../viewState'

interface ActiveDrag {
  task: Task
  mode: DragMode
  pointerId: number
  /** Kde myš začala (px na obrazovce). */
  startX: number
  startDay: number
  finishDay: number
  rowIndex: number
  deltaDays: number
  /** Náhled nového termínu; null = zatím beze změny. */
  result: DragResult | null
  /** Posun skupiny: všechny tažené úsečky (i ta chycená); null = táhne se jen jedna. */
  group: GroupDragItem[] | null
  /** Náhled skupiny: nový termín každé úsečky. */
  groupResults: Map<string, DragResult> | null
}

/** Úsečky vybraných činností a milníků pro posun skupiny (fáze a řádky bez termínu se vynechají). */
function groupItems(rows: Task[], dates: Map<string, ScheduledTask>): GroupDragItem[] {
  const selected = new Set(currentSelection(projectStore.getState().project))
  const items: GroupDragItem[] = []
  for (const task of rows) {
    const d = dates.get(task.id)
    if (!selected.has(task.id) || task.kind === 'phase' || !d?.start || !d.finish) continue
    items.push({
      id: task.id,
      kind: task.kind === 'milestone' ? 'milestone' : 'task',
      startDay: isoToDay(d.start),
      finishDay: isoToDay(d.finish),
      durationDays: task.durationDays,
    })
  }
  return items
}

interface BarDragLayerProps {
  svgRef: RefObject<SVGSVGElement | null>
  tl: Timeline
  calendar: WorkCalendar
  rows: Task[]
  dates: Map<string, ScheduledTask>
}

export function BarDragLayer(props: BarDragLayerProps) {
  const { t, i18n } = useTranslation()
  const [active, setActiveState] = useState<ActiveDrag | null>(null)
  // Posluchače se registrují jednou; aktuální údaje čtou přes ref.
  const propsRef = useRef(props)
  propsRef.current = props
  const activeRef = useRef<ActiveDrag | null>(null)
  const tRef = useRef(t)
  tRef.current = t
  const { svgRef } = props

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const setActive = (next: ActiveDrag | null) => {
      activeRef.current = next
      setActiveState(next)
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      const handle = (event.target as Element).closest<SVGElement>('[data-drag-mode]')
      const taskId = handle?.dataset.dragTask
      if (!handle || !taskId || !svg) return
      const { rows, dates } = propsRef.current
      const rowIndex = rows.findIndex((x) => x.id === taskId)
      const task = rows[rowIndex]
      const d = dates.get(taskId)
      if (!task || !d?.start || !d.finish) return
      event.preventDefault()
      // Ctrl+klik / Shift+klik na úsečku jen mění výběr (jako v tabulce), netáhne se.
      if (selectWithModifiers(event, taskId)) return
      try {
        // Pohyb myši chodí do grafu, i když myš z úsečky „uteče“.
        svg.setPointerCapture(event.pointerId)
      } catch {
        // Některá zařízení zachycení neumí – tažení funguje i bez něj, jen nad grafem.
      }
      const mode = handle.dataset.dragMode as DragMode
      const items = mode === 'move' || task.kind === 'milestone' ? groupItems(rows, dates) : []
      const group = items.length > 1 && items.some((x) => x.id === taskId) ? items : null
      setActive({
        task,
        mode,
        group,
        groupResults: null,
        pointerId: event.pointerId,
        startX: event.clientX,
        startDay: isoToDay(d.start),
        finishDay: isoToDay(d.finish),
        rowIndex,
        deltaDays: 0,
        result: null,
      })
    }

    function onPointerMove(event: PointerEvent) {
      const drag = activeRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const { tl, calendar } = propsRef.current
      const deltaDays = pixelsToDays(event.clientX - drag.startX, tl.dayWidth)
      if (deltaDays === drag.deltaDays) return
      if (drag.group) {
        const groupResults = applyGroupMove(calendar, drag.group, drag.task.id, deltaDays)
        setActive({ ...drag, deltaDays, groupResults, result: groupResults.get(drag.task.id) ?? null })
        return
      }
      const result =
        deltaDays === 0
          ? null
          : applyDrag(calendar, {
              mode: drag.mode,
              kind: drag.task.kind === 'milestone' ? 'milestone' : 'task',
              startDay: drag.startDay,
              finishDay: drag.finishDay,
              durationDays: drag.task.durationDays,
              deltaDays,
            })
      setActive({ ...drag, deltaDays, result })
    }

    function onPointerUp(event: PointerEvent) {
      const drag = activeRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      setActive(null)
      if (!drag.result) {
        finishPlainClick(event, drag.task.id) // jen kliknutí: vybrat tento řádek, nic se nemění
        return
      }
      const results = drag.groupResults ?? new Map([[drag.task.id, drag.result]])
      projectStore
        .getState()
        .setTasksTiming([...results].map(([id, r]) => ({ id, constraintStart: r.constraintStart, durationDays: r.durationDays })))
      // Táhl uživatel před termín daný vazbou? Omezení se uložilo, ale platí vazba – vysvětlíme to.
      const { project } = projectStore.getState()
      const overridden = getSchedule(project).constraintOverridden
      const affected = [...results].filter(([id, r]) => r.constraintStart && overridden.has(id)).map(([id]) => id)
      if (affected.length === 1) {
        const name = project.tasks.find((x) => x.id === affected[0])?.name ?? ''
        showNotice(tRef.current('gantt.constraintOverridden', { name }))
      } else if (affected.length > 1) {
        showNotice(tRef.current('gantt.constraintOverriddenMany', { count: affected.length }))
      }
    }

    const cancel = () => setActive(null)
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && activeRef.current) {
        event.preventDefault()
        cancel()
      }
    }

    svg.addEventListener('pointerdown', onPointerDown)
    svg.addEventListener('pointermove', onPointerMove)
    svg.addEventListener('pointerup', onPointerUp)
    svg.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      svg.removeEventListener('pointerdown', onPointerDown)
      svg.removeEventListener('pointermove', onPointerMove)
      svg.removeEventListener('pointerup', onPointerUp)
      svg.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [svgRef])

  // Kurzor během tažení na celém grafu (i když myš „uteče“ z úsečky).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.style.cursor = active ? (active.mode === 'move' || active.task.kind === 'milestone' ? 'grabbing' : 'ew-resize') : ''
  }, [svgRef, active])

  if (!active?.result) return null

  // --- Náhled: kde úsečka bude a s jakými daty ---
  const { tl } = props
  const { result, task, rowIndex } = active
  const rowIndexes = active.groupResults ? new Map(props.rows.map((x, i) => [x.id, i])) : null
  const others = active.group?.filter((x) => x.id !== task.id) ?? []
  const kind = task.kind === 'milestone' ? 'milestone' : 'task'
  const ghost = barGeometry(tl, kind, dayToIso(result.startDay), dayToIso(result.finishDay), rowIndex)
  const lang = i18n.language
  const from = formatIsoDate(dayToIso(result.startDay), lang)
  const to = formatIsoDate(dayToIso(result.finishDay), lang)
  const label =
    kind === 'milestone'
      ? from
      : t('gantt.dragLabel', {
          range: from === to ? from : t('gantt.range', { from, to }),
          duration: t('gantt.workingDays', { count: result.durationDays }),
        })
  // Bublina vpravo od náhledu; u pravého okraje grafu vlevo.
  const labelWidth = label.length * 6.5 + 12
  const rightSide = ghost.xEnd + 8 + labelWidth < tl.width
  const labelX = rightSide ? ghost.xEnd + 8 : ghost.xStart - 8 - labelWidth
  const cy = ghost.centerY

  return (
    <g pointerEvents="none" aria-hidden="true">
      {others.map((item) => {
        const r = active.groupResults?.get(item.id)
        const index = rowIndexes?.get(item.id)
        if (!r || index === undefined) return null
        return <GhostBar key={item.id} tl={tl} kind={item.kind} startDay={r.startDay} finishDay={r.finishDay} rowIndex={index} />
      })}
      {kind === 'milestone' ? (
        <polygon
          points={`${ghost.xStart + MILESTONE_HALF},${cy - MILESTONE_HALF} ${ghost.xEnd},${cy} ${ghost.xStart + MILESTONE_HALF},${cy + MILESTONE_HALF} ${ghost.xStart},${cy}`}
          className="fill-miro-turquoise/40 stroke-miro-turquoise-dark dark:stroke-miro-turquoise"
          strokeDasharray="3 2"
        />
      ) : (
        <rect
          x={ghost.xStart}
          y={cy - BAR_HALF_HEIGHT}
          width={Math.max(2, ghost.xEnd - ghost.xStart)}
          height={2 * BAR_HALF_HEIGHT}
          rx={3}
          className="fill-miro-turquoise/30 stroke-miro-turquoise-dark dark:stroke-miro-turquoise"
          strokeDasharray="4 2"
          strokeWidth={1.5}
        />
      )}
      <rect x={labelX} y={cy - 10} width={labelWidth} height={20} rx={4} className="fill-slate-800 dark:fill-slate-100" />
      <text x={labelX + 6} y={cy + 4} className="fill-white text-xs dark:fill-slate-900">
        {label}
      </text>
    </g>
  )
}

/** Průhledný náhled další úsečky ze skupiny (bez bubliny s daty). */
function GhostBar(props: { tl: Timeline; kind: 'task' | 'milestone'; startDay: number; finishDay: number; rowIndex: number }) {
  const { tl, kind, rowIndex } = props
  const ghost = barGeometry(tl, kind, dayToIso(props.startDay), dayToIso(props.finishDay), rowIndex)
  const cy = ghost.centerY
  if (kind === 'milestone') {
    return (
      <polygon
        points={`${ghost.xStart + MILESTONE_HALF},${cy - MILESTONE_HALF} ${ghost.xEnd},${cy} ${ghost.xStart + MILESTONE_HALF},${cy + MILESTONE_HALF} ${ghost.xStart},${cy}`}
        className="fill-miro-turquoise/40 stroke-miro-turquoise-dark dark:stroke-miro-turquoise"
        strokeDasharray="3 2"
      />
    )
  }
  return (
    <rect
      x={ghost.xStart}
      y={cy - BAR_HALF_HEIGHT}
      width={Math.max(2, ghost.xEnd - ghost.xStart)}
      height={2 * BAR_HALF_HEIGHT}
      rx={3}
      className="fill-miro-turquoise/30 stroke-miro-turquoise-dark dark:stroke-miro-turquoise"
      strokeDasharray="4 2"
      strokeWidth={1.5}
    />
  )
}
