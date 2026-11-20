/**
 * Grafy ke kontingenční tabulce (fáze 8, A-02) – SVG bez knihovny, podle zásad pro grafy:
 * jedna osa, tenké značky (sloupce max. 24 px, zaoblený konec 4 px, čáry 2 px, body ≥ 8 px
 * s prstencem barvy pozadí), mezera 2 px mezi úseky, tlumená mřížka, text nikdy v barvě dat,
 * legenda u dvou a více řad, bubliny s přesnými čísly. Barvy: odstíny značky (palette.ts),
 * barva patří skupině podle pořadí; skupiny navíc jsou „Ostatní“ (světle šedá).
 *
 *  - sloupcový: součty skupin (vodorovné pruhy, jedna barva – jedna řada),
 *  - koláčový: podíly skupin (prstenec),
 *  - čárový: vývoj skupin přes sloupce tabulky (typicky období),
 *  - skládaný: sloupce tabulky, v každém úseky skupin.
 * Graf se přizpůsobí šířce a výšce panelu (width / height) – tažení rozdělovníku ho překreslí.
 */
import { useTranslation } from 'react-i18next'
import { formatPercent } from '../../i18n/format'
import { OTHER, type ChartSeriesData, type ChartType } from '../../model/pivotChart'
import { SERIES_COLORS, seriesColor, type SeriesColor } from '../costs/palette'
import { useElementSize } from '../useElementSize'

const OTHER_COLOR: SeriesColor = SERIES_COLORS[9]!
const SURFACE = 'stroke-white dark:stroke-slate-900'
const TEXT = 'fill-slate-600 dark:fill-slate-300'
const GRID = 'stroke-slate-200 dark:stroke-slate-700'

/** Zaokrouhlené maximum osy (1 / 2 / 5 × 10ⁿ) a tři čárky mřížky. */
function niceMax(max: number): number {
  if (max <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(max))
  const f = max / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp
}

export interface PivotChartProps {
  type: ChartType
  series: ChartSeriesData[]
  columns: string[]
  seriesLabel: (key: string) => string
  columnLabel: (key: string) => string
  /** Přesná hodnota (bubliny, popisky). */
  format: (v: number) => string
  /** Krátká hodnota (osy). */
  compact: (v: number) => string
}

