/**
 * Pohled Náklady (fáze 7, R-04): kolik projekt stojí v každém týdnu, měsíci nebo čtvrtletí.
 * Řádky podle kategorií, fází (položek nejvyšší úrovně) nebo druhu nákladu; za období
 * nebo kumulativně; volitelně jen řádky se štítkem. Výpočet je v model/costTimeline.ts.
 * Krok 4: graf, limity rozpočtu (dialog) a varování při jejich překročení.
 * Filtry s více volbami (kategorie, fáze, druh, štítek); graf má skládané sloupce v barvách
 * zvoleného členění (palette.ts) – stejné barvy mají čtverečky u řádků tabulky.
 * Pohled sám nic nemění; limity se mění jen v dialogu (každá změna = krok Zpět).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { dayToIso, isoToDay } from '../../engine/calendar'
import { formatIsoDate, formatNumber } from '../../i18n/format'
import { costKpis, cumulative, KIND_ORDER, rootsOf, summarizeCosts, type CostGroupBy } from '../../model/costTimeline'
import { todayIso } from '../../model/dates'
import { wbsNumbers } from '../../model/hierarchy'
import { formatMoney } from '../../model/money'
import { splitPeriods, type PeriodUnit } from '../../model/periods'
import { allTags } from '../../model/tags'
import { useBudgetStatus, useCostTimeline, useProject } from '../../store/useProject'
import { BudgetDialog } from './BudgetDialog'
import { useReadOnly } from '../readOnly'
import { SettingsWrap } from '../mobile/SettingsWrap'
import { CHART_MODES, CostsChart, type ChartSeries } from './CostsChart'
import { MultiSelect, NOTHING, type MultiOption } from './MultiSelect'
import { seriesColor } from './palette'
import { periodLabel } from '../load/loadCells'
import { Kpi } from '../Kpi'
import { Segmented } from '../Segmented'
import { HelpTip } from '../help/HelpTip'
import { glossaryHelp } from '../help/glossary'
import { loadPreference, savePreference } from '../preferences'

const GROUPS: readonly CostGroupBy[] = ['category', 'phase', 'kind']
const UNITS: readonly PeriodUnit[] = ['week', 'month', 'quarter']
const MODES = ['period', 'cumulative'] as const

/** Volba uložená v prohlížeči; podvržená nebo stará hodnota → výchozí. */
function usePreference<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => allowed.find((a) => a === loadPreference(key)) ?? fallback)
  return [
    value,
    (next: T) => {
      setValue(next)
      savePreference(key, next)
    },
  ]
}

