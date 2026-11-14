/**
 * Světlý / tmavý režim.
 * Uživatel volí "podle systému", "světlý" nebo "tmavý"; volba se pamatuje v prohlížeči.
 */

export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark']

const STORAGE_KEY = 'ganttbudget.theme'

export function loadThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'system' || saved === 'light' || saved === 'dark') return saved
  } catch {
    // Prohlížeč může ukládání zakázat (anonymní okno) – pak platí výchozí volba.
  }
  return 'system'
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Volba se jen nezapamatuje, aplikace funguje dál.
  }
}

const darkQuery = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: dark)')

/** Nastaví (nebo zruší) třídu "dark" na prvku <html>. */
export function applyTheme(preference: ThemePreference): void {
  const dark = preference === 'dark' || (preference === 'system' && darkQuery().matches)
  document.documentElement.classList.toggle('dark', dark)
}

/** Při volbě "podle systému" sleduje změnu nastavení systému. Vrací funkci pro ukončení sledování. */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = darkQuery()
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
