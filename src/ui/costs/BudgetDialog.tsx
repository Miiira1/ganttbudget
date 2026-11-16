/**
 * Dialog „Limity rozpočtu“ (fáze 7, R-06): limit celého projektu a volitelně kategorií.
 * U každého je vidět plánovaná částka a čerpání v %. Prázdné pole = bez limitu.
 * Každá změna je jeden krok Zpět.
 */
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { totalsByCategory } from '../../model/costTimeline'
import { formatAmount, formatMoney, parseMoney } from '../../model/money'
import { projectStore, useCostTimeline, useProject } from '../../store/useProject'
import { TextCell } from '../EditableCells'
import { showNotice } from '../notice'

export function BudgetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const project = useProject((s) => s.project)
  const timeline = useCostTimeline()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const byCategory = totalsByCategory(timeline)
  const limits = new Map((project.budget?.categoryLimits ?? []).map((c) => [c.categoryId, c.limit]))
  const money = (v: number) => formatMoney(v, project.currency, lang)
  const th = 'border-b border-slate-300 px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:text-slate-300'

  function row(key: string, name: string, planned: number, limit: number | undefined, onSet: (v: number | null) => void, strong = false) {
    const pct = limit ? Math.round((planned / limit) * 100) : null
    return (
      <tr key={key} className={`border-b border-slate-200 dark:border-slate-700 ${strong ? 'font-semibold' : ''}`}>
        <th scope="row" className="px-2 py-1 text-left font-[inherit]">
          {name}
        </th>
        <td className="px-2 py-1 text-right tabular-nums">{money(planned)}</td>
        <td className="w-40 px-1 py-0.5">
          <TextCell
            value={limit ? formatAmount(limit, lang) : ''}
            label={t('costs.limits.limitFor', { name })}
            className="text-right tabular-nums"
            onCommit={(raw) => {
              if (raw.trim() === '') return onSet(null)
              const value = parseMoney(raw)
              if (value === null || value < 1) {
                showNotice(t('costs.limits.invalid'))
                return false
              }
              onSet(value)
            }}
          />
        </td>
        <td className={`w-20 px-2 py-1 text-right tabular-nums ${pct !== null && pct > 100 ? 'font-semibold text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-300'}`}>
          {pct === null ? '' : `${pct} %`}
        </td>
      </tr>
    )
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {t('costs.limits.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('costs.limits.intro', { currency: project.currency })}</p>
        <table className="mt-4 w-full border-collapse text-sm">
          <caption className="sr-only">{t('costs.limits.title')}</caption>
          <thead>
            <tr>
              <th className={th}>{t('costs.limits.columns.item')}</th>
              <th className={`${th} text-right`}>{t('costs.limits.columns.planned')}</th>
              <th className={`${th} text-right`}>{t('costs.limits.columns.limit')}</th>
              <th className={`${th} text-right`}>{t('costs.limits.columns.used')}</th>
            </tr>
          </thead>
          <tbody>
            {row('project', t('costs.limits.project'), timeline.total, project.budget?.limit, (v) => projectStore.getState().setBudgetLimit(v), true)}
            {project.costCategories.map((c) =>
              row(c.id, c.name, byCategory.get(c.id) ?? 0, limits.get(c.id), (v) => projectStore.getState().setCategoryLimit(c.id, v)),
            )}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('costs.limits.undo')}</p>
        <div className="mt-5 flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('costs.limits.close')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
