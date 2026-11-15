/**
 * Úsečky v Ganttově grafu (G-07):
 *  - činnost = obdélník přes dny, kdy se pracuje,
 *  - fáze    = tenká tmavá sumární úsečka se „špičkami“ dolů na obou koncích,
 *  - milník  = kosočtverec na konci svého dne.
 * Typ poznáte podle tvaru, ne jen podle barvy (U-06).
 * Činnosti bez termínu (např. v kruhu vazeb) se nekreslí.
 */
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { ScheduledTask } from '../../engine/schedule'
import { formatIsoDate } from '../../i18n/format'
import { BAR_HALF_HEIGHT, MILESTONE_HALF, ROW_HEIGHT, type Bar } from '../../gantt/geometry'
import type { Task } from '../../model/schema'

/** Výška úsečky činnosti a sumární úsečky fáze (šipky dosedají na její hranu). */
const TASK_BAR_HEIGHT = 2 * BAR_HALF_HEIGHT
const PHASE_BAR_HEIGHT = 6
/** Jak hluboko sahají „špičky“ na koncích fáze. */
const PHASE_TIP = 5
/** I jednodenní činnost v měřítku Čtvrtletí musí být vidět. */
const MIN_WIDTH = 2

function barTitle(task: Task, dates: { start: string; finish: string }, t: TFunction, lang: string): string {
  const from = formatIsoDate(dates.start, lang)
  const to = formatIsoDate(dates.finish, lang)
  const range = from === to ? from : t('gantt.range', { from, to })
  // Případné omezení „začít nejdříve“ a nápověda, co jde s úsečkou dělat myší.
  const constraint = task.constraintStart
    ? `\n📌 ${t('gantt.barConstraint', { date: formatIsoDate(task.constraintStart, lang) })}`
    : ''
  switch (task.kind) {
    case 'milestone':
      return `${t('gantt.barMilestone', { name: task.name, date: to })}${constraint}\n${t('gantt.dragMilestoneHint')}`
    case 'phase':
      return `${t('gantt.barPhase', { name: task.name, range })}\n${t('gantt.phaseNotDraggable')}`
    case 'task':
      return `${t('gantt.barTask', { name: task.name, range, duration: t('gantt.workingDays', { count: task.durationDays }) })}${constraint}\n${t('gantt.dragTaskHint')}`
  }
}

/** Polovina výšky řádku – zóna najetí myší pokryje celý řádek. */
const ROW_HALF = ROW_HEIGHT / 2

/** Šířka úchytu pro změnu délky na okraji úsečky (px). */
const EDGE_HANDLE = 6

/**
 * Neviditelné úchyty pro tažení (zpracovává je BarDragLayer.tsx):
 * tělo úsečky = posun, okraje = změna začátku / konce. Fáze úchyty nemá.
 */
function DragHandles({ bar, taskId }: { bar: Bar; taskId: string }) {
  if (bar.kind === 'phase') return null
  const top = bar.centerY - TASK_BAR_HEIGHT / 2 - 2
  const height = TASK_BAR_HEIGHT + 4
  const width = Math.max(MIN_WIDTH, bar.xEnd - bar.xStart)
  const common = { y: top, height, fill: 'transparent', 'data-drag-task': taskId, style: { touchAction: 'none' } }
  if (bar.kind === 'milestone') {
    return <rect {...common} x={bar.xStart} width={width} data-drag-mode="move" className="cursor-grab" />
  }
  // U krátkých úseček zabírají okraje nejvýš třetinu šířky, aby šlo chytit i tělo.
  const edge = Math.min(EDGE_HANDLE, width / 3)
  return (
    <>
      <rect {...common} x={bar.xStart} width={width} data-drag-mode="move" className="cursor-grab" />
      <rect {...common} x={bar.xStart - edge / 2} width={edge} data-drag-mode="start" className="cursor-ew-resize" />
      <rect {...common} x={bar.xStart + width - edge / 2} width={edge} data-drag-mode="end" className="cursor-ew-resize" />
    </>
  )
}

