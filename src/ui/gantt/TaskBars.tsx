/**
 * Úsečky v Ganttově grafu (G-07):
 *  - činnost = obdélník přes dny, kdy se pracuje,
 *  - fáze    = tenká tmavá sumární úsečka se „špičkami“ dolů na obou koncích,
 *  - milník  = kosočtverec na konci svého dne.
 * Typ poznáte podle tvaru, ne jen podle barvy (U-06).
 * Činnosti bez termínu (např. v kruhu vazeb) se nekreslí.
 * Fáze 9 (G-08): % hotovo = tmavší výplň zleva; po zapnutí přepínače Baseline tenká šedá
 * stínová úsečka pod úsečkou s termíny vybrané baseline (posun konce v bublině).
 * Fáze 13c (G-09): na dotykovém displeji jsou úchyty větší a kolečka vazeb u vybraných řádků stále vidět.
 */
import { memo } from 'react'
import { useCoarsePointer } from '../useCoarsePointer'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { cachedT } from '../../i18n/cachedT'
import { LABEL_GAP } from '../../gantt/barLabels'
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

/** Řádky bubliny navíc: % hotovo a termíny baseline s posunem konce. */
function progressLines(task: Task, percent: number, baseline: BaselineBar | undefined, baselineName: string, t: TFunction, lang: string): string {
  let text = task.kind === 'milestone' ? (percent >= 100 ? `\n✓ ${t('gantt.milestoneDone')}` : '') : `\n${t('gantt.barPercent', { pct: percent })}`
  if (baseline) {
    const from = formatIsoDate(baseline.start, lang)
    const to = formatIsoDate(baseline.finish, lang)
    const range = from === to ? from : t('gantt.range', { from, to })
    const shift =
      baseline.finishShift === null
        ? ''
        : baseline.finishShift === 0
          ? t('gantt.shiftNone')
          : t(baseline.finishShift > 0 ? 'gantt.shiftLater' : 'gantt.shiftEarlier', { count: Math.abs(baseline.finishShift) })
    text += `\n${t('gantt.barBaseline', { name: baselineName, range })}${shift ? ` – ${shift}` : ''}`
  }
  return text
}

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

/** Šířka úchytu pro změnu délky na okraji úsečky (px); na dotykovém displeji širší pro prst. */
const EDGE_HANDLE = 6
const EDGE_HANDLE_TOUCH = 16

/**
 * Neviditelné úchyty pro tažení (zpracovává je BarDragLayer.tsx):
 * tělo úsečky = posun, okraje = změna začátku / konce. Fáze úchyty nemá.
 */
function DragHandles({ bar, taskId, touch }: { bar: Bar; taskId: string; touch: boolean }) {
  if (bar.kind === 'phase') return null
  // Prstem se úsečka chytá po celé výšce řádku.
  const top = touch ? bar.centerY - ROW_HALF : bar.centerY - TASK_BAR_HEIGHT / 2 - 2
  const height = touch ? ROW_HEIGHT : TASK_BAR_HEIGHT + 4
  const width = Math.max(MIN_WIDTH, bar.xEnd - bar.xStart)
  const common = { y: top, height, fill: 'transparent', 'data-drag-task': taskId, style: { touchAction: 'none' } }
  if (bar.kind === 'milestone') {
    return <rect {...common} x={bar.xStart} width={width} data-drag-mode="move" className="cursor-grab" />
  }
  // U krátkých úseček zabírají okraje nejvýš třetinu šířky, aby šlo chytit i tělo.
  const edge = Math.min(touch ? EDGE_HANDLE_TOUCH : EDGE_HANDLE, width / 3)
  return (
    <>
      <rect {...common} x={bar.xStart} width={width} data-drag-mode="move" className="cursor-grab" />
      <rect {...common} x={bar.xStart - edge / 2} width={edge} data-drag-mode="start" className="cursor-ew-resize" />
      <rect {...common} x={bar.xStart + width - edge / 2} width={edge} data-drag-mode="end" className="cursor-ew-resize" />
    </>
  )
}

/** Úsečka baseline pod řádkem: tenký šedý pruh (u milníku malý kosočtverec). */
export interface BaselineBar {
  bar: Bar
  start: string
  finish: string
  /** Posun aktuálního konce proti baseline v kalendářních dnech; null = nejde porovnat. */
  finishShift: number | null
}

