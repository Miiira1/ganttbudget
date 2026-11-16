/**
 * Pohled Vytížení (fáze 6c, Z-03): mřížka zdrojů × období a pod ní detail vybraného zdroje
 * (histogram poptávky proti kapacitě a seznam činností, které ho vytěžují).
 * Jen čte – nic v projektu nemění, takže nevzniká žádný krok Zpět.
 */
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { absenceWorkingDays } from '../../model/catalogs'
import { loadPeriods, summarizePeriod, type LoadPeriodUnit, type LoadResourceKind, type PeriodLoad, type ResourceLoad } from '../../model/load'
import { useLoad, useProject } from '../../store/useProject'
import { loadPreference, savePreference } from '../preferences'
import { LoadDetail } from './LoadDetail'
import { CELL_CLASS, cellLevel, cellText, cellTitle, periodLabel } from './loadCells'

const UNITS: readonly LoadPeriodUnit[] = ['day', 'week', 'month']
const GROUPS: readonly LoadResourceKind[] = ['worker', 'profession', 'machine']
/** Šířka sloupce období podle jednotky (dny jsou užší, měsíce širší). */
const COLUMN_WIDTH: Record<LoadPeriodUnit, string> = { day: 'min-w-[3rem]', week: 'min-w-[3.5rem]', month: 'min-w-[4.25rem]' }

export function LoadView({ onShowPlan }: { onShowPlan: () => void }) {
  const { t, i18n } = useTranslation()
  const load = useLoad()
  const project = useProject((s) => s.project)
  const [unit, setUnitState] = useState<LoadPeriodUnit>(() => UNITS.find((u) => u === loadPreference('loadUnit')) ?? 'week')
  const setUnit = (next: LoadPeriodUnit) => {
    setUnitState(next)
    savePreference('loadUnit', next)
  }
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const range = load.range
  const periods = useMemo(() => (range ? loadPeriods(range, unit) : []), [range, unit])
  const summaries = useMemo(
    () => new Map(range ? load.resources.map((r) => [r.key, periods.map((p) => summarizePeriod(r, range, p))]) : []),
    [load, range, periods],
  )
  const labels = useMemo(() => periods.map((p) => periodLabel(p, unit, t, i18n.language)), [periods, unit, t, i18n.language])

  if (load.resources.length === 0) return <Empty text={t('load.noResources')} />
  if (!range) return <Empty text={t('load.noPlan')} />

  // Výchozí výběr: první přetížený zdroj, jinak první vytížený, jinak první vůbec.
  const selected =
    load.resources.find((r) => r.key === selectedKey) ??
    load.resources.find((r) => r.overloadedDays.length > 0) ??
    load.resources.find((r) => r.contributions.length > 0) ??
    load.resources[0]!

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <p className="min-w-60 flex-1 text-sm text-slate-600 dark:text-slate-400">{t('load.intro')}</p>
        <Legend />
        <UnitSwitch unit={unit} onChange={setUnit} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 top-0 z-20 min-w-56 border-b border-r border-slate-200 bg-white px-3 py-1 text-left font-semibold dark:border-slate-700 dark:bg-slate-900">
                {t('load.resource')}
              </th>
              {labels.map((l, i) => (
                <th
                  key={periods[i]!.startDay}
                  scope="col"
                  title={l.title}
                  className={`sticky top-0 z-10 border-b border-r border-slate-200 bg-white px-1 py-1 text-center font-medium dark:border-slate-700 dark:bg-slate-900 ${COLUMN_WIDTH[unit]}`}
                >
                  <span className="block text-xs">{l.top}</span>
                  <span className="block text-[0.7rem] font-normal text-slate-500 dark:text-slate-400">{l.bottom}</span>
                </th>
              ))}
            </tr>
          </thead>
          {GROUPS.map((kind) => {
            const rows = load.resources.filter((r) => r.kind === kind)
            if (rows.length === 0) return null
            return (
              <tbody key={kind}>
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={periods.length + 1}
                    className="border-b border-slate-200 bg-slate-100 px-3 py-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <span className="sticky left-3">{t(`load.groups.${kind}`)}</span>
                  </th>
                </tr>
                {rows.map((r) => (
                  <ResourceRow
                    key={r.key}
                    resource={r}
                    summaries={summaries.get(r.key) ?? []}
                    selected={r.key === selected.key}
                    onSelect={setSelectedKey}
                    widthClass={COLUMN_WIDTH[unit]}
                  />
                ))}
              </tbody>
            )
          })}
        </table>
      </div>

      <LoadDetail
        key={selected.key}
        resource={selected}
        periods={periods}
        summaries={summaries.get(selected.key) ?? []}
        labels={labels}
        absenceDays={selected.kind === 'worker' ? absenceWorkingDays(project.workers.find((w) => w.id === selected.id) ?? {}, project.calendar) : 0}
        onShowPlan={onShowPlan}
      />
    </div>
  )
}

