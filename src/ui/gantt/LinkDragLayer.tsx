/**
 * Kreslení vazby tažením v grafu (G-03).
 *
 * - Kolečka na začátku a konci úsečky kreslí TaskBars.tsx (atributy data-link-task, data-link-anchor).
 * - Táhnu z kolečka na jinou úsečku: levá polovina = do začátku, pravá = do konce;
 *   typ (FS, SS, FF, SF) spočítá gantt/link.ts. Během tažení přerušovaná čára a bublina s typem,
 *   nebo s důvodem, proč to nejde (kruh, fáze).
 * - Po puštění se vazba zapíše jedním krokem (setDependencies → jeden krok Zpět).
 *   Kontrolu (sama na sebe, fáze, kruh) dělá model/predecessors.ts → withDependency.
 * - Esc kreslení zruší.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ROW_HEIGHT, type Bar } from '../../gantt/geometry'
import { linkTarget, type LinkAnchor } from '../../gantt/link'
import { withDependency, type PredecessorError } from '../../model/predecessors'
import type { DependencyType, Task } from '../../model/schema'
import { projectStore } from '../../store/useProject'
import { useViewState } from '../viewState'

/** Jak daleko vedle úsečky ještě „chytí“ cíl (px). */
const TARGET_MARGIN = 14

interface Target {
  taskId: string
  anchor: LinkAnchor
  type: DependencyType
  /** Bod, kam vazba dosedne. */
  point: [number, number]
  error: PredecessorError | null
}

interface ActiveLink {
  fromId: string
  fromAnchor: LinkAnchor
  pointerId: number
  origin: [number, number]
  pointer: [number, number]
  target: Target | null
}

interface LinkDragLayerProps {
  svgRef: RefObject<SVGSVGElement | null>
  rows: Task[]
  bars: Map<string, Bar>
}

export function LinkDragLayer(props: LinkDragLayerProps) {
  const { t } = useTranslation()
  const [active, setActiveState] = useState<ActiveLink | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const activeRef = useRef<ActiveLink | null>(null)
  const { svgRef } = props

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const setActive = (next: ActiveLink | null) => {
      activeRef.current = next
      setActiveState(next)
    }
    /** Souřadnice myši uvnitř grafu. */
    const local = (event: PointerEvent): [number, number] => {
      const box = svg.getBoundingClientRect()
      return [event.clientX - box.left, event.clientY - box.top]
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      const handle = (event.target as Element).closest<SVGElement>('[data-link-anchor]')
      const fromId = handle?.dataset.linkTask
      const bar = fromId ? propsRef.current.bars.get(fromId) : undefined
      if (!handle || !fromId || !bar) return
      event.preventDefault()
      event.stopPropagation()
      try {
        svg?.setPointerCapture(event.pointerId)
      } catch {
        // bez zachycení to funguje taky, jen nad grafem
      }
      const fromAnchor = handle.dataset.linkAnchor as LinkAnchor
      useViewState.getState().select(fromId)
      setActive({
        fromId,
        fromAnchor,
        pointerId: event.pointerId,
        origin: [fromAnchor === 'start' ? bar.xStart : bar.xEnd, bar.centerY],
        pointer: local(event),
        target: null,
      })
    }

    /** Najde cílovou úsečku pod myší a ověří, jestli na ni jde vazbu nakreslit. */
    function findTarget(drag: ActiveLink, [x, y]: [number, number]): Target | null {
      const { rows, bars } = propsRef.current
      const task = rows[Math.floor(y / ROW_HEIGHT)]
      const bar = task ? bars.get(task.id) : undefined
      if (!task || !bar || task.id === drag.fromId) return null
      if (x < bar.xStart - TARGET_MARGIN || x > bar.xEnd + TARGET_MARGIN) return null
      const { anchor, type } = linkTarget(drag.fromAnchor, bar, x)
      const result = withDependency(projectStore.getState().project, task.id, drag.fromId, type)
      return {
        taskId: task.id,
        anchor,
        type,
        point: [anchor === 'start' ? bar.xStart : bar.xEnd, bar.centerY],
        error: result.ok ? null : result.error,
      }
    }

    function onPointerMove(event: PointerEvent) {
      const drag = activeRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      const pointer = local(event)
      setActive({ ...drag, pointer, target: findTarget(drag, pointer) })
    }

    function onPointerUp(event: PointerEvent) {
      const drag = activeRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      setActive(null)
      const target = drag.target
      if (!target || target.error) return // nic nebo nepovolený cíl – důvod byl vidět v bublině
      const store = projectStore.getState()
      const result = withDependency(store.project, target.taskId, drag.fromId, target.type)
      if (!result.ok) return
      store.setDependencies(target.taskId, result.dependencies)
      useViewState.getState().select(target.taskId)
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

  // Kurzor během kreslení na celém grafu.
  useEffect(() => {
    const svg = svgRef.current
    if (svg && (active || svg.style.cursor === 'crosshair')) svg.style.cursor = active ? 'crosshair' : ''
  }, [svgRef, active])

  if (!active) return null

  const { origin, pointer, target } = active
  const valid = target !== null && target.error === null
  const end = valid ? target.point : pointer
  const label = !target
    ? t('gantt.linkChooseTarget')
    : target.error
      ? `✕ ${t(`gantt.linkInvalid.${target.error.code}`)}`
      : `${target.type} – ${t(`gantt.dependencyType.${target.type}`)}`
  const labelWidth = label.length * 6.5 + 12
  const color = target?.error ? 'stroke-red-600 dark:stroke-red-400' : 'stroke-miro-turquoise-dark dark:stroke-miro-turquoise'

  return (
    <g pointerEvents="none" aria-hidden="true">
      <line x1={origin[0]} y1={origin[1]} x2={end[0]} y2={end[1]} strokeWidth={1.5} strokeDasharray="4 3" className={color} />
      <circle cx={origin[0]} cy={origin[1]} r={4.5} strokeWidth={1.5} className={`fill-miro-turquoise-dark dark:fill-miro-turquoise ${color}`} />
      {valid && <circle cx={end[0]} cy={end[1]} r={6} strokeWidth={2} className="fill-miro-turquoise/40 stroke-miro-turquoise-dark dark:stroke-miro-turquoise" />}
      <rect
        x={pointer[0] + 12}
        y={pointer[1] - 26}
        width={labelWidth}
        height={20}
        rx={4}
        className={target?.error ? 'fill-red-700' : 'fill-slate-800 dark:fill-slate-100'}
      />
      <text x={pointer[0] + 18} y={pointer[1] - 12} className={`text-xs ${target?.error ? 'fill-white' : 'fill-white dark:fill-slate-900'}`}>
        {label}
      </text>
    </g>
  )
}
