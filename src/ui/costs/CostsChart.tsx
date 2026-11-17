/**
 * Graf dashboardu Náklady v čase (fáze 8, A-03) – SVG bez knihovny, vždy s jedinou osou:
 *  - S-křivka: kumulativní náklady (čára 2 px s jemnou plochou), čára limitu projektu
 *    a červený bod v období, kdy kumulativní náklady limit přesáhnou,
 *  - Cash flow: výdaje za období, skládané podle zvoleného členění (barvy palette.ts).
 * V obou svislá tyrkysová čára „dnes“. Graf vyplní šířku panelu; bubliny s přesnými čísly.
 * (Dřívější graf se dvěma osami nahrazen – dvě osy svádějí ke srovnávání nesrovnatelného.)
 */
import { useTranslation } from 'react-i18next'
import { cumulative } from '../../model/costTimeline'
import { formatMoney, formatMoneyCompact } from '../../model/money'
import type { DayRange } from '../../model/periods'
import type { SeriesColor } from './palette'
import { useElementSize } from '../useElementSize'

/** Jedna skupina (úsek sloupce): popisek, částky po obdobích a barva. */
export interface ChartSeries {
  key: string
  label: string
  values: number[]
  color: SeriesColor
}

export const CHART_MODES = ['scurve', 'cashflow'] as const
export type CostsChartMode = (typeof CHART_MODES)[number]

const PLOT = 180
const LEFT = 70
const RIGHT = 16
const TOP = 10
const LABELS = 18
const GRID = 'stroke-slate-200 dark:stroke-slate-700'
const TEXT = 'fill-slate-600 dark:fill-slate-300'

/** Zaokrouhlené maximum osy (1 / 1,2 / 1,5 / 2 / … / 8 / 10 × 10ⁿ), aby graf nebyl zbytečně nízký. */
const NICE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
function niceMax(max: number): number {
  if (max <= 0) return 100
  const exp = 10 ** Math.floor(Math.log10(max))
  return NICE.find((f) => f * exp >= max)! * exp
}

