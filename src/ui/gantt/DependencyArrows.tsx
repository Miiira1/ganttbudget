/**
 * Šipky vazeb v Ganttově grafu (G-07). Trasu počítá gantt/geometry.ts (dependencyPoints).
 * Kreslí se pod úsečkami, aby hrot šipky „narážel“ na okraj úsečky.
 * Vazba se nekreslí, pokud předchůdce nebo následník nemá spočítaný termín.
 */
import { memo, useId } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { cachedT } from '../../i18n/cachedT'
import { dependencyPoints, pointsToPath, type Bar } from '../../gantt/geometry'
import type { Task } from '../../model/schema'

interface DependencyArrowsProps {
  rows: Task[]
  bars: Map<string, Bar>
  /** Kritické položky (null = zvýraznění vypnuté); vazba mezi dvěma kritickými je červená. */
  critical: ReadonlySet<string> | null
  /**
   * Svislý rozsah vykreslených řádků (px) u velkého plánu: kreslí se jen šipky, které do něj
   * zasahují – i ty, které ho jen protínají z řádků mimo (audit R3). Bez něj všechny.
   */
  yRange?: readonly [number, number]
}

export const DependencyArrows = memo(function DependencyArrows({ rows, bars, critical, yRange }: DependencyArrowsProps) {
  const { t: translate, i18n } = useTranslation()
  // Bubliny šipek se mezi změnami termínů nemění – texty z paměti (13c – výkon).
  const t = ((key: string, options?: Record<string, string | number>) => cachedT(translate, i18n.language, key, options)) as unknown as TFunction
  const markerId = useId()
  const criticalMarkerId = useId()
  const nameById = new Map(rows.map((task) => [task.id, task.name]))

  const arrows = rows.flatMap((task) => {
    const to = bars.get(task.id)
    if (!to) return []
    return task.dependencies.flatMap((dep) => {
      const from = bars.get(dep.predecessorId)
      if (!from || dep.predecessorId === task.id) return []
      if (yRange && (Math.max(from.centerY, to.centerY) < yRange[0] || Math.min(from.centerY, to.centerY) > yRange[1])) return []
      const days = t('gantt.workingDays', { count: Math.abs(dep.lagDays) })
      const lag = dep.lagDays > 0 ? t('gantt.lag', { days }) : dep.lagDays < 0 ? t('gantt.lead', { days }) : ''
      const title = t('gantt.dependency', {
        from: nameById.get(dep.predecessorId),
        to: task.name,
        type: `${dep.type} – ${t(`gantt.dependencyType.${dep.type}`)}`,
        lag,
      })
      const isCritical = critical !== null && critical.has(task.id) && critical.has(dep.predecessorId)
      return [{ key: `${dep.predecessorId}-${task.id}-${dep.type}`, path: pointsToPath(dependencyPoints(from, to, dep.type)), title, isCritical }]
    })
  })

  return (
    <g>
      <defs>
        <marker id={markerId} viewBox="0 0 6 6" refX={6} refY={3} markerWidth={6} markerHeight={6} orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" className="fill-slate-500 dark:fill-slate-400" />
        </marker>
        <marker id={criticalMarkerId} viewBox="0 0 6 6" refX={6} refY={3} markerWidth={6} markerHeight={6} orient="auto">
          <path d="M 0 0 L 6 3 L 0 6 z" className="fill-miro-gold dark:fill-miro-yellow/70" />
        </marker>
      </defs>
      {arrows.map((a) => (
        <g key={a.key}>
          <title>{a.title}</title>
          {/* Široká neviditelná čára – aby šlo na tenkou šipku snadno najet myší a zobrazit bublinu. */}
          <path d={a.path} fill="none" stroke="transparent" strokeWidth={8} />
          <path
            d={a.path}
            fill="none"
            strokeWidth={a.isCritical ? 1.75 : 1.25}
            markerEnd={`url(#${a.isCritical ? criticalMarkerId : markerId})`}
            className={a.isCritical ? 'stroke-miro-gold dark:stroke-miro-yellow/70' : 'stroke-slate-500 dark:stroke-slate-400'}
          />
        </g>
      ))}
    </g>
  )
})
