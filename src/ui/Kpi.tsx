/** Dlaždice ukazatele dashboardu (Náklady, Vytížení): popisek, hodnota, drobná poznámka; červený okraj = překročení. */
export function Kpi({ label, value, hint, alert = false }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div
      className={`min-w-36 rounded-md border px-3 py-1.5 ${
        alert ? 'border-l-4 border-red-600 bg-red-50 dark:border-red-400 dark:bg-red-950/40' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <p className="text-xs text-slate-600 dark:text-slate-400">{label}</p>
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
