/**
 * Tabulka činností v pohledu Sledování (fáze 9, A-05): termíny baseline proti plánu, posun konce,
 * % hotovo a částky Earned Value (BAC, PV, EV, AC, CV, SV). Fáze sčítají své položky.
 * Položka jen v baseline (smazaná z plánu) je šedá kurzívou, nová (není v baseline) má štítek.
 * Záporné CV / SV (předražení, zpoždění) jsou červeně s mínusem – nejen barvou.
 */
import { useTranslation } from 'react-i18next'
import { formatIsoDate } from '../../i18n/format'
import type { EarnedValueResult, EvRow } from '../../model/earnedValue'
import { formatMoney } from '../../model/money'

export function TrackingTable({ ev, wbs, currency }: { ev: EarnedValueResult; wbs: ReadonlyMap<string, string>; currency: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const money = (v: number) => formatMoney(v, currency, lang)
  const date = (iso: string | null) => (iso ? formatIsoDate(iso, lang) : '')
  const depthOf = (row: EvRow): number => {
    let depth = 0
    for (let parent = row.parentId; parent !== null && depth < 50; parent = ev.byId.get(parent)?.parentId ?? null) depth++
    return depth
  }
  const th = 'sticky top-0 z-10 border-b border-slate-300 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
  const num = 'px-2 py-1 text-right tabular-nums whitespace-nowrap'
  const signed = (v: number) => (
    <td className={`${num} ${v < 0 ? 'text-red-700 dark:text-red-300' : ''}`}>{v === 0 ? money(0) : v > 0 ? `+${money(v)}` : money(v)}</td>
  )
  const shift = (v: number | null) => (v === null ? '' : v === 0 ? '0' : v > 0 ? `+${v}` : String(v))

  return (
    <div className="overflow-auto">
      <table className="min-w-full border-collapse text-sm">
        <caption className="sr-only">{t('tracking.table.caption')}</caption>
        <thead>
          <tr>
            <th className={`${th} text-left`}>{t('tracking.table.wbs')}</th>
            <th className={`${th} text-left`}>{t('tracking.table.name')}</th>
            <th className={`${th} text-left`}>{t('tracking.table.baseline')}</th>
            <th className={`${th} text-left`}>{t('tracking.table.plan')}</th>
            <th className={`${th} text-right`} title={t('tracking.table.shiftHint')}>
              {t('tracking.table.shift')}
            </th>
            <th className={`${th} text-right`}>{t('tracking.table.percent')}</th>
            {(['bac', 'pv', 'ev', 'ac'] as const).map((k) => (
              <th key={k} className={`${th} text-right`} title={t(`tracking.terms.${k}.name`)}>
                {t(`tracking.terms.${k}.short`)}
              </th>
            ))}
            <th className={`${th} text-right`} title={t('tracking.table.cvHint')}>
              CV
            </th>
            <th className={`${th} text-right`} title={t('tracking.table.svHint')}>
              SV
            </th>
          </tr>
        </thead>
        <tbody>
          {ev.rows.map((r) => {
            const phase = r.kind === 'phase'
            return (
              <tr key={r.taskId} className={`border-b border-slate-200 dark:border-slate-700 ${phase ? 'font-semibold' : ''} ${r.inPlan ? '' : 'italic text-slate-500 dark:text-slate-400'}`}>
                <td className="px-2 py-1 tabular-nums text-slate-500 dark:text-slate-400">{wbs.get(r.taskId) ?? ''}</td>
                <td className="max-w-80 truncate px-2 py-1" style={{ paddingLeft: `${0.5 + depthOf(r) * 1.1}rem` }} title={r.name}>
                  {r.name}
                  {!r.inPlan && <span className="ml-1.5 text-xs font-normal">({t('tracking.table.notInPlan')})</span>}
                  {!r.inBaseline && (
                    <span className="ml-1.5 rounded bg-miro-turquoise-light px-1 text-xs font-normal not-italic text-miro-graphite dark:bg-slate-700 dark:text-slate-100" title={t('tracking.table.newHint')}>
                      {t('tracking.table.new')}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-1 tabular-nums">{r.baselineStart ? `${date(r.baselineStart)} – ${date(r.baselineFinish)}` : ''}</td>
                <td className="whitespace-nowrap px-2 py-1 tabular-nums">{r.start ? `${date(r.start)} – ${date(r.finish)}` : ''}</td>
                <td className={`${num} ${(r.finishShift ?? 0) > 0 ? 'text-red-700 dark:text-red-300' : ''}`}>{shift(r.finishShift)}</td>
                <td className={num}>{r.kind === 'milestone' ? (r.percent >= 100 ? '✓' : '–') : `${r.percent} %`}</td>
                <td className={num}>{money(r.bac)}</td>
                <td className={num}>{money(r.pv)}</td>
                <td className={num}>{money(r.ev)}</td>
                <td className={num}>{money(r.ac)}</td>
                {signed(r.ev - r.ac)}
                {signed(r.ev - r.pv)}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-semibold dark:border-slate-600">
            <td className="px-2 py-1" />
            <td className="px-2 py-1">{t('costs.total')}</td>
            <td colSpan={4} />
            <td className={num}>{money(ev.totals.bac)}</td>
            <td className={num}>{money(ev.totals.pv)}</td>
            <td className={num}>{money(ev.totals.ev)}</td>
            <td className={num}>{money(ev.totals.ac)}</td>
            {signed(ev.totals.cv)}
            {signed(ev.totals.sv)}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
