/**
 * Mobilní verze – Plán jako seznam karet (jen prohlížení).
 * Fáze = nadpis skupiny (jde sbalit), činnost / milník = karta: název, WBS, termín, délka,
 * proužek % hotovo, označení kritické cesty a 📌. Klepnutí kartu rozbalí: předchůdci, náklady
 * po řádcích (zdroje), poznámka. Data připravuje model/mobilePlan.ts (testováno).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatIsoDate } from '../../i18n/format'
import { lineDisplayName, mobilePlanRows, type MobilePlanRow } from '../../model/mobilePlan'
import { formatMoney } from '../../model/money'
import { formatPredecessorsWith, rowNumbers } from '../../model/predecessors'
import { useCosts, usePercents, useProject, useSchedule } from '../../store/useProject'
import { useViewState } from '../viewState'

export function MobilePlanList() {
  const { t, i18n } = useTranslation()
  const project = useProject((s) => s.project)
  const scheduled = useSchedule()
  const costs = useCosts()
  const percents = usePercents()
  const collapsed = useViewState((s) => s.collapsed)
  const toggleCollapsed = useViewState((s) => s.toggleCollapsed)
  const [openId, setOpenId] = useState<string | null>(null)
  const rows = useMemo(() => mobilePlanRows(project, scheduled, collapsed), [project, scheduled, collapsed])
  const numbers = useMemo(() => rowNumbers(project), [project])
  const lang = i18n.language
  const money = (amount: number) => formatMoney(amount, project.currency, lang)

  if (project.tasks.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="font-medium">{t('table.emptyTitle')}</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('mobile.emptyHint')}</p>
      </div>
    )
  }

  const range = (row: MobilePlanRow) => {
    if (!row.start || !row.finish) return t('table.notComputed')
    const from = formatIsoDate(row.start, lang)
    const to = formatIsoDate(row.finish, lang)
    return from === to ? from : t('gantt.range', { from, to })
  }

  return (
    <ul className="space-y-2 px-3 py-3">
      {rows.map((row) => {
        const { task } = row
        const percent = Math.round(percents.get(task.id) ?? task.percentComplete)
        const critical = !!scheduled.tasks.get(task.id)?.critical
        const cost = costs.byTask.get(task.id)?.total.total ?? 0
        const indent = { marginLeft: Math.min(row.depth, 4) * 12 }

        // Fáze: nadpis skupiny se sbalením.
        if (task.kind === 'phase') {
          const isCollapsed = collapsed.has(task.id)
          return (
            <li key={task.id} style={indent}>
              <button
                type="button"
                aria-expanded={row.hasChildren ? !isCollapsed : undefined}
                onClick={() => row.hasChildren && toggleCollapsed(task.id)}
                className="flex w-full items-start gap-2 rounded-md px-1 pt-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span aria-hidden="true" className="w-4 shrink-0 pt-0.5 text-slate-500">
                  {row.hasChildren ? (isCollapsed ? '▸' : '▾') : ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    <span className="mr-1.5 text-xs font-normal tabular-nums text-slate-500 dark:text-slate-400">{row.wbs}</span>
                    {task.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">
                    {range(row)} · {t('gantt.workingDays', { count: row.durationDays })}
                    {cost > 0 && <> · {money(cost)}</>}
                  </span>
                  <ProgressBar percent={percent} label={t('mobile.percent', { percent })} />
                </span>
              </button>
            </li>
          )
        }

        // Činnost / milník: karta s rozbalením detailu.
        const open = openId === task.id
        const predecessors = formatPredecessorsWith(numbers, task)
        return (
          <li key={task.id} style={indent}>
            <div
              className={`rounded-lg border bg-white dark:bg-slate-900 ${
                critical ? 'border-slate-200 border-l-4 border-l-miro-yellow dark:border-slate-700 dark:border-l-miro-yellow' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : task.id)}
                className="block w-full rounded-lg px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 font-medium">
                    {task.kind === 'milestone' && (
                      <span aria-hidden="true" className="mr-1">
                        ◆
                      </span>
                    )}
                    {task.name}
                    {task.constraintStart && (
                      <span className="ml-1" title={t('table.constraint', { date: formatIsoDate(task.constraintStart, lang) })}>
                        <span aria-hidden="true">📌</span>
                        <span className="sr-only">{t('table.constraint', { date: formatIsoDate(task.constraintStart, lang) })}</span>
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">{row.wbs}</span>
                </span>
                <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">
                  {task.kind === 'milestone' ? range(row) : `${range(row)} · ${t('gantt.workingDays', { count: row.durationDays })}`}
                  {critical && (
                    <span className="ml-1.5 rounded bg-miro-yellow-light px-1.5 py-px font-medium text-miro-graphite dark:bg-miro-yellow/20 dark:text-miro-yellow-light">
                      {t('mobile.critical')}
                    </span>
                  )}
                </span>
                {task.kind === 'milestone' ? (
                  <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">{percent >= 100 ? `✓ ${t('gantt.milestoneDone')}` : ''}</span>
                ) : (
                  <ProgressBar percent={percent} label={t('mobile.percent', { percent })} />
                )}
              </button>

              {open && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                  <dt className="text-slate-600 dark:text-slate-400">{t('table.predecessors')}</dt>
                  <dd>{predecessors || '–'}</dd>
                  <dt className="text-slate-600 dark:text-slate-400">{t('detail.cost')}</dt>
                  <dd className="tabular-nums">{money(cost)}</dd>
                  {task.lines.length > 0 && (
                    <>
                      <dt className="text-slate-600 dark:text-slate-400">{t('mobile.lines')}</dt>
                      <dd>
                        <ul className="space-y-0.5">
                          {task.lines.map((line) => (
                            <li key={line.id} className="flex justify-between gap-2">
                              <span className="min-w-0">
                                <span className="text-slate-500 dark:text-slate-400">{t(`detail.kind.${line.kind}`)}: </span>
                                {lineDisplayName(project, line)}
                              </span>
                              <span className="shrink-0 tabular-nums">{money(costs.lines.get(line.id)?.amount ?? 0)}</span>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </>
                  )}
                  {task.notes && (
                    <>
                      <dt className="text-slate-600 dark:text-slate-400">{t('table.notes')}</dt>
                      <dd className="whitespace-pre-wrap break-words">{task.notes}</dd>
                    </>
                  )}
                </dl>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Proužek % hotovo (tyrkysová výplň) s číslem; pro čtečky jako progressbar. */
function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const { t } = useTranslation()
  const value = Math.max(0, Math.min(100, percent))
  return (
    <span className="mt-1.5 flex items-center gap-2">
      <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <span className="block h-full rounded-full bg-miro-turquoise-dark dark:bg-miro-turquoise" style={{ width: `${value}%` }} />
      </span>
      <span aria-hidden="true" className="w-11 whitespace-nowrap text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
        {t('mobile.percentValue', { percent: value })}
      </span>
    </span>
  )
}
