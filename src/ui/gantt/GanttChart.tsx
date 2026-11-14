/**
 * Ganttův graf (G-01, G-04, G-07) – vlastní kreslení v SVG.
 * Vrstvy odspodu: volné dny (víkend / svátek / odstávka), mřížka, dnešek, šipky vazeb, úsečky.
 *
 * Bubliny (SVG <title>) obsahují jen text – názvy odstávek od uživatele se nikdy
 * nevkládají jako HTML.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { createWorkCalendar, dayToIso, isoToDay } from '../../engine/calendar'
import { formatIsoDate } from '../../i18n/format'
import { layoutBars, ROW_HEIGHT } from '../../gantt/geometry'
import { createTimeline, dayToX, headerRows, nonWorkingRuns, type NonWorkingRun, type Timeline } from '../../gantt/timeline'
import { todayIso } from '../../model/dates'
import { useProject, useSchedule } from '../../store/useProject'
import { BarDragLayer } from './BarDragLayer'
import { LinkDragLayer } from './LinkDragLayer'
import { DependencyArrows } from './DependencyArrows'
import { TaskBars } from './TaskBars'
import { TimelineHeader } from './TimelineHeader'
import { useSelectedId, useVisibleRows } from '../viewState'
import { useZoom } from './zoom'

/** Text bubliny pro pruh volných dnů. */
function runTitle(run: NonWorkingRun, t: TFunction, lang: string): string {
  const from = formatIsoDate(dayToIso(run.startDay), lang)
  const to = formatIsoDate(dayToIso(run.endDay - 1), lang)
  const range = from === to ? from : t('gantt.range', { from, to })
  switch (run.info.kind) {
    case 'weekend':
      return t('gantt.weekend', { range })
    case 'holiday':
      return t('gantt.holiday', { name: t(`holiday.${run.info.key}`), range })
    case 'custom':
      return t('gantt.custom', { name: run.info.name, range })
  }
}

/**
 * Při změně zoomu (nebo posunu začátku osy) zůstane vlevo vidět stejný den,
 * jinak by uživatel po přepnutí „ztratil“ místo, kam se díval.
 *
 * Den u levého okraje si pamatujeme průběžně při posouvání. Číst ho až po přepnutí nejde:
 * když se graf zúží, prohlížeč posun sám ořízne dřív, než se k němu dostaneme.
 */
