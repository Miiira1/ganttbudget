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
import { BAR_HALF_HEIGHT, MILESTONE_HALF, type Bar } from '../../gantt/geometry'
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
  switch (task.kind) {
    case 'milestone':
      return t('gantt.barMilestone', { name: task.name, date: to })
    case 'phase':
      return t('gantt.barPhase', { name: task.name, range })
    case 'task':
      return t('gantt.barTask', { name: task.name, range, duration: t('gantt.workingDays', { count: task.durationDays }) })
  }
}

function Shape({ bar }: { bar: Bar }) {
  const cy = bar.centerY
  const width = Math.max(MIN_WIDTH, bar.xEnd - bar.xStart)
  switch (bar.kind) {
    case 'task':
      return (
        <rect
          x={bar.xStart}
          y={cy - TASK_BAR_HEIGHT / 2}
          width={width}
          height={TASK_BAR_HEIGHT}
          rx={3}
          className="fill-blue-500 stroke-blue-700 dark:fill-blue-500 dark:stroke-blue-300"
          strokeWidth={1}
        />
      )
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
      return <polygon points={points.map((p) => p.join(',')).join(' ')} className="fill-slate-700 dark:fill-slate-300" />
    }
    case 'milestone': {
      const cx = bar.xStart + MILESTONE_HALF
      const h = MILESTONE_HALF
      return (
        <polygon
          points={`${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}`}
          className="fill-amber-500 stroke-amber-700 dark:fill-amber-400 dark:stroke-amber-200"
          strokeWidth={1}
        />
      )
    }
  }
}

interface TaskBarsProps {
  rows: Task[]
  /** Úsečky spočítané funkcí layoutBars (jen řádky s termínem). */
  bars: Map<string, Bar>
  dates: Map<string, ScheduledTask>
}

export const TaskBars = memo(function TaskBars({ rows, bars, dates }: TaskBarsProps) {
  const { t, i18n } = useTranslation()
  return (
    <g>
      {rows.map((task) => {
        const d = dates.get(task.id)
        const bar = bars.get(task.id)
        if (!bar || !d?.start || !d.finish) return null
        return (
          <g key={task.id} data-task-id={task.id}>
            <title>{barTitle(task, { start: d.start, finish: d.finish }, t, i18n.language)}</title>
            <Shape bar={bar} />
          </g>
        )
      })}
    </g>
  )
})