const BASELINE_HEIGHT = 4

function BaselineShape({ bar }: { bar: Bar }) {
  const y = bar.centerY + BAR_HALF_HEIGHT + 2
  const cls = 'fill-slate-400 dark:fill-slate-500'
  if (bar.kind === 'milestone') {
    const cx = bar.xStart + MILESTONE_HALF
    const h = 3
    return <polygon points={`${cx},${y - 1} ${cx + h},${y + h - 1} ${cx},${y + 2 * h - 1} ${cx - h},${y + h - 1}`} className={cls} pointerEvents="none" />
  }
  return <rect x={bar.xStart} y={y} width={Math.max(MIN_WIDTH, bar.xEnd - bar.xStart)} height={BASELINE_HEIGHT} rx={1.5} className={cls} pointerEvents="none" />
}

/** Výplň % hotovo zleva (činnost a fáze; milník je hotový celý, nebo vůbec). */
function Progress({ bar, percent, critical }: { bar: Bar; percent: number; critical: boolean | null }) {
  if (bar.kind === 'milestone' || percent <= 0) return null
  const width = Math.max(MIN_WIDTH, bar.xEnd - bar.xStart)
  const filled = (width * Math.min(100, percent)) / 100
  if (bar.kind === 'phase') {
    // Tmavý vzhled: fáze je světle šedá, proto tmavá tyrkysová výplň (kontrast ≥ 3 : 1).
    return (
      <rect
        x={bar.xStart}
        y={bar.centerY - TASK_BAR_HEIGHT / 2 + 1.5}
        width={filled}
        height={PHASE_BAR_HEIGHT - 3}
        className="fill-miro-turquoise dark:fill-miro-turquoise-dark"
        pointerEvents="none"
      />
    )
  }
  // Tmavý vzhled: jasná tyrkysová na ztmavené úsečce; u kritické (žlutavé) úsečky tmavý grafit.
  return (
    <rect
      x={bar.xStart + 1}
      y={bar.centerY - TASK_BAR_HEIGHT / 2 + 3}
      width={Math.max(0, filled - 2)}
      height={TASK_BAR_HEIGHT - 6}
      rx={2}
      className={critical ? 'fill-miro-graphite/70 dark:fill-miro-graphite/85' : 'fill-miro-turquoise-dark dark:fill-miro-turquoise'}
      pointerEvents="none"
    />
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
            {/* V tmavém vzhledu slabší výplň, aby jasná výplň % hotovo byla dobře odlišená (kontrast ≈ 8 : 1). */}
            <rect {...rect} className="fill-miro-turquoise/35 stroke-miro-turquoise-dark dark:fill-miro-turquoise/15 dark:stroke-miro-turquoise" strokeWidth={1} />
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
/** Na dotykovém displeji: větší kolečko dál od úsečky (aby se nechytal okraj). */
const LINK_OFFSET_TOUCH = 18
const LINK_RADIUS_TOUCH = 8

/**
 * Kolečka pro kreslení vazby (G-03) na začátku a konci úsečky – objeví se po najetí myší
 * (zpracovává je LinkDragLayer.tsx). Neviditelná „zóna najetí“ kolem úsečky drží kolečka
 * viditelná i ve chvíli, kdy myš z úsečky přejíždí na kolečko. Fáze kolečka nemá.
 */
function LinkHandles({ bar, taskId, label, touch, selected }: { bar: Bar; taskId: string; label: string; touch: boolean; selected: boolean }) {
  if (bar.kind === 'phase') return null
  // Prstem nejde „najet“ – u vybraného řádku jsou kolečka vidět stále.
  const visible = touch && selected
  const offset = touch ? LINK_OFFSET_TOUCH : LINK_OFFSET
  const cy = bar.centerY
  const xEnd = Math.max(bar.xEnd, bar.xStart + MIN_WIDTH)
  const circle = (anchor: 'start' | 'end', cx: number) => (
    <circle
      cx={cx}
      cy={cy}
      r={touch ? LINK_RADIUS_TOUCH : LINK_RADIUS}
      data-link-task={taskId}
      data-link-anchor={anchor}
      style={{ touchAction: 'none' }}
      className={`cursor-crosshair fill-white stroke-miro-turquoise-dark transition-opacity group-hover:opacity-100 dark:fill-slate-900 dark:stroke-miro-turquoise ${visible ? 'opacity-100' : 'opacity-0'}`}
      strokeWidth={1.5}
    >
      <title>{label}</title>
    </circle>
  )
  return (
    <>
      {circle('start', bar.xStart - offset)}
      {circle('end', xEnd + offset)}
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
  /** % hotovo každé položky (fáze spočítané). */
  percents: Map<string, number>
  /** Stínové úsečky baseline (null = přepínač vypnutý nebo baseline není). */
  baseline: Map<string, BaselineBar> | null
  baselineName: string
  /** Vybrané řádky (na dotykovém displeji u nich zůstanou vidět kolečka vazeb). */
  selectedIds: ReadonlySet<string>
  /** Popisky vedle úseček (id → text); prázdná mapa = bez popisků. */
  labels: ReadonlyMap<string, string>
}

export const TaskBars = memo(function TaskBars({ rows, bars, dates, critical, slackEnds, percents, baseline, baselineName, selectedIds, labels }: TaskBarsProps) {
  const { t: translate, i18n } = useTranslation()
  // Hotové texty bublin z paměti (13c – výkon): 300 úseček × několik překladů při každé změně plánu.
  const t = ((key: string, options?: Record<string, string | number>) => cachedT(translate, i18n.language, key, options)) as unknown as TFunction
  const touch = useCoarsePointer()
  const linkOffset = touch ? LINK_OFFSET_TOUCH : LINK_OFFSET
  const linkRadius = touch ? LINK_RADIUS_TOUCH : LINK_RADIUS
  return (
    <g>
      {rows.map((task) => {
        const d = dates.get(task.id)
        const bar = bars.get(task.id)
        const shadow = baseline?.get(task.id)
        if (!bar || !d?.start || !d.finish) return shadow ? <BaselineShape key={task.id} bar={shadow.bar} /> : null
        const percent = percents.get(task.id) ?? task.percentComplete
        const isCritical = critical === null ? null : critical.has(task.id)
        const hoverZone =
          bar.kind === 'phase' ? null : (
            <rect
              x={bar.xStart - linkOffset - linkRadius - 2}
              y={bar.centerY - ROW_HALF}
              width={Math.max(bar.xEnd, bar.xStart + MIN_WIDTH) - bar.xStart + 2 * (linkOffset + linkRadius + 2)}
              height={2 * ROW_HALF}
              fill="transparent"
            />
          )
        return (
          <g key={task.id} data-task-id={task.id} className="group">
            <title>{barTitle(task, { start: d.start, finish: d.finish }, t, i18n.language) + progressLines(task, percent, shadow, baselineName, t, i18n.language)}</title>
            {hoverZone}
            {shadow && <BaselineShape bar={shadow.bar} />}
            {slackEnds?.has(task.id) && <SlackBar bar={bar} to={slackEnds.get(task.id) as number} title={t('gantt.slackBar', { count: d.totalSlack ?? 0 })} />}
            <Shape bar={bar} critical={isCritical} />
            <Progress bar={bar} percent={percent} critical={isCritical} />
            <DragHandles bar={bar} taskId={task.id} touch={touch} />
            <LinkHandles bar={bar} taskId={task.id} label={t('gantt.linkHandle')} touch={touch} selected={selectedIds.has(task.id)} />
            {labels.has(task.id) && (
              // Popisek vpravo od úsečky (za kolečkem vazby); jen text, myš jím prochází na graf.
              <text
                x={Math.max(bar.xEnd, bar.xStart + (bar.kind === 'milestone' ? 2 * MILESTONE_HALF : MIN_WIDTH)) + (touch ? LINK_OFFSET_TOUCH + LINK_RADIUS_TOUCH : LABEL_GAP)}
                y={bar.centerY + 4}
                aria-hidden="true"
                className="pointer-events-none select-none fill-slate-700 text-[11px] dark:fill-slate-300"
              >
                {labels.get(task.id)}
              </text>
            )}
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
