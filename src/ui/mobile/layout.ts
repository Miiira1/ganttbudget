/**
 * Mobilní verze (jen prohlížení) – rozhodnutí bez DOM, s testy.
 * Na displeji užším než 768 px se zobrazí mobilní verze, pokud si uživatel nevybral „Plná verze“.
 */

/** Pohledy dostupné na telefonu (Zdroje a Vytížení jsou velké tabulky jen pro počítač). */
export const MOBILE_VIEWS = ['plan', 'costs', 'tracking', 'analysis', 'mindmap'] as const
export type MobileView = (typeof MOBILE_VIEWS)[number]

/** Volba uživatele: automaticky podle šířky, nebo vždy plná verze. */
export type LayoutPreference = 'auto' | 'full'

export function effectiveLayout(narrow: boolean, preference: LayoutPreference): 'mobile' | 'full' {
  return narrow && preference !== 'full' ? 'mobile' : 'full'
}

/** Pohled, který se na telefonu skutečně ukáže (nedostupný → Plán). */
export function mobileView(view: string): MobileView {
  return MOBILE_VIEWS.find((v) => v === view) ?? 'plan'
}