/** critical: true / false v režimu kritické cesty, null = režim vypnutý (běžné barvy). */
function Shape({ bar, critical }: { bar: Bar; critical: boolean | null }) {
  const cy = bar.centerY
  const width = Math.max(MIN_WIDTH, bar.xEnd - bar.xStart)
  switch (bar.kind) {
    case 'task': {
      const rect = { x: bar.xStart, y: cy - TASK_BAR_HEIGHT / 2, width, height: TASK_BAR_HEIGHT, rx: 3 }
      if (!critical) {
        // Běžná činnost: tyrkysová utlumená průhledností + výrazný tyrkysový rámeček.
        // Pod ní neprůhledný podklad, aby skrz úsečku neprosvítala mřížka ani šipky vazeb.
        return (
          <>
            <rect {...rect} className="fill-white dark:fill-slate-900" />
            <rect {...rect} className="fill-miro-turquoise/35 stroke-miro-turquoise-dark dark:fill-miro-turquoise/30 dark:stroke-miro-turquoise" strokeWidth={1} />
          </>
        )
      }
      // Kritická: ve světlém vzhledu plná žlutá; v tmavém běžná (šedá) úsečka s průsvitnou žlutou vrstvou
      // (žlutá je utlumená, neoslňuje) a jemným světle žlutým rámečkem.
      return (
        <>
          <rect {...rect} className="fill-miro-yellow stroke-miro-gold dark:fill-slate-400 dark:stroke-miro-yellow-light" strokeWidth={1} />
          {/* Jemný světle žlutý rámeček kritické činnosti (jen v tmavém vzhledu). */}
          <rect {...rect} className="hidden fill-miro-yellow/60 stroke-miro-yellow-light dark:inline" strokeWidth={1} pointerEvents="none" />
        </>
      )
    }
    case 'phase': {
      const top = cy - TASK_BAR_HEIGHT / 2
      const bottom = top + PHASE_BAR_HEIGHT
      const right = bar.xStart + width
      // Jeden obrys: horní hrana, pravá špička dolů, spodní hrana, levá špička dolů.
      const points = [
        [bar.xStart, top],
        [right, top],
        [right, bottom + PHASE_TIP],
        [right - PHASE_TIP, bottom],
        [bar.xStart + PHASE_TIP, bottom],
        [bar.xStart, bottom + PHASE_TIP],
      ]
      return (
        <polygon
          points={points.map((p) => p.join(',')).join(' ')}
          className={critical ? 'fill-miro-gold dark:fill-miro-yellow/70 dark:stroke-miro-yellow-light' : 'fill-miro-graphite dark:fill-slate-200'}
          strokeWidth={critical ? 1 : undefined}
        />
      )
    }
    case 'milestone': {
      const cx = bar.xStart + MILESTONE_HALF
      const h = MILESTONE_HALF
      return (
        <polygon
          points={`${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}`}
          className={
            critical
              ? 'fill-miro-yellow stroke-miro-gold dark:fill-miro-yellow/75 dark:stroke-miro-yellow-light'
              : 'fill-miro-graphite stroke-miro-graphite dark:fill-slate-100 dark:stroke-slate-300'
          }
          strokeWidth={1}
        />
      )
    }
  }
}

/** Jak daleko od okraje úsečky je kolečko pro kreslení vazby a jak je velké. */
const LINK_OFFSET = 10
const LINK_RADIUS = 4.5

/**
 * Kolečka pro kreslení vazby (G-03) na začátku a konci úsečky – objeví se po najetí myší
 * (zpracovává je LinkDragLayer.tsx). Neviditelná „zóna najetí“ kolem úsečky drží kolečka
 * viditelná i ve chvíli, kdy myš z úsečky přejíždí na kolečko. Fáze kolečka nemá.
 */
