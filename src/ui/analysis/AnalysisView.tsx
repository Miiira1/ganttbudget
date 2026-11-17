/**
 * Pohled Analýza (fáze 8, A-01): kontingenční tabulka nad fakty projektu.
 * Uživatel volí řádky (1–2 úrovně), sloupce, metriku, agregaci, období a filtry s více volbami.
 * Nastavení si pamatuje prohlížeč (ověřené schématem Zod – podvržená hodnota se zahodí).
 * Vedle tabulky volitelně graf (A-02): sloupcový, koláčový, čárový, skládaný – rozdělovníkem
 * jde měnit poměr (výchozí 2/3 tabulka, 1/3 graf; prohlížeč si ho pamatuje). Přepínač rozvržení
 * „Pod sebou“ dá graf nahoru přes celou šířku a tabulku pod něj (hodí se pro období ve sloupcích).
 * Nabídka Pohled: přednastavené a vlastní (uložené v projektu) pohledy (A-06).
 * Pohled jen čte – projekt mění jen ukládání vlastních pohledů (každé = krok Zpět).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '../../i18n/format'
import { wbsNumbers } from '../../model/hierarchy'
import { formatMoney, formatMoneyCompact } from '../../model/money'
import { chartAvailability, chartSeries, type ChartType } from '../../model/pivotChart'
import { dimensionKeys, FACT_DIMS, NONE, pivot, PIVOT_DIMS, type FactDim, type PivotAgg, type PivotConfig, type PivotDim, type PivotPeriod } from '../../model/pivot'
import { PivotConfigSchema } from '../../model/schema'
import { useFacts, useProject } from '../../store/useProject'
import { MultiSelect, NOTHING, type MultiOption } from '../costs/MultiSelect'
import { periodLabel } from '../load/loadCells'
import { loadPreference, savePreference } from '../preferences'
import { Segmented } from '../Segmented'
import { SplitView } from '../SplitView'
import { exportPivot } from './analysisActions'
import { makeDimLabel } from './labels'
import { PivotChart } from './PivotChart'
import { ViewsMenu, type ActiveView } from './ViewsMenu'

const DEFAULT_CONFIG: PivotConfig = { rows: ['category'], column: 'period', metric: 'cost', agg: 'sum', period: 'month', filters: {} }
const AGGS: readonly PivotAgg[] = ['sum', 'avg', 'count', 'min', 'max']
const PERIODS: readonly PivotPeriod[] = ['week', 'month', 'quarter']
const CHARTS: readonly ChartType[] = ['bar', 'pie', 'line', 'stacked']
/** Barev v grafu (zbytek = Ostatní). */
const MAX_SERIES = 9

