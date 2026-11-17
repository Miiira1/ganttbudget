/**
 * Detail vybraného zdroje v pohledu Vytížení: histogram (sloupce = naplánované hodiny v období,
 * čára = kapacita) a seznam činností, které zdroj vytěžují. Klik na činnost ji ukáže v plánu.
 */
import { useTranslation } from 'react-i18next'
import { dayToIso } from '../../engine/calendar'
import { formatIsoDate } from '../../i18n/format'
import { wbsNumbers } from '../../model/hierarchy'
import type { LoadRange, PeriodLoad, ResourceLoad } from '../../model/load'
import { useProject, useSchedule } from '../../store/useProject'
import { revealTask } from '../revealTask'
import { cellLevel, formatHours } from './loadCells'

interface Label {
  top: string
  bottom: string
  title: string
}

export function LoadDetail({
  resource,
  periods,
  summaries,
  labels,
  absenceDays,
  onShowPlan,
}: {
  resource: ResourceLoad
  periods: LoadRange[]
  summaries: PeriodLoad[]
  labels: Label[]
  absenceDays: number
  onShowPlan: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const project = useProject((s) => s.project)
  const scheduled = useSchedule()
  const tasks = new Map(project.tasks.map((x) => [x.id, x]))
  const wbs = wbsNumbers(project)
  const workers = new Map(project.workers.map((w) => [w.id, w.name]))

  const capacityPerDay =
    resource.kind === 'worker'
      ? project.workers.find((w) => w.id === resource.id)?.capacityPerDay
      : resource.kind === 'machine'
        ? project.machines.find((m) => m.id === resource.id)?.capacityPerDay
        : project.workers.filter((w) => w.professionId === resource.id).reduce((sum, w) => sum + w.capacityPerDay, 0)

  /** Rozbalí sbalené nadřazené fáze, vybere činnost a přepne na plán. */
  const showTask = (id: string) => revealTask(id, onShowPlan)

  const rows = [...resource.contributions].sort((a, b) => a.startDay - b.startDay || (wbs.get(a.taskId) ?? '').localeCompare(wbs.get(b.taskId) ?? ''))

  return (
    <section
      aria-label={t('load.detail.label', { name: resource.name })}
      className="max-h-[45%] shrink-0 overflow-auto border-t-2 border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">{resource.name}</h2>
        <span className="text-sm text-slate-600 dark:text-slate-400">{t(`load.kind.${resource.kind}`)}</span>
        {resource.hasCapacity && capacityPerDay !== undefined && (
          <span className="text-sm text-slate-600 dark:text-slate-400">{t('load.detail.capacity', { hours: formatHours(capacityPerDay, lang) })}</span>
        )}
        {absenceDays > 0 && <span className="text-sm text-slate-600 dark:text-slate-400">{t('load.detail.absence', { count: absenceDays })}</span>}
        {resource.overloadedDays.length > 0 && (
          <span className="text-sm font-semibold text-red-700 dark:text-red-300">{t('load.overloadedDays', { count: resource.overloadedDays.length })}</span>
        )}
      </div>
      {!resource.hasCapacity && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('load.detail.noWorkers')}</p>}

      <div className="mt-3 flex flex-col gap-4 xl:flex-row">
        <Histogram resource={resource} periods={periods} summaries={summaries} labels={labels} />

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{t('load.detail.tasks')}</h3>
          {rows.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('load.detail.noTasks')}</p>
          ) : (
            <table className="mt-1 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th scope="col" className="py-1 pr-2 font-medium">{t('load.detail.columns.wbs')}</th>
                  <th scope="col" className="py-1 pr-2 font-medium">{t('load.detail.columns.task')}</th>
                  {resource.kind === 'profession' && <th scope="col" className="py-1 pr-2 font-medium">{t('load.detail.columns.who')}</th>}
                  <th scope="col" className="py-1 pr-2 text-right font-medium">{t('load.detail.columns.hoursPerDay')}</th>
                  <th scope="col" className="py-1 pr-2 font-medium">{t('load.detail.columns.dates')}</th>
                  <th scope="col" className="py-1 text-right font-medium">{t('load.detail.columns.hours')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const task = tasks.get(c.taskId)
                  const line = task?.lines.find((l) => l.id === c.lineId)
                  const days = scheduled.tasks.get(c.taskId)?.durationDays ?? 0
                  const name = task?.name ?? ''
                  return (
                    <tr key={c.lineId} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1 pr-2 tabular-nums text-slate-500 dark:text-slate-400">{wbs.get(c.taskId)}</td>
                      <td className="py-1 pr-2">
                        <button
                          type="button"
                          onClick={() => showTask(c.taskId)}
                          title={t('load.detail.showInPlan', { name })}
                          className="rounded text-left underline decoration-miro-turquoise decoration-2 underline-offset-4 hover:text-miro-turquoise-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:text-miro-turquoise"
                        >
                          {name}
                        </button>
                      </td>
                      {resource.kind === 'profession' && (
                        <td className="py-1 pr-2 text-slate-600 dark:text-slate-300">
                          {line?.kind === 'labor' && line.workerId ? workers.get(line.workerId) : t('load.detail.anyWorker')}
                        </td>
                      )}
                      <td className="py-1 pr-2 text-right tabular-nums">{formatHours(c.hoursPerDay, lang)}</td>
                      <td className="whitespace-nowrap py-1 pr-2 tabular-nums">
                        {formatIsoDate(dayToIso(c.startDay), lang)} – {formatIsoDate(dayToIso(c.finishDay), lang)}
                      </td>
                      <td className="py-1 text-right tabular-nums">{formatHours(c.hoursPerDay * days, lang)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}

const PLOT_HEIGHT = 120
const AXIS_WIDTH = 44
const LABEL_HEIGHT = 18

/** Histogram v SVG (bez knihovny): sloupec = hodiny v období, schodovitá čára = kapacita. Sdílený se souhrnem skupiny. */
export function Histogram({ resource, periods, summaries, labels }: { resource: ResourceLoad; periods: LoadRange[]; summaries: PeriodLoad[]; labels: Label[] }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  // Celé období se má vejít do ~600 px (sloupec 3–24 px); jen u velmi dlouhých řad dnů se posouvá.
  const slot = Math.max(3, Math.min(24, Math.floor(600 / Math.max(1, periods.length))))
  const bar = Math.max(2, slot - (slot > 10 ? 6 : slot > 5 ? 2 : 1))
  const max = Math.max(1, ...summaries.map((s) => Math.max(s.demand, resource.hasCapacity ? s.capacity : 0)))
  const y = (hours: number) => PLOT_HEIGHT - (hours / max) * PLOT_HEIGHT
  const width = AXIS_WIDTH + periods.length * slot + 4
  // Popisek pod osou jen u každého n-tého sloupce, aby se nepřekrývaly (aspoň ~44 px od sebe).
  const labelEvery = Math.max(1, Math.ceil(44 / slot))

  let capacityPath = ''
  if (resource.hasCapacity) {
    summaries.forEach((s, i) => {
      const x0 = AXIS_WIDTH + i * slot
      capacityPath += `${i === 0 ? 'M' : 'L'} ${x0} ${y(s.capacity)} L ${x0 + slot} ${y(s.capacity)} `
    })
  }
  const total = summaries.reduce((sum, s) => sum + s.demand, 0)

  return (
    <figure className="shrink-0 overflow-x-auto xl:max-w-[55%]">
      <figcaption className="mb-1 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{t('load.detail.histogram')}</span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block h-2.5 w-3 rounded-sm border border-miro-turquoise-dark bg-miro-turquoise/35 dark:border-miro-turquoise" />
          {t('load.detail.demand')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block h-2.5 w-3 rounded-sm border border-red-700 bg-red-500/70 dark:border-red-300" />
          {t('load.legend.over')}
        </span>
        {resource.hasCapacity && (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-miro-graphite dark:bg-miro-paper" />
            {t('load.detail.capacityLine')}
          </span>
        )}
      </figcaption>
      <svg
        width={width}
        height={PLOT_HEIGHT + LABEL_HEIGHT + 6}
        role="img"
        aria-label={t('load.detail.histogramSummary', { name: resource.name, hours: formatHours(total, lang) })}
        className="block"
      >
        <g className="text-[10px]">
          <text x={AXIS_WIDTH - 6} y={8} textAnchor="end" className="fill-slate-500 dark:fill-slate-400">
            {formatHours(max, lang)} h
          </text>
          <text x={AXIS_WIDTH - 6} y={PLOT_HEIGHT} textAnchor="end" className="fill-slate-500 dark:fill-slate-400">
            0
          </text>
        </g>
        <line x1={AXIS_WIDTH} x2={width - 4} y1={PLOT_HEIGHT + 0.5} y2={PLOT_HEIGHT + 0.5} className="stroke-slate-300 dark:stroke-slate-600" />
        <line x1={AXIS_WIDTH} x2={width - 4} y1={0.5} y2={0.5} className="stroke-slate-200 dark:stroke-slate-700" strokeDasharray="2 3" />
        {summaries.map((s, i) => {
          const over = cellLevel(s, resource) === 'over'
          const h = (s.demand / max) * PLOT_HEIGHT
          const x = AXIS_WIDTH + i * slot + (slot - bar) / 2
          return (
            <g key={periods[i]!.startDay}>
              {s.demand > 0 && (
                <rect
                  x={x + 0.5}
                  y={PLOT_HEIGHT - h + 0.5}
                  width={bar - 1}
                  height={Math.max(0, h - 1)}
                  rx={1.5}
                  strokeWidth={1}
                  className={
                    over
                      ? 'fill-red-500/70 stroke-red-700 dark:fill-red-500/60 dark:stroke-red-300'
                      : 'fill-miro-turquoise/35 stroke-miro-turquoise-dark dark:fill-miro-turquoise/30 dark:stroke-miro-turquoise'
                  }
                />
              )}
              {/* Neviditelná plocha přes celý sloupec – bublina s údaji i nad prázdným obdobím. */}
              <rect x={AXIS_WIDTH + i * slot} y={0} width={slot} height={PLOT_HEIGHT} fill="transparent">
                <title>
                  {t('load.detail.bar', {
                    period: labels[i]!.title,
                    demand: formatHours(s.demand, lang),
                    capacity: formatHours(s.capacity, lang),
                  })}
                </title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={AXIS_WIDTH + i * slot + slot / 2} y={PLOT_HEIGHT + LABEL_HEIGHT - 4} textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400">
                  {labels[i]!.top}
                </text>
              )}
            </g>
          )
        })}
        {capacityPath && <path d={capacityPath} fill="none" strokeWidth={1.5} className="stroke-miro-graphite dark:stroke-miro-paper" pointerEvents="none" />}
      </svg>
    </figure>
  )
}