const ResourceRow = memo(function ResourceRow({
  resource,
  summaries,
  selected,
  onSelect,
  widthClass,
}: {
  resource: ResourceLoad
  summaries: PeriodLoad[]
  selected: boolean
  onSelect: (key: string) => void
  widthClass: string
}) {
  const { t, i18n } = useTranslation()
  const overloaded = resource.overloadedDays.length
  // Vybraný řádek = tyrkysová (stejně jako výběr v plánu).
  const rowBg = selected ? 'bg-miro-turquoise-light dark:bg-slate-800' : 'bg-white dark:bg-slate-900'
  return (
    <tr>
      <th
        scope="row"
        className={`sticky left-0 z-[5] border-b border-r border-slate-200 p-0 text-left font-normal dark:border-slate-700 ${rowBg} ${
          selected ? 'shadow-[inset_3px_0_0_0_#08708c] dark:shadow-[inset_3px_0_0_0_#3bdaff]' : ''
        }`}
      >
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => onSelect(resource.key)}
          title={t('load.select', { name: resource.name })}
          className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-miro-turquoise-light/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus dark:hover:bg-slate-800"
        >
          <span className="min-w-0 flex-1 truncate">{resource.name}</span>
          {overloaded > 0 && (
            <span className="shrink-0 rounded bg-red-100 px-1.5 text-xs font-semibold text-red-800 dark:bg-red-500/30 dark:text-red-100">
              {t('load.overloadedDays', { count: overloaded })}
            </span>
          )}
        </button>
      </th>
      {summaries.map((s, i) => {
        const level = cellLevel(s, resource)
        return (
          <td
            key={i}
            title={cellTitle(s, level, t, i18n.language)}
            className={`border-b border-r border-slate-200 px-1 py-1 text-center text-xs tabular-nums dark:border-slate-700 ${widthClass} ${CELL_CLASS[level]}`}
          >
            {cellText(s, level, i18n.language)}
          </td>
        )
      })}
    </tr>
  )
})

function UnitSwitch({ unit, onChange }: { unit: LoadPeriodUnit; onChange: (u: LoadPeriodUnit) => void }) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={t('load.unit')} className="inline-flex">
      {UNITS.map((u, i) => (
        <button
          key={u}
          type="button"
          aria-pressed={unit === u}
          onClick={() => onChange(u)}
          className={`border px-3 py-1.5 text-sm font-medium focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            i === 0 ? 'rounded-l-md' : '-ml-px'
          } ${i === UNITS.length - 1 ? 'rounded-r-md' : ''} ${
            unit === u
              ? 'border-miro-graphite bg-miro-graphite text-miro-paper dark:border-miro-paper dark:bg-miro-paper dark:text-miro-graphite'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          {t(`load.units.${u}`)}
        </button>
      ))}
    </div>
  )
}

function Legend() {
  const { t } = useTranslation()
  const items = [
    ['low', CELL_CLASS.low],
    ['high', CELL_CLASS.high],
    ['over', CELL_CLASS.over],
    ['noCapacity', CELL_CLASS.demandOnly],
  ] as const
  return (
    <ul aria-label={t('load.legend.label')} className="flex flex-wrap items-center gap-1.5 text-xs">
      {items.map(([key, cls]) => (
        <li key={key} className={`rounded px-1.5 py-0.5 ${cls}`}>
          {t(`load.legend.${key}`)}
        </li>
      ))}
    </ul>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="max-w-md text-center text-sm text-slate-600 dark:text-slate-400">{text}</p>
    </div>
  )
}
