/**
 * Mobilní verze (jen prohlížení) – rozhodnutí bez DOM, s testy.
 * Na displeji užším než 768 px se zobrazí mobilní verze, pokud si uživatel nevybral „Plná verze“.
 */

/** Pohledy dostupné na telefonu (Zdroje a Vytížení jsou velké tabulky jen pro počítač). */
export const MOBILE_VIEWS = ['plan', 'costs', 'tracking', 'analysis', 'mindmap'] as const
export type MobileView = (typeof MOBILE_VIEWS)[number]

/**
 * Mobilní displej: užší než 768 px, nebo nízký (do 500 px) a ovládaný prstem – telefon otočený
 * na šířku (audit U6). Tablet na šířku (768 px a víc na výšku) zůstává v plné verzi.
 */
export const MOBILE_SCREEN_QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)'

export function isMobileScreen(screen: { width: number; height: number; coarse: boolean }): boolean {
  return screen.width <= 767 || (screen.height <= 500 && screen.coarse)
}

/** Volba uživatele: automaticky podle šířky, nebo vždy plná verze. */
export type LayoutPreference = 'auto' | 'full'

export function effectiveLayout(narrow: boolean, preference: LayoutPreference): 'mobile' | 'full' {
  return narrow && preference !== 'full' ? 'mobile' : 'full'
}

/** Pohled, který se na telefonu skutečně ukáže (nedostupný → Plán). */
export function mobileView(view: string): MobileView {
  return MOBILE_VIEWS.find((v) => v === view) ?? 'plan'
}