export function CostsChart({
  mode,
  periods,
  labels,
  totals,
  series,
  limit,
  exceedDay,
  todayDay,
  currency,
}: {
  mode: CostsChartMode
  periods: DayRange[]
  labels: { top: string; title: string }[]
  /** Náklady za období (haléře) – součet všech úseků. */
  totals: number[]
  /** Úseky sloupců zdola nahoru (cash flow; jen skupiny s nenulovým součtem). */
  series: ChartSeries[]
  /** Limit projektu; null = bez čáry limitu (např. při filtru). */
  limit: number | null
  exceedDay: number | null
  todayDay: number
  currency: string
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [ref, size] = useElementSize<HTMLElement>()
  const money = (v: number) => formatMoney(v, currency, lang)
  const compact = (v: number) => formatMoneyCompact(v, currency, lang)

  const width = Math.max(320, Math.floor(size.width))
  const slot = Math.max(4, (width - LEFT - RIGHT) / Math.max(1, periods.length))
  const cum = cumulative(totals)
  const top = niceMax(mode === 'scurve' ? Math.max(0, ...cum, limit ?? 0) : Math.max(0, ...totals))
  const y = (v: number) => TOP + PLOT - (Math.max(0, v) / top) * PLOT
  const xStart = (i: number) => LEFT + i * slot
  // Poloha dne na ose X (uvnitř jeho období podle podílu dnů).
  const xOfDay = (day: number): number | null => {
    const i = periods.findIndex((p) => day >= p.startDay && day <= p.endDay)
    if (i < 0) return null
    const p = periods[i]!
    return xStart(i) + ((day - p.startDay + 0.5) / (p.endDay - p.startDay + 1)) * slot
  }
  const todayX = xOfDay(todayDay)
  const exceedIndex = exceedDay === null ? -1 : periods.findIndex((p) => exceedDay >= p.startDay && exceedDay <= p.endDay)
  const labelEvery = Math.max(1, Math.ceil(56 / slot))
  const bar = Math.max(2, Math.min(28, slot - (slot > 8 ? 4 : 1)))
  const cumPath = cum.map((v, i) => `L ${xStart(i) + slot} ${y(v)}`).join(' ')
  const tooltip = (i: number) => t('costs.chart.bar', { period: labels[i]!.title, amount: money(totals[i]!), cumulative: money(cum[i]!) })

  return (
    <figure ref={ref} className="px-4 py-2">
      <figcaption className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
        {mode === 'cashflow' ? (
          series.map((s) => (
            <span key={s.key} className="inline-flex max-w-56 items-center gap-1.5" title={`${s.label}: ${money(s.values.reduce((a, b) => a + b, 0))}`}>
              <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${s.color.swatch}`} />
              <span className="truncate">{s.label}</span>
            </span>
          ))
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-miro-graphite dark:bg-miro-paper" />
            {t('costs.chart.cumulative')}
          </span>
        )}
        {mode === 'scurve' && limit !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-red-600 dark:border-red-400" />
            {t('costs.chart.limit', { amount: money(limit) })}
          </span>
        )}
        {todayX !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-miro-turquoise-dark dark:bg-miro-turquoise" />
            {t('costs.chart.today')}
          </span>
        )}
      </figcaption>
      {size.width > 0 && (
        <svg
          width={width}
          height={TOP + PLOT + LABELS + 4}
          role="img"
          aria-label={t(mode === 'scurve' ? 'costs.chart.scurveSummary' : 'costs.chart.cashflowSummary', { total: money(cum.at(-1) ?? 0) })}
          className="block"
        >
          {/* Jedna osa: 0, polovina, maximum; tlumená mřížka. */}
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(f * top)} y2={y(f * top)} strokeWidth={1} className={GRID} />
              <text x={LEFT - 6} y={y(f * top) + 3} textAnchor="end" className={`${TEXT} text-[10px]`}>
                {f === 0 ? '0' : compact(f * top)}
              </text>
            </g>
          ))}
          {periods.map((p, i) =>
            i % labelEvery === 0 ? (
              <text key={p.startDay} x={xStart(i) + slot / 2} y={TOP + PLOT + LABELS - 4} textAnchor="middle" className={`${TEXT} text-[10px]`}>
                {labels[i]!.top}
              </text>
            ) : null,
          )}

          {mode === 'cashflow' &&
            periods.map((p, i) => {
              const x = xStart(i) + (slot - bar) / 2
              const parts = series.filter((s) => s.values[i]! > 0)
              let base = y(0)
              const breakdown = [...parts]
                .reverse()
                .map((s) => `${s.label}: ${money(s.values[i]!)}`)
                .join('\n')
              return (
                <g key={p.startDay}>
                  {/* Průhledný sloupec přes celé období = bublina s celkem a rozpadem. */}
                  <rect x={xStart(i)} y={TOP} width={slot} height={PLOT} fill="transparent">
                    <title>{`${tooltip(i)}${breakdown ? `\n\n${breakdown}` : ''}`}</title>
                  </rect>
                  {parts.map((s, k) => {
                    const h = y(0) - y(s.values[i]!)
                    // Mezera 2 px mezi úseky; horní úsek se zaobleným koncem.
                    const height = Math.max(0, h - (k > 0 ? 2 : 0))
                    const topY = base - h
                    const bottom = topY + height
                    base = topY
                    if (height < 0.5) return null
                    const r = k === parts.length - 1 ? Math.min(3, height, bar / 2) : 0
                    return (
                      <path
                        key={s.key}
                        d={`M ${x} ${bottom} V ${topY + r} a ${r} ${r} 0 0 1 ${r} ${-r} H ${x + bar - r} a ${r} ${r} 0 0 1 ${r} ${r} V ${bottom} z`}
                        className={s.color.fill}
                        pointerEvents="none"
                      />
                    )
                  })}
                </g>
              )
            })}

          {mode === 'scurve' && (
            <>
              <path d={`M ${LEFT} ${y(0)} ${cumPath} V ${y(0)} Z`} className="fill-miro-graphite/10 dark:fill-miro-paper/10" pointerEvents="none" />
              <path d={`M ${LEFT} ${y(0)} ${cumPath}`} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-miro-graphite dark:stroke-miro-paper" pointerEvents="none" />
              {limit !== null && (
                <line x1={LEFT} x2={width - RIGHT} y1={y(limit)} y2={y(limit)} strokeWidth={1.5} strokeDasharray="5 4" className="stroke-red-600 dark:stroke-red-400" pointerEvents="none" />
              )}
              {periods.map((p, i) => (
                <rect key={p.startDay} x={xStart(i)} y={TOP} width={slot} height={PLOT} fill="transparent">
                  <title>{tooltip(i)}</title>
                </rect>
              ))}
              {exceedIndex >= 0 && (
                <circle cx={xStart(exceedIndex) + slot} cy={y(cum[exceedIndex]!)} r={5} strokeWidth={2} className="fill-red-600 stroke-white dark:fill-red-400 dark:stroke-slate-900">
                  <title>{t('costs.chart.exceed', { period: labels[exceedIndex]!.title })}</title>
                </circle>
              )}
            </>
          )}

          {todayX !== null && (
            <line x1={todayX} x2={todayX} y1={TOP} y2={TOP + PLOT} strokeWidth={2} className="stroke-miro-turquoise-dark dark:stroke-miro-turquoise" pointerEvents="none" />
          )}
        </svg>
      )}
    </figure>
  )
}
