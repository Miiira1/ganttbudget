import { InfoTip } from './help/HelpTip'

/** Dlaždice ukazatele dashboardu (Náklady, Vytížení): popisek, hodnota, drobná poznámka; červený okraj = překročení. */
export function Kpi({
  label,
  value,
  hint,
  alert = false,
  help,
}: {
  label: string
  value: string
  hint?: string
  alert?: boolean
  /** Tlačítko ⓘ s vysvětlením pojmu (U-03): název, vysvětlení a případně vzorec. */
  help?: { title: string; text: string; extra?: string }
}) {
  return (
    <div
      className={`relative min-w-36 rounded-md border px-3 py-1.5 ${help ? 'pr-8' : ''} ${
        alert ? 'border-l-4 border-red-600 bg-red-50 dark:border-red-400 dark:bg-red-950/40' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      <p className="text-xs text-slate-600 dark:text-slate-400">{label}</p>
      {help && <InfoTip title={help.title} text={help.text} extra={help.extra} className="absolute right-1.5 top-1.5" />}
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
