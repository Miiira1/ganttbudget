/** Dlaždice ukazatele dashboardu (Náklady, Vytížení): popisek, hodnota, drobná poznámka; červený okraj = překročení. */
export function Kpi({
  label,
  value,
  hint,
  alert = false,
  info,
}: {
  label: string
  value: string
  hint?: string
  alert?: boolean
  /** Tlačítko ⓘ s vysvětlením pojmu (U-03): popisek pro čtečky, stav a akce. */
  info?: { label: string; pressed: boolean; onClick: () => void }
}) {
  return (
    <div
      className={`relative min-w-36 rounded-md border px-3 py-1.5 ${info ? 'pr-8' : ''} ${
        alert ? 'border-l-4 border-red-600 bg-red-50 dark:border-red-400 dark:bg-red-950/40' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <p className="text-xs text-slate-600 dark:text-slate-400">{label}</p>
      {info && (
        <button
          type="button"
          aria-label={info.label}
          title={info.label}
          aria-pressed={info.pressed}
          onClick={info.onClick}
          className={`absolute right-1.5 top-1.5 h-5 w-5 rounded-full text-xs leading-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            info.pressed ? 'bg-miro-turquoise-dark text-white dark:bg-miro-turquoise dark:text-miro-graphite' : 'text-miro-turquoise-dark hover:bg-miro-turquoise-light dark:text-miro-turquoise dark:hover:bg-slate-800'
          }`}
        >
          <span aria-hidden="true">ⓘ</span>
        </button>
      )}
      <p className="text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {alert && <span aria-hidden="true">⚠ </span>}
        {value}
      </p>
      {hint && (
        <p className="max-w-48 truncate text-xs text-slate-500 dark:text-slate-400" title={hint}>
          {hint}
        </p>
      )}
    </div>
  )
}
