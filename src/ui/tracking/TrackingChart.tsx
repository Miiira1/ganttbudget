/**
 * Graf křivek Earned Value v pohledu Sledování (fáze 9, A-05) – SVG bez knihovny, jedna osa (Kč):
 *  - PV (plán podle baseline) = grafitová čárkovaná křivka přes celé období,
 *  - AC (skutečné náklady) = zlatá plná křivka do data stavu,
 *  - EV (hotová práce) = tyrkysový bod v datu stavu (historii % hotovo neukládáme),
 *  - svislá čárkovaná čára = datum stavu.
 * Legenda nad grafem, bubliny s přesnými čísly; šířka podle panelu.
 */
import { useTranslation } from 'react-i18next'
import { formatMoney, formatMoneyCompact } from '../../model/money'
import type { DayRange } from '../../model/periods'
import { useElementSize } from '../useElementSize'

const PLOT = 200
const LEFT = 70
const RIGHT = 16
const TOP = 12
const LABELS = 18
const NICE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

function niceMax(max: number): number {
  if (max <= 0) return 100
  const exp = 10 ** Math.floor(Math.log10(max))
  return NICE.find((f) => f * exp >= max)! * exp
}

export function TrackingChart({
  periods,
  labels,
  pv,
  ac,
  ev,
  statusDay,
  currency,
}: {
  periods: DayRange[]
  labels: { top: string; title: string }[]
  /** Kumulativní PV ke konci období. */
  pv: number[]
  /** Kumulativní AC ke konci období (k datu stavu); null = po datu stavu. */
  ac: (number | null)[]
  ev: number
  statusDay: number
  currency: string
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [ref, size] = useElementSize<HTMLElement>()
  const money = (v: number) => formatMoney(v, currency, lang)
  const compact = (v: number) => formatMoneyCompact(v, currency, lang)

  const width = Math.max(320, Math.floor(size.width))
  const slot = Math.max(4, (width - LEFT - RIGHT) / Math.max(1, periods.length))
  const top = niceMax(Math.max(0, ...pv, ...ac.map((v) => v ?? 0), ev))
  const y = (v: number) => TOP + PLOT - (Math.max(0, v) / top) * PLOT
  const xEnd = (i: number) => LEFT + (i + 1) * slot
  const statusIndex = periods.findIndex((p) => statusDay >= p.startDay && statusDay <= p.endDay)
  const statusX =
    statusIndex < 0
      ? statusDay < (periods[0]?.startDay ?? 0)
        ? LEFT
        : LEFT + periods.length * slot
      : LEFT + statusIndex * slot + ((statusDay - periods[statusIndex]!.startDay + 1) / (periods[statusIndex]!.endDay - periods[statusIndex]!.startDay + 1)) * slot
  const labelEvery = Math.max(1, Math.ceil(56 / slot))

  const pvPath = `M ${LEFT} ${y(0)} ${pv.map((v, i) => `L ${xEnd(i)} ${y(v)}`).join(' ')}`
  // AC do data stavu: poslední bod v datu stavu (ne na konci jeho období).
  const acPoints = ac.flatMap((v, i) => (v === null ? [] : [[i === statusIndex ? statusX : xEnd(i), y(v)] as const]))
  const acPath = acPoints.length > 0 ? `M ${LEFT} ${y(0)} ${acPoints.map(([x, yy]) => `L ${x} ${yy}`).join(' ')}` : ''

  return (
    <figure ref={ref} className="py-2">
      <figcaption className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden="true">
            <line x1="0" x2="18" y1="3" y2="3" strokeWidth="2" strokeDasharray="4 3" className="stroke-miro-graphite dark:stroke-miro-paper" />
          </svg>
          {t('tracking.chart.pv')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-miro-gold dark:bg-miro-yellow" />
          {t('tracking.chart.ac')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-miro-turquoise-dark ring-2 ring-white dark:bg-miro-turquoise dark:ring-slate-900" />
          {t('tracking.chart.ev')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="6" height="12" aria-hidden="true">
            <line x1="3" x2="3" y1="0" y2="12" strokeWidth="1.5" strokeDasharray="3 2" className="stroke-slate-500 dark:stroke-slate-400" />
          </svg>
          {t('tracking.chart.status')}
        </span>
      </figcaption>
      {size.width > 0 && (
        <svg width={width} height={TOP + PLOT + LABELS + 4} role="img" aria-label={t('tracking.chart.summary', { pv: money(pv.at(-1) ?? 0), ev: money(ev) })} className="block">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(f * top)} y2={y(f * top)} strokeWidth={1} className="stroke-slate-200 dark:stroke-slate-700" />
              <text x={LEFT - 6} y={y(f * top) + 3} textAnchor="end" className="fill-slate-600 text-[10px] dark:fill-slate-300">
                {f === 0 ? '0' : compact(f * top)}
              </text>
            </g>
          ))}
          {periods.map((p, i) =>
            i % labelEvery === 0 ? (
              <text key={p.startDay} x={LEFT + i * slot + slot / 2} y={TOP + PLOT + LABELS - 4} textAnchor="middle" className="fill-slate-600 text-[10px] dark:fill-slate-300">
                {labels[i]!.top}
              </text>
            ) : null,
          )}
          <line x1={statusX} x2={statusX} y1={TOP} y2={TOP + PLOT} strokeWidth={1.5} strokeDasharray="3 2" className="stroke-slate-500 dark:stroke-slate-400" pointerEvents="none" />
          <path d={pvPath} fill="none" strokeWidth={2} strokeDasharray="6 4" strokeLinejoin="round" className="stroke-miro-graphite dark:stroke-miro-paper" pointerEvents="none" />
          {acPath && <path d={acPath} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-miro-gold dark:stroke-miro-yellow" pointerEvents="none" />}
          {/* Bubliny po obdobích (plocha přes celý sloupec). */}
          {periods.map((p, i) => (
            <rect key={p.startDay} x={LEFT + i * slot} y={TOP} width={slot} height={PLOT} fill="transparent">
              <title>
                {ac[i] === null
                  ? t('tracking.chart.tipPlan', { period: labels[i]!.title, pv: money(pv[i]!) })
                  : t('tracking.chart.tip', { period: labels[i]!.title, pv: money(pv[i]!), ac: money(ac[i]!) })}
              </title>
            </rect>
          ))}
          <circle cx={statusX} cy={y(ev)} r={5} strokeWidth={2} className="fill-miro-turquoise-dark stroke-white dark:fill-miro-turquoise dark:stroke-slate-900">
            <title>{t('tracking.chart.evTip', { ev: money(ev) })}</title>
          </circle>
        </svg>
      )}
    </figure>
  )
}