function LinkHandles({ bar, taskId, label }: { bar: Bar; taskId: string; label: string }) {
  if (bar.kind === 'phase') return null
  const cy = bar.centerY
  const xEnd = Math.max(bar.xEnd, bar.xStart + MIN_WIDTH)
  const circle = (anchor: 'start' | 'end', cx: number) => (
    <circle
      cx={cx}
      cy={cy}
      r={LINK_RADIUS}
      data-link-task={taskId}
      data-link-anchor={anchor}
      style={{ touchAction: 'none' }}
      className="cursor-crosshair fill-white stroke-miro-turquoise-dark opacity-0 transition-opacity group-hover:opacity-100 dark:fill-slate-900 dark:stroke-miro-turquoise"
      strokeWidth={1.5}
    >
      <title>{label}</title>
    </circle>
  )
  return (
    <>
      {circle('start', bar.xStart - LINK_OFFSET)}
      {circle('end', xEnd + LINK_OFFSET)}
    </>
  )
}

interface TaskBarsProps {
  rows: Task[]
  /** Úsečky spočítané funkcí layoutBars (jen řádky s termínem). */
  bars: Map<string, Bar>
  dates: Map<string, ScheduledTask>
  /** Kritické položky (null = zvýraznění kritické cesty je vypnuté). */
  critical: ReadonlySet<string> | null
  /** Kam sahá rezerva (x konce pruhu rezervy) u nekritických položek. */
  slackEnds: Map<string, number> | null
}

export const TaskBars = memo(function TaskBars({ rows, bars, dates, critical, slackEnds }: TaskBarsProps) {
  const { t, i18n } = useTranslation()
  return (
    <g>
      {rows.map((task) => {
        const d = dates.get(task.id)
        const bar = bars.get(task.id)
        if (!bar || !d?.start || !d.finish) return null
        const hoverZone =
          bar.kind === 'phase' ? null : (
            <rect
              x={bar.xStart - LINK_OFFSET - LINK_RADIUS - 2}
              y={bar.centerY - ROW_HALF}
              width={Math.max(bar.xEnd, bar.xStart + MIN_WIDTH) - bar.xStart + 2 * (LINK_OFFSET + LINK_RADIUS + 2)}
              height={2 * ROW_HALF}
              fill="transparent"
            />
          )
        return (
          <g key={task.id} data-task-id={task.id} className="group">
            <title>{barTitle(task, { start: d.start, finish: d.finish }, t, i18n.language)}</title>
            {hoverZone}
            {slackEnds?.has(task.id) && <SlackBar bar={bar} to={slackEnds.get(task.id) as number} title={t('gantt.slackBar', { count: d.totalSlack ?? 0 })} />}
            <Shape bar={bar} critical={critical === null ? null : critical.has(task.id)} />
            <DragHandles bar={bar} taskId={task.id} />
            <LinkHandles bar={bar} taskId={task.id} label={t('gantt.linkHandle')} />
          </g>
        )
      })}
    </g>
  )
})

/** Pruh rezervy: od konce úsečky po nejpozdější konec (o tolik se smí zpozdit, aniž posune konec projektu). */
function SlackBar({ bar, to, title }: { bar: Bar; to: number; title: string }) {
  const from = bar.kind === 'milestone' ? bar.xStart + MILESTONE_HALF : Math.max(bar.xEnd, bar.xStart + MIN_WIDTH)
  if (to <= from + 1) return null
  return (
    <g>
      <title>{title}</title>
      <rect x={from} y={bar.centerY - 2} width={to - from} height={4} rx={2} className="fill-slate-400/50 dark:fill-slate-500/50" />
      <line x1={to} x2={to} y1={bar.centerY - 5} y2={bar.centerY + 5} strokeWidth={1.5} className="stroke-slate-400 dark:stroke-slate-500" />
    </g>
  )
}
