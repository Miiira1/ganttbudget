/**
 * Je hlavní ukazatel „hrubý“ (prst na tabletu / telefonu)? Pak se úchyty v grafu zvětší (G-09).
 * Sleduje změnu (např. připojení myši k tabletu).
 */
import { useSyncExternalStore } from 'react'

const QUERY = '(pointer: coarse)'

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const getSnapshot = () => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches

export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
