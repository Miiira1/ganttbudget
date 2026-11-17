/**
 * Nastavení pohledu (přepínače, filtry): v mobilní verzi sbalené pod souhrnem, aby byla hned vidět
 * čísla a grafy; v plné verzi beze změny.
 */
import type { ReactNode } from 'react'

export function SettingsWrap({ collapsible, summary, children }: { collapsible: boolean; summary: string; children: ReactNode }) {
  if (!collapsible) return <>{children}</>
  return (
    <details className="border-b border-slate-200 dark:border-slate-700">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">{summary}</summary>
      {children}
    </details>
  )
}
