/** Přepínač „Kritická cesta“ v liště plánu (fáze 6c, F-09). */
import { useTranslation } from 'react-i18next'
import { useDisplayOptions } from '../displayOptions'

export function CriticalToggle() {
  const { t } = useTranslation()
  const showCritical = useDisplayOptions((s) => s.showCritical)
  const toggle = useDisplayOptions((s) => s.toggleCritical)
  return (
    <button
      type="button"
      aria-pressed={showCritical}
      onClick={toggle}
      title={t('gantt.criticalHint')}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        showCritical
          ? 'border-miro-yellow bg-miro-yellow text-miro-graphite'
          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        {/* Tři navazující úsečky spojené cestou – „řetěz“, na kterém závisí konec projektu. */}
        <rect x="1" y="2.5" width="5" height="3" rx="1.5" fill="currentColor" />
        <rect x="6" y="6.5" width="4.5" height="3" rx="1.5" fill="currentColor" />
        <rect x="10.5" y="10.5" width="4.5" height="3" rx="1.5" fill="currentColor" />
        <path d="M6 4h1.5v2.5M10.5 8h1.5v2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
      {t('gantt.critical')}
    </button>
  )
}
