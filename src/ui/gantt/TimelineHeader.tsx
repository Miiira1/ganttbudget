/**
 * Hlavička časové osy: dva řádky (např. měsíce nahoře, týdny dole).
 * Úseky počítá gantt/timeline.ts; tady se jen přeloží na text podle jazyka.
 * Hlavička je „lepivá“ (sticky) – při posunu dolů zůstává nahoře.
 */
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { dayToIso } from '../../engine/calendar'
import { formatIsoDate, formatMonth } from '../../i18n/format'
import { HEADER_HEIGHT } from '../../gantt/geometry'
import { headerRows, type HeaderSegment, type Timeline } from '../../gantt/timeline'

/** Text úseku; u úzkých úseků kratší varianta. */
export function segmentLabel(s: HeaderSegment, isTop: boolean, t: TFunction, lang: string): string {
  switch (s.unit) {
    case 'year':
      return String(s.value)
    case 'quarter':
      return s.width >= 90 ? t('gantt.quarter', { n: s.value }) : t('gantt.quarterShort', { n: s.value })
    case 'month':
      if (isTop) return s.width >= 110 ? formatMonth(s.year, s.value, lang, 'withYear') : formatMonth(s.year, s.value, lang, 'short')
      return s.width >= 80 ? formatMonth(s.year, s.value, lang, 'long') : formatMonth(s.year, s.value, lang, 'short')
    case 'week':
      return s.width >= 60 ? t('gantt.week', { n: s.value }) : t('gantt.weekShort', { n: s.value })
    case 'day':
      return String(s.value)
  }
}

/** Bublina s přesným rozsahem dnů úseku. */
function segmentTitle(s: HeaderSegment, t: TFunction, lang: string): string {
  const from = formatIsoDate(dayToIso(s.startDay), lang)
  const to = formatIsoDate(dayToIso(s.endDay - 1), lang)
  return from === to ? from : t('gantt.range', { from, to })
}

const ROW = HEADER_HEIGHT / 2

export function TimelineHeader({ tl }: { tl: Timeline }) {
  const { t, i18n } = useTranslation()
  const rows = headerRows(tl)
  return (
    <div
      aria-hidden="true"
      className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      style={{ height: HEADER_HEIGHT, width: tl.width }}
    >
      {rows.map((row, r) =>
        row.map((s) => (
          <div
            key={`${r}-${s.startDay}`}
            title={segmentTitle(s, t, i18n.language)}
            className={`absolute overflow-hidden text-ellipsis whitespace-nowrap border-r border-slate-300 dark:border-slate-600 ${
              r === 0 ? 'border-b px-2 font-semibold' : `font-normal tabular-nums ${s.unit === 'day' ? 'text-center' : 'px-2'}`
            }`}
            style={{ left: s.x, width: s.width, top: r * ROW, height: ROW, lineHeight: `${ROW}px` }}
          >
            {segmentLabel(s, r === 0, t, i18n.language)}
          </div>
        )),
      )}
    </div>
  )
}
