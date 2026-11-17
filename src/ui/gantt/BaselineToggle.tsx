/** Přepínač „Baseline“ v liště plánu (fáze 9, G-08): šedá stínová úsečka s termíny vybrané baseline. */
import { useTranslation } from 'react-i18next'
import { activeBaseline } from '../../model/baseline'
import { useProject } from '../../store/useProject'
import { useDisplayOptions } from '../displayOptions'

export function BaselineToggle() {
  const { t } = useTranslation()
  const baseline = useProject((s) => activeBaseline(s.project))
  const showBaseline = useDisplayOptions((s) => s.showBaseline)
  const toggle = useDisplayOptions((s) => s.toggleBaseline)
  const on = showBaseline && baseline !== null
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={baseline === null}
      onClick={toggle}
      title={baseline ? t('gantt.baselineHint', { name: baseline.name }) : t('gantt.baselineNone')}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 ${
        on
          ? 'border-miro-graphite bg-miro-graphite text-miro-paper dark:border-miro-paper dark:bg-miro-paper dark:text-miro-graphite'
          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        {/* Úsečka plánu a pod ní tenká stínová úsečka baseline. */}
        <rect x="3" y="3" width="11" height="5" rx="1.5" fill="currentColor" />
        <rect x="1" y="10.5" width="10" height="2.5" rx="1" fill="currentColor" opacity="0.55" />
      </svg>
      {t('gantt.baseline')}
    </button>
  )
}
