/**
 * Je právě tmavý vzhled? Sleduje třídu „dark“ na <html>, kterou nastavuje theme.ts (volba v ⚙
 * i změna nastavení systému). Pro obrázky, které se kreslí mimo CSS – Gantt v mobilu (audit U24).
 */
import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

const isDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

export function useDarkTheme(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => false)
}
