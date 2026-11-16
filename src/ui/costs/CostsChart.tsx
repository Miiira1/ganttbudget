/**
 * Graf nákladů v SVG (fáze 7, bez knihovny): skládané sloupce = náklady za období rozdělené
 * podle zvoleného členění (kategorie / fáze / druh; pravá osa), čára = kumulativní náklady
 * (levá osa), přerušovaná červená = limit projektu.
 * Červená tečka = období, ve kterém kumulativní náklady limit přesáhnou.
 */
import { useTranslation } from 'react-i18next'
import { cumulative } from '../../model/costTimeline'
import { formatMoney, formatMoneyCompact } from '../../model/money'
import type { DayRange } from '../../model/periods'
import type { SeriesColor } from './palette'

/** Jedna skupina (úsek sloupce): popisek, částky po obdobích a barva. */
export interface ChartSeries {
  key: string
  label: string
  values: number[]
  color: SeriesColor
}

const PLOT = 150
const LEFT = 64
const RIGHT = 64
const TOP = 10
const LABELS = 18

export function CostsChart({
  periods,
  labels,
  totals,
  series,
  limit,
  exceedDay,
  currency,
}: {
  periods: DayRange[]
  labels: { top: string; title: string }[]
  /** Náklady za období (haléře) – součet všech úseků. */
  totals: number[]
  /** Úseky sloupců zdola nahoru (jen skupiny s nenulovým součtem). */
  series: ChartSeries[]
  /** Limit projektu; null = bez čáry limitu. */
  limit: number | null
  exceedDay: number | null
  currency: string
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const money = (v: number) => formatMoney(v, currency, lang)
  const compact = (v: number) => formatMoneyCompact(v, currency, lang)

  const slot = Math.max(8, Math.min(56, Math.floor(900 / Math.max(1, periods.length))))
  const bar = Math.max(4, slot - (slot > 16 ? 10 : 3))
  const width = LEFT + periods.length * slot + RIGHT
  const cum = cumulative(totals)
  const maxCum = Math.max(1, ...cum, limit ?? 0) * 1.05
  const maxBar = Math.max(1, ...totals) * 1.1
  const yCum = (v: number) => TOP + PLOT - (v / maxCum) * PLOT
  const yBar = (v: number) => (v / maxBar) * PLOT
  const xEnd = (i: number) => LEFT + (i + 1) * slot
  const exceedIndex = exceedDay === null ? -1 : periods.findIndex((p) => exceedDay >= p.startDay && exceedDay <= p.endDay)
  const labelEvery = Math.max(1, Math.ceil(48 / slot))
  const line = `M ${LEFT} ${yCum(0)} ` + cum.map((v, i) => `L ${xEnd(i)} ${yCum(v)}`).join(' ')

  return (
    <figure className="overflow-x-auto px-4 py-2">
      <figcaption className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
        {series.map((s) => (
          <span key={s.key} className="inline-flex max-w-56 items-center gap-1" title={`${s.label}: ${money(s.values.reduce((a, b) => a + b, 0))}`}>
            <span aria-hidden="true" className={`inline-block h-2.5 w-3 shrink-0 rounded-sm ${s.color.swatch}`} />
            <span className="truncate">{s.label}</span>
          </span>
        ))}
        <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">
          |
        </span>
        <span>{t('costs.chart.period')}</span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-miro-graphite dark:bg-miro-paper" />
          {t('costs.chart.cumulative')}
        </span>
        {limit !== null && (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-red-600 dark:border-red-400" />
            {t('costs.chart.limit', { amount: money(limit) })}
          </span>
        )}
      </figcaption>
      <svg
        width={width}
        height={TOP + PLOT + LABELS + 4}
        role="img"
        aria-label={t('costs.chart.summary', { total: money(cum.at(-1) ?? 0) })}
        className="block"
      >
        {/* Osy: vlevo kumulativně, vpravo za období. */}
        <g className="fill-slate-500 text-[10px] dark:fill-slate-400">
          <text x={LEFT - 6} y={TOP + 8} textAnchor="end">
            {compact(maxCum / 1.05)}
          </text>
          <text x={LEFT - 6} y={TOP + PLOT} textAnchor="end">
            0
          </text>
          <text x={width - RIGHT + 6} y={TOP + PLOT - yBar(maxBar / 1.1) + 8} textAnchor="start">
            {compact(maxBar / 1.1)}
          </text>
          <text x={width - RIGHT + 6} y={TOP + PLOT} textAnchor="start">
            0
          </text>
        </g>
        <line x1={LEFT} x2={width - RIGHT} y1={TOP + PLOT + 0.5} y2={TOP + PLOT + 0.5} className="stroke-slate-300 dark:stroke-slate-600" />
        <line x1={LEFT} x2={width - RIGHT} y1={yCum(maxCum / 1.05)} y2={yCum(maxCum / 1.05)} strokeDasharray="2 3" className="stroke-slate-200 dark:stroke-slate-700" />

        {totals.map((v, i) => {
          const x = LEFT + i * slot + (slot - bar) / 2
          // Úseky zdola nahoru; mezi nimi tenká mezera barvou pozadí, aby se odlišily.
          let base = TOP + PLOT
          const segments = series.map((s) => {
            const h = yBar(s.values[i]!)
            base -= h
            return h > 0 ? (
              <rect key={s.key} x={x} y={base} width={bar} height={h} strokeWidth={0.75} className={`${s.color.fill} stroke-white dark:stroke-slate-900`}>
                <title>{`${labels[i]!.title} – ${s.label}: ${money(s.values[i]!)}`}</title>
              </rect>
            ) : null
          })
          const breakdown = series
            .filter((s) => s.values[i]! > 0)
            .reverse()
            .map((s) => `${s.label}: ${money(s.values[i]!)}`)
            .join('\n')
          return (
            <g key={periods[i]!.startDay}>
              <rect x={LEFT + i * slot} y={TOP} width={slot} height={PLOT} fill="transparent">
                <title>{`${t('costs.chart.bar', { period: labels[i]!.title, amount: money(v), cumulative: money(cum[i]!) })}${breakdown ? `\n\n${breakdown}` : ''}`}</title>
              </rect>
              {segments}
              {i % labelEvery === 0 && (
                <text x={LEFT + i * slot + slot / 2} y={TOP + PLOT + LABELS - 4} textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400">
                  {labels[i]!.top}
                </text>
              )}
            </g>
          )
        })}

        {limit !== null && (
          <line x1={LEFT} x2={width - RIGHT} y1={yCum(limit)} y2={yCum(limit)} strokeWidth={1.5} strokeDasharray="5 4" className="stroke-red-600 dark:stroke-red-400" pointerEvents="none" />
        )}
        <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-miro-graphite dark:stroke-miro-paper" pointerEvents="none" />
        {exceedIndex >= 0 && (
          <circle cx={xEnd(exceedIndex)} cy={yCum(cum[exceedIndex]!)} r={4.5} className="fill-red-600 stroke-white dark:fill-red-400 dark:stroke-slate-900" strokeWidth={1.5}>
            <title>{t('costs.chart.exceed', { period: labels[exceedIndex]!.title })}</title>
          </circle>
        )}
      </svg>
    </figure>
  )
}