export function PivotChart(props: PivotChartProps) {
  const { t } = useTranslation()
  // Velikost plochy pod legendou – graf ji vyplní (mění se s oknem i rozdělovníkem).
  const [plotRef, size] = useElementSize<HTMLDivElement>()
  const colorOf = (s: ChartSeriesData) => (s.key === OTHER ? OTHER_COLOR : seriesColor(s.index))
  const labelOf = (s: ChartSeriesData) => (s.key === OTHER ? t('analysis.chart.other') : props.seriesLabel(s.key))
  const nonEmpty = props.series.filter((s) => s.total !== 0)
  if (nonEmpty.length === 0) return <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">{t('analysis.chart.empty')}</p>

  const legend = props.type !== 'bar' && nonEmpty.length >= 2 && (
    <ul aria-label={t('analysis.chart.legend')} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
      {nonEmpty.map((s) => (
        <li key={s.key} className="inline-flex max-w-64 items-center gap-1.5" title={`${labelOf(s)}: ${props.format(s.total)}`}>
          <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${colorOf(s).swatch}`} />
          <span className="truncate">{labelOf(s)}</span>
        </li>
      ))}
    </ul>
  )

  return (
    <figure className="flex h-full min-h-0 flex-col gap-2">
      {legend}
      {/* Místo pro svislý posuvník je vyhrazené stále – když se objeví, nezmění šířku grafu
          a nerozjede smyčku „posuvník → menší graf → bez posuvníku → větší graf“. */}
      <div ref={plotRef} className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
        {size.width > 0 && (
          <>
            {props.type === 'bar' && <BarChart {...props} {...size} series={nonEmpty} labelOf={labelOf} />}
            {props.type === 'pie' && <PieChart {...props} {...size} series={nonEmpty} labelOf={labelOf} colorOf={colorOf} />}
            {props.type === 'line' && <LineChart {...props} {...size} series={nonEmpty} labelOf={labelOf} colorOf={colorOf} />}
            {props.type === 'stacked' && <StackedChart {...props} {...size} series={nonEmpty} labelOf={labelOf} colorOf={colorOf} />}
          </>
        )}
      </div>
    </figure>
  )
}

type Inner = PivotChartProps & { labelOf: (s: ChartSeriesData) => string; colorOf?: (s: ChartSeriesData) => SeriesColor; width: number; height: number }

/** Vodorovné pruhy součtů skupin, hodnota na konci pruhu. */
function BarChart({ series, labelOf, format, compact, width }: Inner) {
  const { t } = useTranslation()
  const VALUE = 104 // místo pro hodnotu za pruhem
  const LABEL = Math.round(Math.min(200, Math.max(90, width * 0.32)))
  const PLOT = Math.max(80, width - LABEL - VALUE - 8)
  const maxChars = Math.max(8, Math.floor(LABEL / 6.5))
  const ROW = 28
  const BAR = 16
  const max = niceMax(Math.max(...series.map((s) => Math.abs(s.total))))
  const x = (v: number) => (Math.max(0, v) / max) * PLOT
  const height = series.length * ROW + 24
  return (
    <svg width={LABEL + PLOT + VALUE} height={height} role="img" aria-label={t('analysis.chart.barSummary', { count: series.length })} className="block text-[11px]">
      {/* V úzkém panelu jen 0 a maximum, aby se popisky osy nepřekrývaly. */}
      {(PLOT < 220 ? [0, 1] : [0, 0.5, 1]).map((f) => (
        <g key={f}>
          <line x1={LABEL + f * PLOT} x2={LABEL + f * PLOT} y1={0} y2={series.length * ROW} strokeWidth={1} className={GRID} />
          <text x={LABEL + f * PLOT} y={series.length * ROW + 14} textAnchor="middle" className={TEXT}>
            {compact(f * max)}
          </text>
        </g>
      ))}
      {series.map((s, i) => {
        const w = x(s.total)
        const y = i * ROW + (ROW - BAR) / 2
        const r = Math.min(4, w / 2)
        return (
          <g key={s.key}>
            <title>{`${labelOf(s)}: ${format(s.total)}`}</title>
            <rect x={0} y={i * ROW} width={LABEL + PLOT + VALUE} height={ROW} fill="transparent" />
            <text x={LABEL - 8} y={i * ROW + ROW / 2 + 4} textAnchor="end" className="fill-slate-800 dark:fill-slate-100">
              {labelOf(s).length > maxChars ? `${labelOf(s).slice(0, maxChars - 1)}…` : labelOf(s)}
            </text>
            {w > 0 && (
              <path
                d={`M ${LABEL} ${y} h ${w - r} a ${r} ${r} 0 0 1 ${r} ${r} v ${BAR - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(w - r)} z`}
                className="fill-miro-turquoise-dark dark:fill-miro-turquoise"
              />
            )}
            <text x={LABEL + w + 6} y={i * ROW + ROW / 2 + 4} className={TEXT}>
              {format(s.total)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Prstenec podílů; mezi výsečemi mezera barvy pozadí. Tabulka podílů vedle, v úzkém panelu pod ním. */
function PieChart({ series, labelOf, colorOf, format, width, height }: Inner) {
  const { t, i18n } = useTranslation()
  // Prstenec nechá místo i pro tabulku podílů (vedle, nebo v úzkém panelu pod ním).
  const SIZE = Math.round(Math.min(240, Math.max(120, Math.min(width - 8, width >= 520 ? height - 16 : height * 0.55))))
  const C = SIZE / 2
  const R = C - 4
  const r = R * 0.6
  const total = series.reduce((sum, s) => sum + Math.max(0, s.total), 0)
  let angle = -Math.PI / 2
  const point = (a: number, radius: number) => `${C + radius * Math.cos(a)} ${C + radius * Math.sin(a)}`
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={SIZE} height={SIZE} role="img" aria-label={t('analysis.chart.pieSummary', { count: series.length })} className="block shrink-0">
        {series.map((s) => {
          const share = Math.max(0, s.total) / total
          const start = angle
          const end = (angle += share * 2 * Math.PI)
          const large = end - start > Math.PI ? 1 : 0
          const d =
            share >= 0.9999
              ? `M ${point(0, R)} A ${R} ${R} 0 1 1 ${point(Math.PI, R)} A ${R} ${R} 0 1 1 ${point(0, R)} M ${point(0, r)} A ${r} ${r} 0 1 0 ${point(Math.PI, r)} A ${r} ${r} 0 1 0 ${point(0, r)} z`
              : `M ${point(start, R)} A ${R} ${R} 0 ${large} 1 ${point(end, R)} L ${point(end, r)} A ${r} ${r} 0 ${large} 0 ${point(start, r)} z`
          return (
            <path key={s.key} d={d} fillRule="evenodd" strokeWidth={2} className={`${colorOf!(s).fill} ${SURFACE}`}>
              <title>{`${labelOf(s)}: ${format(s.total)} (${formatPercent(share * 100, i18n.language, 1)})`}</title>
            </path>
          )
        })}
      </svg>
      <table className="text-xs">
        <tbody>
          {series.map((s) => (
            <tr key={s.key}>
              <td className="pr-2">
                <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-sm ${colorOf!(s).swatch}`} />
              </td>
              <td className="max-w-56 truncate pr-3 text-slate-700 dark:text-slate-300">{labelOf(s)}</td>
              <td className="pr-3 text-right tabular-nums">{format(s.total)}</td>
              <td className="text-right tabular-nums text-slate-500 dark:text-slate-400">{formatPercent((Math.max(0, s.total) / total) * 100, i18n.language, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Společný rámec čárového a skládaného grafu: osa Y vlevo, sloupce tabulky na ose X; vyplní panel.
 * Výška se zaokrouhluje DOLŮ s rezervou 1 px: graf nesmí plochu přesáhnout ani o zlomek pixelu –
 * jinak se objeví posuvník, graf se zmenší, posuvník zmizí… a graf přeblikává (hlavně při
 * zvětšení stránky v prohlížeči, kdy má plocha necelé rozměry).
 */
export function frameFor(columns: string[], max: number, available: { width: number; height: number }) {
  const LEFT = 60
  const TOP = 8
  const PLOT_H = Math.floor(Math.min(320, Math.max(60, available.height - 31))) // vyplní panel, i nízký (rozvržení Pod sebou)
  const slot = Math.max(6, Math.min(140, Math.floor((available.width - LEFT - 16) / Math.max(1, columns.length))))
  const width = LEFT + columns.length * slot + 16
  const top = niceMax(max)
  const y = (v: number) => TOP + PLOT_H - (Math.max(0, v) / top) * PLOT_H
  const labelEvery = Math.max(1, Math.ceil(56 / slot))
  return { LEFT, PLOT_H, TOP, slot, width, top, y, labelEvery, height: TOP + PLOT_H + 22 }
}

function Axes({ frame, columns, columnLabel, compact }: { frame: ReturnType<typeof frameFor>; columns: string[]; columnLabel: (k: string) => string; compact: (v: number) => string }) {
  return (
    <g className="text-[10px]">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={frame.LEFT} x2={frame.width - 16} y1={frame.y(f * frame.top)} y2={frame.y(f * frame.top)} strokeWidth={1} className={GRID} />
          <text x={frame.LEFT - 6} y={frame.y(f * frame.top) + 3} textAnchor="end" className={TEXT}>
            {compact(f * frame.top)}
          </text>
        </g>
      ))}
      {columns.map((c, i) =>
        i % frame.labelEvery === 0 ? (
          <text key={c} x={frame.LEFT + i * frame.slot + frame.slot / 2} y={frame.TOP + frame.PLOT_H + 15} textAnchor="middle" className={TEXT}>
            {columnLabel(c)}
          </text>
        ) : null,
      )}
    </g>
  )
}

/** Bublina sloupce: název sloupce a hodnoty všech řad (od největší). */
function columnTitle(columnLabel: string, series: ChartSeriesData[], i: number, labelOf: (s: ChartSeriesData) => string, format: (v: number) => string) {
  const rows = series
    .filter((s) => s.values[i] !== 0)
    .sort((a, b) => b.values[i]! - a.values[i]!)
    .map((s) => `${labelOf(s)}: ${format(s.values[i]!)}`)
  return [columnLabel, ...rows].join('\n')
}

function LineChart({ series, columns, labelOf, colorOf, format, compact, columnLabel, width, height }: Inner) {
  const { t } = useTranslation()
  const frame = frameFor(columns, Math.max(...series.flatMap((s) => s.values)), { width, height })
  const cx = (i: number) => frame.LEFT + i * frame.slot + frame.slot / 2
  return (
    <svg width={frame.width} height={frame.height} role="img" aria-label={t('analysis.chart.lineSummary', { count: series.length, columns: columns.length })} className="block">
      <Axes frame={frame} columns={columns} columnLabel={columnLabel} compact={compact} />
      {series.map((s) => (
        <g key={s.key} className={colorOf!(s).stroke}>
          <path d={s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${cx(i)} ${frame.y(v)}`).join(' ')} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </g>
      ))}
      {series.map((s) =>
        frame.slot >= 14
          ? s.values.map((v, i) => <circle key={`${s.key}-${i}`} cx={cx(i)} cy={frame.y(v)} r={4} strokeWidth={2} className={`${colorOf!(s).fill} ${SURFACE}`} pointerEvents="none" />)
          : null,
      )}
      {columns.map((c, i) => (
        <rect key={c} x={frame.LEFT + i * frame.slot} y={frame.TOP} width={frame.slot} height={frame.PLOT_H} fill="transparent">
          <title>{columnTitle(columnLabel(c), series, i, labelOf, format)}</title>
        </rect>
      ))}
    </svg>
  )
}

function StackedChart({ series, columns, labelOf, colorOf, format, compact, columnLabel, width, height }: Inner) {
  const { t } = useTranslation()
  const totals = columns.map((_, i) => series.reduce((sum, s) => sum + Math.max(0, s.values[i]!), 0))
  const frame = frameFor(columns, Math.max(...totals), { width, height })
  const bar = Math.max(3, Math.min(24, frame.slot - (frame.slot > 10 ? 6 : 2)))
  const GAP = 2
  return (
    <svg width={frame.width} height={frame.height} role="img" aria-label={t('analysis.chart.stackedSummary', { count: series.length, columns: columns.length })} className="block">
      <Axes frame={frame} columns={columns} columnLabel={columnLabel} compact={compact} />
      {columns.map((c, i) => {
        const x = frame.LEFT + i * frame.slot + (frame.slot - bar) / 2
        let base = frame.y(0)
        const parts = series.filter((s) => s.values[i]! > 0)
        return (
          <g key={c}>
            {parts.map((s, k) => {
              const h = frame.y(0) - frame.y(s.values[i]!)
              const isTop = k === parts.length - 1
              const top = base - h
              // Mezera 2 px mezi úseky (ne obrys): úsek je o mezeru nižší.
              const height = Math.max(0, h - (k > 0 ? GAP : 0))
              base = top
              if (height <= 0) return null
              const r = isTop ? Math.min(4, height, bar / 2) : 0
              const d = `M ${x} ${top + height} V ${top + r} a ${r} ${r} 0 0 1 ${r} ${-r} H ${x + bar - r} a ${r} ${r} 0 0 1 ${r} ${r} V ${top + height} z`
              return (
                // Slabá barva dostane tenký obrys, aby byl úsek vidět i na bílé (audit U4).
                <path key={s.key} d={d} className={`${colorOf!(s).fill} ${colorOf!(s).edge}`} strokeWidth={1}>
                  <title>{`${columnLabel(c)} – ${labelOf(s)}: ${format(s.values[i]!)}`}</title>
                </path>
              )
            })}
            <rect x={frame.LEFT + i * frame.slot} y={frame.TOP} width={frame.slot} height={frame.PLOT_H} fill="transparent" pointerEvents={parts.length > 0 ? 'none' : 'auto'}>
              <title>{columnTitle(columnLabel(c), series, i, labelOf, format)}</title>
            </rect>
          </g>
        )
      })}
    </svg>
  )
}