/** Nastavení z prohlížeče – jen pokud projde schématem, jinak výchozí. */
function loadConfig(): PivotConfig {
  try {
    const parsed = PivotConfigSchema.safeParse(JSON.parse(loadPreference('analysisConfig') ?? 'null'))
    return parsed.success ? (parsed.data as PivotConfig) : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

export function AnalysisView() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const project = useProject((s) => s.project)
  const facts = useFacts()
  const [config, setConfigState] = useState<PivotConfig>(loadConfig)
  // Změna vždy vychází z aktuálního nastavení (i při několika změnách hned po sobě).
  const patch = (p: Partial<PivotConfig> | ((prev: PivotConfig) => Partial<PivotConfig>)) =>
    setConfigState((prev) => {
      const next = { ...prev, ...(typeof p === 'function' ? p(prev) : p) }
      savePreference('analysisConfig', JSON.stringify(next))
      return next
    })

  const result = useMemo(() => pivot(project, facts, config), [project, facts, config])
  // Který pohled je právě použitý (jen pro tuto návštěvu stránky).
  const [activeView, setActiveView] = useState<ActiveView>(null)
  const applyView = (next: PivotConfig, view: ActiveView) => {
    patch(() => next)
    setActiveView(view)
  }
  const [chart, setChartState] = useState<ChartType | 'none'>(() => (['none', ...CHARTS] as const).find((c) => c === loadPreference('analysisChart')) ?? 'bar')
  const setChart = (next: ChartType | 'none') => {
    setChartState(next)
    savePreference('analysisChart', next)
  }
  const chartData = useMemo(() => chartSeries(result, MAX_SERIES), [result])
  // Rozvržení: vedle sebe (tabulka | graf), nebo pod sebou (graf nahoře, tabulka dole).
  const [layout, setLayoutState] = useState<'side' | 'stacked'>(() => (loadPreference('analysisLayout') === 'stacked' ? 'stacked' : 'side'))
  const setLayout = (next: 'side' | 'stacked') => {
    setLayoutState(next)
    savePreference('analysisLayout', next)
  }
  const wbs = useMemo(() => wbsNumbers(project), [project])
  const label = useMemo(() => makeDimLabel(project, facts, wbs, result.periods, config.period, t, lang), [project, facts, wbs, result.periods, config.period, t, lang])
  // Hodnoty filtrů jen z toho, co ve faktech opravdu je.
  const filterOptions = useMemo(
    () => Object.fromEntries(FACT_DIMS.map((dim) => [dim, dimensionKeys(project, facts, dim).map((key): MultiOption => ({ value: key, label: label(dim, key) }))])) as Record<FactDim, MultiOption[]>,
    [project, facts, label],
  )
  const activeFilter = (dim: FactDim) => new Set((config.filters[dim] ?? []).filter((v) => v === NOTHING || filterOptions[dim].some((o) => o.value === v)))
  const filtersActive = FACT_DIMS.some((d) => activeFilter(d).size > 0)

  if (facts.lines.length === 0) return <Empty text={t('analysis.empty')} />

  const usesPeriod = config.rows.includes('period') || config.column === 'period'
  const dimText = (d: PivotDim) => t(`analysis.dims.${d}`)

  /** Hodnota do buňky (zkráceně) a do bubliny (přesně). */
  const show = (v: number | null): { text: string; title: string } => {
    if (v === null) return { text: '', title: '' }
    if (config.agg === 'count') return { text: formatNumber(v, lang), title: formatNumber(v, lang) }
    if (config.metric === 'cost') return { text: formatNumber(Math.round(v / 100), lang), title: formatMoney(Math.round(v), project.currency, lang) }
    const rounded = Math.round(v * 10) / 10
    return { text: formatNumber(rounded, lang), title: `${formatNumber(Math.round(v * 100) / 100, lang)} h` }
  }
  const columnLabel = (key: string) => {
    if (config.column !== 'period') return { top: label(config.column!, key), bottom: '' }
    const p = result.periods.find((x) => String(x.startDay) === key)
    if (!p) return { top: key, bottom: '' }
    const l = periodLabel(p, config.period, t, lang)
    return { top: l.top, bottom: l.bottom }
  }
  const twoLevels = config.rows.length === 2
  const available = chartAvailability(config)
  // Zvolený graf nejde (např. koláč z průměrů) → sloupcový, který jde vždy.
  const shownChart: ChartType | 'none' = chart !== 'none' && available[chart] ? 'bar' : chart
  const exact = (v: number) =>
    config.agg === 'count' ? formatNumber(v, lang) : config.metric === 'cost' ? formatMoney(Math.round(v), project.currency, lang) : `${formatNumber(Math.round(v * 100) / 100, lang)} h`
  const compact = (v: number) =>
    config.agg === 'count' ? formatNumber(Math.round(v), lang) : config.metric === 'cost' ? formatMoneyCompact(v, project.currency, lang) : `${formatNumber(Math.round(v), lang)} h`
  const unitNote = config.agg === 'count' ? t('analysis.unitCount') : config.metric === 'cost' ? t('analysis.unitCost', { currency: project.currency }) : t('analysis.unitHours')

  const tableNode = (
    <div className="h-full overflow-auto">
        {result.rows.length === 0 ? (
          <Empty text={t('analysis.noRows')} />
        ) : (
          <table className="border-separate border-spacing-0 text-sm">
            <caption className="sr-only">{t('analysis.caption')}</caption>
            <thead>
              <tr>
                <th scope="col" className={`${sticky} top-0 z-20 bg-white text-left font-semibold dark:bg-slate-900`}>
                  {config.rows.map(dimText).join(' › ')}
                </th>
                {result.columns.map((c) => {
                  const l = columnLabel(c.key)
                  return (
                    <th key={c.key} scope="col" className="sticky top-0 z-10 min-w-[5.5rem] max-w-48 border-b border-r border-slate-200 bg-white px-2 py-1 text-right font-medium dark:border-slate-700 dark:bg-slate-900">
                      <span className="block truncate text-xs" title={l.top}>
                        {l.top}
                      </span>
                      {l.bottom && <span className="block text-[0.7rem] font-normal text-slate-500 dark:text-slate-400">{l.bottom}</span>}
                    </th>
                  )
                })}
                <th scope="col" className="sticky right-0 top-0 z-20 min-w-[7rem] border-b border-l border-slate-300 bg-white px-2 py-1 text-right font-semibold dark:border-slate-600 dark:bg-slate-900">
                  {t('costs.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const group = twoLevels && row.path.length === 1
                const text = label(config.rows[row.path.length - 1]!, row.path.at(-1)!)
                const bg = group ? 'bg-slate-50 font-semibold dark:bg-slate-800/60' : 'bg-white dark:bg-slate-900'
                return (
                  <tr key={row.path.join('›')} className="hover:bg-miro-turquoise-light/40 dark:hover:bg-slate-800">
                    <th scope="row" title={text} className={`${sticky} z-[5] ${bg} ${group ? '' : 'font-normal'}`}>
                      <span className={`block max-w-80 truncate ${twoLevels && !group ? 'pl-4' : ''} ${row.path.at(-1) === NONE ? 'italic text-slate-500 dark:text-slate-400' : ''}`}>{text}</span>
                    </th>
                    {result.columns.map((c) => {
                      const v = show(result.value(row.path, c.key))
                      return (
                        <td key={c.key} title={v.title} className={`border-b border-r border-slate-200 px-2 py-1 text-right tabular-nums dark:border-slate-700 ${group ? 'bg-slate-50 font-semibold dark:bg-slate-800/60' : ''}`}>
                          {v.text}
                        </td>
                      )
                    })}
                    <td title={show(result.value(row.path, null)).title} className={`sticky right-0 border-b border-l border-slate-300 px-2 py-1 text-right font-medium tabular-nums dark:border-slate-600 ${bg}`}>
                      {show(result.value(row.path, null)).text}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <th scope="row" className={`${sticky} bottom-0 z-[5] border-t-2 border-t-slate-300 bg-slate-100 dark:border-t-slate-600 dark:bg-slate-800`}>
                  {t('costs.total')}
                </th>
                {result.columns.map((c) => {
                  const v = show(result.value(null, c.key))
                  return (
                    <td key={c.key} title={v.title} className="sticky bottom-0 border-r border-t-2 border-slate-200 border-t-slate-300 bg-slate-100 px-2 py-1 text-right tabular-nums dark:border-slate-700 dark:border-t-slate-600 dark:bg-slate-800">
                      {v.text}
                    </td>
                  )
                })}
                <td title={show(result.value(null, null)).title} className="sticky bottom-0 right-0 border-l border-t-2 border-slate-300 bg-slate-100 px-2 py-1 text-right tabular-nums dark:border-slate-600 dark:bg-slate-800">
                  {show(result.value(null, null)).text}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
    </div>
  )
  const chartNode = (
    <div className="flex h-full min-h-0 flex-col bg-white px-3 py-2 dark:bg-slate-900">
      {shownChart !== 'none' && (
        <div className="min-h-0 flex-1">
          <PivotChart
            type={shownChart}
            series={chartData.series}
            columns={chartData.columns}
            seriesLabel={(key) => label(config.rows[0]!, key)}
            columnLabel={(key) => (config.column ? label(config.column, key) : key)}
            format={exact}
            compact={compact}
          />
        </div>
      )}
      {chartData.series.some((s) => s.index === -1) && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('analysis.chart.otherNote', { count: MAX_SERIES })}</p>}
    </div>
  )

  const selectClass = 'field-select'
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Nastavení tabulky */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <ViewsMenu config={config} active={activeView} onApply={applyView} />
        <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          {t('analysis.rows')}
          <span className="flex items-center gap-1">
            <select className={selectClass} value={config.rows[0]} onChange={(e) => {
                const dim = e.target.value as PivotDim
                patch((prev) => ({ rows: [dim, ...prev.rows.slice(1).filter((d) => d !== dim)], column: prev.column === dim ? null : prev.column }))
              }}>
              {PIVOT_DIMS.map((d) => (
                <option key={d} value={d}>
                  {dimText(d)}
                </option>
              ))}
            </select>
            <span aria-hidden="true">›</span>
            <select
              className={selectClass}
              aria-label={t('analysis.rows2')}
              value={config.rows[1] ?? ''}
              onChange={(e) => {
                const dim = e.target.value as PivotDim | ''
                patch((prev) => ({ rows: dim ? [prev.rows[0]!, dim] : [prev.rows[0]!], column: prev.column === dim ? null : prev.column }))
              }}
            >
              <option value="">{t('analysis.noDim')}</option>
              {PIVOT_DIMS.filter((d) => d !== config.rows[0]).map((d) => (
                <option key={d} value={d}>
                  {dimText(d)}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          {t('analysis.columns')}
          <select className={selectClass} value={config.column ?? ''} onChange={(e) => patch({ column: (e.target.value || null) as PivotDim | null })}>
            <option value="">{t('analysis.noDim')}</option>
            {PIVOT_DIMS.filter((d) => !config.rows.includes(d)).map((d) => (
              <option key={d} value={d}>
                {dimText(d)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          {t('analysis.metric')}
          <Segmented label={t('analysis.metric')} options={['cost', 'hours'] as const} value={config.metric} onChange={(metric) => patch({ metric })} text={(m) => t(`analysis.metrics.${m}`)} />
        </div>
        <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
          {t('analysis.agg')}
          <select className={selectClass} value={config.agg} onChange={(e) => patch({ agg: e.target.value as PivotAgg })}>
            {AGGS.map((a) => (
              <option key={a} value={a}>
                {t(`analysis.aggs.${a}`)}
              </option>
            ))}
          </select>
        </label>
        {usesPeriod && (
          <div className="flex flex-col gap-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('analysis.period')}
            <Segmented label={t('analysis.period')} options={PERIODS} value={config.period} onChange={(period) => patch({ period })} text={(p) => t(`costs.units.${p}`)} />
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => void exportPivot('xlsx', result, config, label, t, lang)} title={t('analysis.exportHint')}>
            {t('analysis.exportXlsx')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => void exportPivot('csv', result, config, label, t, lang)} title={t('analysis.exportHint')}>
            {t('analysis.exportCsv')}
          </button>
        </div>
      </div>

      {/* Filtry */}
      <div role="group" aria-label={t('costs.filter.label')} className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('costs.filter.label')}</span>
        {FACT_DIMS.map((dim) => (
          <MultiSelect
            key={dim}
            label={dimText(dim)}
            options={filterOptions[dim]}
            selected={activeFilter(dim)}
            onChange={(next) => patch((prev) => ({ filters: { ...prev.filters, [dim]: [...next] } }))}
          />
        ))}
        {filtersActive && (
          <button
            type="button"
            className="rounded px-2 py-1 text-sm underline decoration-miro-turquoise decoration-2 underline-offset-4 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-slate-800"
            onClick={() => patch({ filters: {} })}
          >
            {t('costs.filter.clear')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-1.5 dark:border-slate-700">
        <div className="min-w-60 flex-1 space-y-0.5 text-sm text-slate-600 dark:text-slate-400">
          <p>{unitNote}</p>
          {result.tagDuplicates && <p>{t('analysis.tagNote')}</p>}
          {facts.skippedLines > 0 && <p>{t('analysis.skipped', { count: facts.skippedLines })}</p>}
        </div>
          <div role="group" aria-label={t('analysis.chart.label')} className="flex flex-wrap items-center justify-end gap-1">
            <span className="mr-1 text-sm font-medium text-slate-600 dark:text-slate-300">{t('analysis.chart.label')}</span>
            {(['none', ...CHARTS] as const).map((c) => {
              const blocker = c === 'none' ? null : available[c]
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={shownChart === c}
                  disabled={blocker !== null}
                  title={blocker ? t(`analysis.chart.blocked.${blocker}`) : t(`analysis.chart.types.${c}`)}
                  onClick={() => setChart(c)}
                  className={`rounded-md border px-2.5 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-40 ${
                    shownChart === c
                      ? 'border-miro-graphite bg-miro-graphite text-miro-paper dark:border-miro-paper dark:bg-miro-paper dark:text-miro-graphite'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {t(`analysis.chart.types.${c}`)}
                </button>
              )
            })}
            {shownChart !== 'none' && (
            <span className="ml-3">
              <Segmented label={t('analysis.layout')} options={['side', 'stacked'] as const} value={layout} onChange={setLayout} text={(l) => t(`analysis.layouts.${l}`)} />
            </span>
          )}
          {chart !== 'none' && available[chart] && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{t(`analysis.chart.blocked.${available[chart]}`)}</span>}
          </div>
      </div>

      {/* Tabulka a graf vedle sebe (rozdělovník, výchozí 2/3 : 1/3); bez grafu jen tabulka */}
      <div className="min-h-0 flex-1">
        {shownChart === 'none' || result.rows.length === 0 ? (
          tableNode
        ) : (
          layout === 'side' ? (
            <SplitView
              key="side"
              left={tableNode}
              right={chartNode}
              storageKey="analysisSplit"
              defaultRatio={2 / 3}
              syncScroll={false}
              label={{ name: t('analysis.splitter'), hint: t('analysis.splitterHint') }}
            />
          ) : (
            <SplitView
              key="stacked"
              orientation="vertical"
              left={chartNode}
              right={tableNode}
              storageKey="analysisSplitStacked"
              defaultRatio={0.45}
              syncScroll={false}
              label={{ name: t('analysis.splitter'), hint: t('analysis.splitterHintVertical') }}
            />
          )
        )}
      </div>
    </div>
  )
}

const sticky = 'sticky left-0 min-w-56 border-b border-r border-slate-200 px-3 py-1 text-left dark:border-slate-700'

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="max-w-md text-center text-sm text-slate-600 dark:text-slate-400">{text}</p>
    </div>
  )
}