export function CostsView() {
  const { t, i18n } = useTranslation()
  const readOnly = useReadOnly()
  const lang = i18n.language
  const project = useProject((s) => s.project)
  const timeline = useCostTimeline()
  const [groupBy, setGroupBy] = usePreference('costsGroup', GROUPS, 'category')
  const [unit, setUnit] = usePreference('costsUnit', UNITS, 'month')
  const [mode, setMode] = usePreference('costsMode', MODES, 'period')
  const [chartMode, setChartMode] = usePreference('costsChart', CHART_MODES, 'scurve')
  const tags = useMemo(() => allTags(project), [project])
  const [tagState, setTag] = useState<string>('')
  const [budgetOpen, setBudgetOpen] = useState(false)
  // Filtry s více volbami (prázdná množina = vše); pamatují se jen do zavření stránky.
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set())
  const [filterPhases, setFilterPhases] = useState<Set<string>>(new Set())
  const [filterKinds, setFilterKinds] = useState<Set<string>>(new Set())
  const status = useBudgetStatus()
  const tag = tags.includes(tagState) ? tagState : ''

  const range = timeline.range
  const periods = useMemo(() => (range ? splitPeriods(range, unit) : []), [range, unit])
  const labels = useMemo(() => periods.map((p) => periodLabel(p, unit, t, lang)), [periods, unit, t, lang])
  const wbs = useMemo(() => wbsNumbers(project), [project])
  const roots = useMemo(() => rootsOf(project).order, [project])
  // Do filtru jdou jen volby, které v projektu opravdu jsou (po smazání kategorie apod.).
  const filter = useMemo(() => {
    const valid = (set: Set<string>, allowed: readonly string[]) => new Set([...set].filter((v) => v === NOTHING || allowed.includes(v)))
    return {
      categories: valid(filterCategories, project.costCategories.map((c) => c.id)),
      phases: valid(filterPhases, roots),
      kinds: valid(filterKinds, KIND_ORDER),
    }
  }, [filterCategories, filterPhases, filterKinds, project.costCategories, roots])
  const filtersActive = tag !== '' || filter.categories.size > 0 || filter.phases.size > 0 || filter.kinds.size > 0
  const summary = useMemo(
    () => summarizeCosts(project, timeline, periods, { groupBy, tag: tag || null, filter }),
    [project, timeline, periods, groupBy, tag, filter],
  )
  // Plánované náklady od začátku projektu do dneška (se stejnými filtry jako tabulka).
  const todayDay = isoToDay(todayIso())
  const toDate = useMemo(() => {
    if (!range || todayDay < range.startDay) return 0
    const upToToday = [{ startDay: range.startDay, endDay: Math.min(todayDay, range.endDay) }]
    return summarizeCosts(project, timeline, upToToday, { groupBy, tag: tag || null, filter }).grandTotal
  }, [project, timeline, range, todayDay, groupBy, tag, filter])

  if (timeline.lines.length === 0 && timeline.skippedLines === 0) return <Empty text={t('costs.empty')} />

  const currentPeriod = periods.findIndex((p) => todayDay >= p.startDay && todayDay <= p.endDay)
  const kpis = costKpis(summary.totals, toDate)
  const money = (value: number) => formatMoney(value, project.currency, lang)
  /** Buňka: celé koruny (přesná částka v bublině). */
  const cell = (value: number) => (value === 0 ? '' : formatNumber(Math.round(value / 100), lang))
  const show = (values: number[]) => (mode === 'cumulative' ? cumulative(values) : values)

  const phaseLabel = (key: string) => {
    const task = project.tasks.find((x) => x.id === key)
    return task ? `${wbs.get(key) ?? ''} ${task.name}`.trim() : key
  }
  function rowLabel(key: string): string {
    if (groupBy === 'category') return project.costCategories.find((c) => c.id === key)?.name ?? key
    if (groupBy === 'kind') return t(`table.costParts.${key}`)
    return phaseLabel(key)
  }
  /** Barva skupiny podle jejího pořadí v celém projektu – při filtrování se nemění. */
  const colorOf = (dimension: CostGroupBy, key: string) =>
    seriesColor(
      dimension === 'category' ? project.costCategories.findIndex((c) => c.id === key) : dimension === 'phase' ? roots.indexOf(key) : KIND_ORDER.indexOf(key as never),
    )
  const options = (dimension: CostGroupBy): MultiOption[] => {
    const keys = dimension === 'category' ? project.costCategories.map((c) => c.id) : dimension === 'phase' ? roots : [...KIND_ORDER]
    const label = (k: string) => (dimension === 'category' ? (project.costCategories.find((c) => c.id === k)?.name ?? k) : dimension === 'phase' ? phaseLabel(k) : t(`table.costParts.${k}`))
    return keys.map((k) => ({ value: k, label: label(k), swatch: dimension === groupBy ? colorOf(dimension, k).swatch : undefined }))
  }
  const series: ChartSeries[] = summary.rows.filter((r) => r.total > 0).map((r) => ({ key: r.key, label: rowLabel(r.key), values: r.values, color: colorOf(groupBy, r.key) }))
  const categoryStatus = new Map(status.categories.map((c) => [c.categoryId, c]))
  // Kategorie s limitem se ukáže, i když na ni zatím nic nepřipadá.
  const rows = summary.rows.filter((r) => r.total !== 0 || (groupBy === 'category' && categoryStatus.has(r.key)))
  const date = (day: number | null) => (day === null ? '' : formatIsoDate(dayToIso(day), lang))
  const categoryName = (id: string) => project.costCategories.find((c) => c.id === id)?.name ?? id
  const overCategories = status.categories.filter((c) => c.over > 0)
  const anyOver = (status.project?.over ?? 0) > 0 || overCategories.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Na telefonu přepínače a filtry sbalené pod „Nastavení zobrazení“. */}
      <SettingsWrap collapsible={readOnly} summary={t('mobile.viewSettings')}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
          <p className="min-w-60 flex-1 text-sm text-slate-600 dark:text-slate-400">
            {t('costs.intro', { currency: project.currency })} <HelpTip term="costTimeline" className="align-middle" />
          </p>
          <Segmented label={t('costs.groupBy')} options={GROUPS} value={groupBy} onChange={setGroupBy} text={(g) => t(`costs.groups.${g}`)} />
          <Segmented label={t('costs.unit')} options={UNITS} value={unit} onChange={setUnit} text={(u) => t(`costs.units.${u}`)} />
          <Segmented label={t('costs.mode')} options={MODES} value={mode} onChange={setMode} text={(m) => t(`costs.modes.${m}`)} />
          {/* Limity rozpočtu se mění jen v plné verzi (na telefonu jen prohlížení). */}
          {!readOnly && (
            <button type="button" className="btn-secondary" onClick={() => setBudgetOpen(true)} title={t('costs.limits.hint')}>
              {t('costs.limits.button')}
              {(status.project || status.categories.length > 0) && (
                <span className={`ml-0.5 inline-block h-2 w-2 rounded-full ${anyOver ? 'bg-red-600 dark:bg-red-400' : 'bg-miro-turquoise-dark dark:bg-miro-turquoise'}`} aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {/* Filtry s více volbami – omezí tabulku i graf (limity a záhlaví platí dál pro celý projekt). */}
        <div role="group" aria-label={t('costs.filter.label')} className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('costs.filter.label')}</span>
          <MultiSelect label={t('costs.groups.category')} options={options('category')} selected={filter.categories} onChange={setFilterCategories} />
          <MultiSelect label={t('costs.groups.phase')} options={options('phase')} selected={filter.phases} onChange={setFilterPhases} />
          <MultiSelect label={t('costs.groups.kind')} options={options('kind')} selected={filter.kinds} onChange={setFilterKinds} />
          {tags.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              {t('costs.tag')}
              <select className="field-select" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">{t('costs.allTags')}</option>
                {tags.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          )}
          {filtersActive && (
            <button
              type="button"
              className="rounded px-2 py-1 text-sm underline decoration-miro-turquoise decoration-2 underline-offset-4 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-slate-800"
              onClick={() => {
                setFilterCategories(new Set())
                setFilterPhases(new Set())
                setFilterKinds(new Set())
                setTag('')
              }}
            >
              {t('costs.filter.clear')}
            </button>
          )}
        </div>
      </SettingsWrap>

      {(timeline.skippedLines > 0 || filtersActive) && (
        <div className="space-y-1 border-b border-slate-200 px-4 py-1.5 text-sm dark:border-slate-700">
          {filtersActive && <p className="text-slate-700 dark:text-slate-300">{t('costs.filter.note', { amount: money(summary.grandTotal), total: money(timeline.total) })}</p>}
          {timeline.skippedLines > 0 && (
            <p className="text-slate-700 dark:text-slate-300">
              <span aria-hidden="true" className="mr-1 text-miro-gold dark:text-miro-yellow">
                ⚠
              </span>
              {t('costs.skipped', { count: timeline.skippedLines, amount: money(timeline.skippedAmount) })}
            </p>
          )}
        </div>
      )}

      {(status.project || status.categories.length > 0) && (
        <div
          role={anyOver ? 'alert' : undefined}
          className={`space-y-0.5 border-b border-l-4 px-4 py-1.5 text-sm ${
            anyOver
              ? 'border-b-slate-200 border-l-red-600 bg-red-50 text-red-900 dark:border-b-slate-700 dark:border-l-red-400 dark:bg-red-950/40 dark:text-red-100'
              : 'border-b-slate-200 border-l-miro-turquoise-dark bg-white text-slate-800 dark:border-b-slate-700 dark:border-l-miro-turquoise dark:bg-slate-900 dark:text-slate-100'
          }`}
        >
          {status.project && (
            <p>
              {status.project.over > 0 && <span aria-hidden="true">⚠ </span>}
              {status.project.over > 0
                ? t(status.project.exceedDay !== null ? 'costs.status.projectOver' : 'costs.status.projectOverNoDate', {
                    limit: money(status.project.limit),
                    spent: money(status.project.spent),
                    over: money(status.project.over),
                    date: date(status.project.exceedDay),
                  })
                : t('costs.status.project', {
                    limit: money(status.project.limit),
                    spent: money(status.project.spent),
                    pct: Math.round((status.project.spent / status.project.limit) * 100),
                  })}
            </p>
          )}
          {overCategories.map((c) => (
            <p key={c.categoryId}>
              <span aria-hidden="true">⚠ </span>
              {t(c.exceedDay !== null ? 'costs.status.categoryOver' : 'costs.status.categoryOverNoDate', {
                name: categoryName(c.categoryId),
                limit: money(c.limit),
                over: money(c.over),
                date: date(c.exceedDay),
              })}
            </p>
          ))}
          {overCategories.length === 0 && status.categories.length > 0 && <p>{t('costs.status.categoriesOk', { count: status.categories.length })}</p>}
        </div>
      )}

      {periods.length > 0 && (
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-700">
          {/* Dashboard (A-03): ukazatele a graf S-křivka / Cash flow. */}
          <div className={readOnly ? 'grid grid-cols-2 gap-2 px-3 pt-3' : 'flex flex-wrap items-stretch gap-2 px-4 pt-3'}>
            <Kpi label={t('costs.kpi.total')} value={money(kpis.total)} hint={filtersActive ? t('costs.kpi.filtered') : undefined} />
            <Kpi label={t('costs.kpi.toDate')} value={money(kpis.toDate)} hint={t('costs.kpi.toDateHint', { date: formatIsoDate(todayIso(), lang) })} />
            <Kpi label={t('costs.kpi.remaining')} value={money(kpis.remaining)} />
            <Kpi
              label={t('costs.kpi.peak')}
              value={kpis.peakIndex === null ? '–' : money(kpis.peak)}
              hint={kpis.peakIndex === null ? undefined : labels[kpis.peakIndex]!.title}
            />
            <Kpi label={t('costs.kpi.average')} value={money(kpis.average)} />
            <Kpi
              label={t('costs.kpi.limit')}
              value={status.project ? `${Math.round((status.project.spent / status.project.limit) * 100)} %` : '–'}
              hint={status.project ? t('costs.kpi.limitOf', { limit: money(status.project.limit) }) : t('costs.kpi.limitNone')}
              alert={(status.project?.over ?? 0) > 0}
              help={glossaryHelp(t, 'budgetLimit')}
            />
            <div className="ml-auto flex items-center gap-1 self-end">
              <Segmented label={t('costs.chart.label')} options={CHART_MODES} value={chartMode} onChange={setChartMode} text={(m) => t(`costs.chart.modes.${m}`)} />
              {/* Vysvětlení právě zvoleného grafu. */}
              <HelpTip key={chartMode} term={chartMode === 'scurve' ? 'sCurve' : 'cashFlow'} />
            </div>
          </div>
          <CostsChart
            mode={chartMode}
            todayDay={todayDay}
            periods={periods}
            labels={labels}
            totals={summary.totals}
            series={series}
            limit={filtersActive ? null : (status.project?.limit ?? null)}
            exceedDay={filtersActive ? null : (status.project?.exceedDay ?? null)}
            currency={project.currency}
          />
        </div>
      )}
      <BudgetDialog open={budgetOpen} onClose={() => setBudgetOpen(false)} />

      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <Empty text={t('costs.noRows')} />
        ) : (
          <table className="border-separate border-spacing-0 text-sm">
            <caption className="sr-only">{t('costs.caption')}</caption>
            <thead>
              <tr>
                <th scope="col" className={`${stickyFirst} top-0 z-20 bg-white text-left font-semibold dark:bg-slate-900`}>
                  {t(`costs.groups.${groupBy}`)}
                </th>
                {labels.map((l, i) => (
                  <th
                    key={periods[i]!.startDay}
                    scope="col"
                    title={i === currentPeriod ? `${l.title}\n${t('costs.current')}` : l.title}
                    className={`sticky top-0 z-10 min-w-[5.5rem] border-b border-r border-slate-200 px-2 py-1 text-right font-medium dark:border-slate-700 ${
                      i === currentPeriod ? 'bg-miro-turquoise-light dark:bg-slate-800' : 'bg-white dark:bg-slate-900'
                    }`}
                  >
                    <span className="block text-xs">{l.top}</span>
                    <span className="block text-[0.7rem] font-normal text-slate-500 dark:text-slate-400">{l.bottom}</span>
                  </th>
                ))}
                <th scope="col" className="sticky right-0 top-0 z-20 min-w-[8rem] border-b border-l border-slate-300 bg-white px-2 py-1 text-right font-semibold dark:border-slate-600 dark:bg-slate-900">
                  {t('costs.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-miro-turquoise-light/40 dark:hover:bg-slate-800">
                  <th scope="row" className={`${stickyFirst} z-[5] bg-white font-normal dark:bg-slate-900`} title={rowLabel(row.key)}>
                    <span className="flex max-w-72 items-center gap-1.5">
                      <span aria-hidden="true" className={`inline-block h-2.5 w-3 shrink-0 rounded-sm ${row.total > 0 ? colorOf(groupBy, row.key).swatch : 'bg-transparent'}`} />
                      <span className="truncate">{rowLabel(row.key)}</span>
                      {groupBy === 'category' && categoryStatus.get(row.key) && (
                        <LimitMark status={categoryStatus.get(row.key)!} text={(s) => t('costs.limitTitle', { limit: money(s.limit), pct: Math.round((s.spent / s.limit) * 100) })} />
                      )}
                    </span>
                  </th>
                  {show(row.values).map((v, i) => (
                    <td key={i} title={money(v)} className="border-b border-r border-slate-200 px-2 py-1 text-right tabular-nums dark:border-slate-700">
                      {cell(v)}
                    </td>
                  ))}
                  <td className="sticky right-0 border-b border-l border-slate-300 bg-white px-2 py-1 text-right font-medium tabular-nums dark:border-slate-600 dark:bg-slate-900">
                    {money(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <th scope="row" className={`${stickyFirst} bottom-0 z-[5] border-t-2 border-t-slate-300 bg-slate-100 dark:border-t-slate-600 dark:bg-slate-800`}>
                  {t(mode === 'cumulative' ? 'costs.totalCumulative' : 'costs.totalPeriod')}
                </th>
                {show(summary.totals).map((v, i) => (
                  <td
                    key={i}
                    title={money(v)}
                    className="sticky bottom-0 border-r border-t-2 border-slate-200 border-t-slate-300 bg-slate-100 px-2 py-1 text-right tabular-nums dark:border-slate-700 dark:border-t-slate-600 dark:bg-slate-800"
                  >
                    {cell(v)}
                  </td>
                ))}
                <td className="sticky bottom-0 right-0 border-l border-t-2 border-slate-300 bg-slate-100 px-2 py-1 text-right tabular-nums dark:border-slate-600 dark:bg-slate-800">
                  {money(summary.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

/** Malá značka u kategorie s limitem: tyrkysová = v limitu, červená ⚠ = překročeno. */
function LimitMark({ status, text }: { status: { limit: number; spent: number; over: number }; text: (s: { limit: number; spent: number }) => string }) {
  const title = text(status)
  return status.over > 0 ? (
    <span title={title} aria-label={title} className="shrink-0 text-xs font-semibold text-red-700 dark:text-red-300">
      ⚠ {Math.round((status.spent / status.limit) * 100)} %
    </span>
  ) : (
    <span title={title} aria-label={title} className="shrink-0 text-xs text-miro-turquoise-dark dark:text-miro-turquoise">
      {Math.round((status.spent / status.limit) * 100)} %
    </span>
  )
}

const stickyFirst = 'sticky left-0 min-w-56 border-b border-r border-slate-200 px-3 py-1 text-left dark:border-slate-700'

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="max-w-md text-center text-sm text-slate-600 dark:text-slate-400">{text}</p>
    </div>
  )
}