function useKeepVisibleDay(wrapperRef: RefObject<HTMLDivElement | null>, tl: Timeline) {
  const current = useRef<Timeline | null>(null)
  const leftDay = useRef<number | null>(null)

  useEffect(() => {
    const scroller = wrapperRef.current?.parentElement
    if (!scroller) return
    const onScroll = () => {
      const timeline = current.current
      if (timeline) leftDay.current = timeline.startDay + scroller.scrollLeft / timeline.dayWidth
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [wrapperRef])

  useLayoutEffect(() => {
    const scroller = wrapperRef.current?.parentElement
    const prev = current.current
    current.current = tl
    if (!scroller || !prev || (prev.zoom === tl.zoom && prev.startDay === tl.startDay)) return
    if (leftDay.current !== null) scroller.scrollLeft = Math.max(0, dayToX(tl, leftDay.current))
  }, [wrapperRef, tl])
}

export function GanttChart() {
  const { t, i18n } = useTranslation()
  const project = useProject((s) => s.project)
  const { projectFinish, tasks: dates } = useSchedule()
  const zoom = useZoom((s) => s.zoom)
  // Jen viditelné řádky (bez položek sbalených fází) – stejné jako v tabulce.
  const rows = useVisibleRows(project)
  const selectedId = useSelectedId(project)
  const selectedIndex = rows.findIndex((task) => task.id === selectedId)
  const patternId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const tl = useMemo(
    () => createTimeline({ zoom, projectStart: project.startDate, projectFinish }),
    [zoom, project.startDate, projectFinish],
  )
  const calendar = useMemo(() => createWorkCalendar(project.calendar), [project.calendar])
  // V měřítku Měsíce/Čtvrtletí by víkendy byly jen proužky přes celý graf – ukážeme jen svátky a odstávky.
  const showWeekends = zoom === 'day' || zoom === 'week'
  const runs = useMemo(
    () => nonWorkingRuns(tl, calendar).filter((r) => showWeekends || r.info.kind !== 'weekend'),
    [tl, calendar, showWeekends],
  )
  const bars = useMemo(() => layoutBars(tl, rows, dates), [tl, rows, dates])
  const gridLines = useMemo(() => headerRows(tl)[1].slice(1).map((s) => s.x), [tl])
  useKeepVisibleDay(wrapperRef, tl)

  const bodyHeight = rows.length * ROW_HEIGHT
  const today = todayIso()
  const todayDay = isoToDay(today)
  const showToday = todayDay >= tl.startDay && todayDay < tl.endDay
  const lang = i18n.language

  const fillClass: Record<NonWorkingRun['info']['kind'], string> = {
    weekend: 'fill-slate-100 dark:fill-slate-800/70',
    holiday: 'fill-amber-100 dark:fill-amber-900/40',
    custom: 'fill-violet-100 dark:fill-violet-900/40',
  }
  const background: ReactNode[] = runs.map((run) => {
    const x = dayToX(tl, run.startDay)
    const width = (run.endDay - run.startDay) * tl.dayWidth
    const hatched = run.info.kind !== 'weekend'
    return (
      <g key={run.startDay}>
        <title>{runTitle(run, t, lang)}</title>
        <rect x={x} y={0} width={width} height="100%" className={fillClass[run.info.kind]} />
        {hatched && <rect x={x} y={0} width={width} height="100%" fill={`url(#${patternId}-${run.info.kind})`} />}
      </g>
    )
  })

  return (
    // min-h-full: pozadí (víkendy, dnešek) vyplní celou výšku, i když je činností málo.
    <div ref={wrapperRef} className="flex min-h-full flex-col" style={{ width: tl.width }}>
      <TimelineHeader tl={tl} />
      <svg
        ref={svgRef}
        width={tl.width}
        role="img"
        aria-label={t('gantt.chartLabel')}
        className="block flex-1"
        style={{ minHeight: bodyHeight }}
      >
        <defs>
          {/* Šrafování odliší svátky a odstávky i bez rozlišení barev (U-06). */}
          <pattern id={`${patternId}-holiday`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={6} strokeWidth={2} className="stroke-amber-300 dark:stroke-amber-700/70" />
          </pattern>
          <pattern id={`${patternId}-custom`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1={0} y1={0} x2={0} y2={6} strokeWidth={2} className="stroke-violet-300 dark:stroke-violet-700/70" />
          </pattern>
        </defs>

        {background}

        {/* Vybraný řádek – stejně zvýrazněný jako v tabulce. */}
        {selectedIndex >= 0 && (
          <rect
            x={0}
            y={selectedIndex * ROW_HEIGHT}
            width={tl.width}
            height={ROW_HEIGHT}
            className="fill-blue-100/80 dark:fill-blue-900/40"
          />
        )}

        {/* Svislá mřížka po úsecích dolního řádku hlavičky (dny, týdny, měsíce, čtvrtletí). */}
        {gridLines.map((x) => (
          <line key={x} x1={x - 0.5} x2={x - 0.5} y1={0} y2="100%" className="stroke-slate-200 dark:stroke-slate-700/60" />
        ))}

        {/* Vodorovné čáry mezi řádky – lícují s tabulkou vlevo. */}
        {rows.map((task, i) => (
          <line
            key={task.id}
            x1={0}
            x2={tl.width}
            y1={(i + 1) * ROW_HEIGHT - 0.5}
            y2={(i + 1) * ROW_HEIGHT - 0.5}
            className="stroke-slate-200 dark:stroke-slate-700/70"
          />
        ))}

        {/* Dnešek: červená svislá čára uprostřed dnešního dne. */}
        {showToday && (
          <g>
            <title>{t('gantt.today', { date: formatIsoDate(today, lang) })}</title>
            <line
              x1={dayToX(tl, todayDay) + tl.dayWidth / 2}
              x2={dayToX(tl, todayDay) + tl.dayWidth / 2}
              y1={0}
              y2="100%"
              strokeWidth={2}
              className="stroke-red-500"
            />
          </g>
        )}

        {/* Šipky vazeb pod úsečkami, úsečky nad čárou dneška, aby byly čitelné. */}
        <DependencyArrows rows={rows} bars={bars} />
        <TaskBars rows={rows} bars={bars} dates={dates} />

        {/* Náhled při tažení úsečky (G-02) – nad vším ostatním. */}
        <BarDragLayer svgRef={svgRef} tl={tl} calendar={calendar} rows={rows} dates={dates} />
        {/* Kreslení vazby tažením z koleček na koncích úseček (G-03). */}
        <LinkDragLayer svgRef={svgRef} rows={rows} bars={bars} />
      </svg>
    </div>
  )
}
