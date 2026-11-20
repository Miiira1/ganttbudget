/**
 * Mobilní nebo plná verze: úzký displej (pod 768 px) sleduje media query, volbu „Plná verze“
 * si pamatuje prohlížeč (preferences, klíč „layout“).
 */
import { useState, useSyncExternalStore } from 'react'
import { loadPreference, savePreference } from '../preferences'
import { effectiveLayout, MOBILE_SCREEN_QUERY, type LayoutPreference } from './layout'

// Úzký displej, nebo telefon na šířku (audit U6) – viz layout.ts.
const NARROW_QUERY = MOBILE_SCREEN_QUERY

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const media = window.matchMedia(NARROW_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const isNarrow = () => typeof window !== 'undefined' && !!window.matchMedia?.(NARROW_QUERY).matches

export function useLayoutMode() {
  const narrow = useSyncExternalStore(subscribe, isNarrow, () => false)
  const [preference, setPreferenceState] = useState<LayoutPreference>(() => (loadPreference('layout') === 'full' ? 'full' : 'auto'))
  const setPreference = (next: LayoutPreference) => {
    setPreferenceState(next)
    savePreference('layout', next)
  }
  return { narrow, mobile: effectiveLayout(narrow, preference) === 'mobile', setPreference }
}
