/**
 * Mobilní nebo plná verze: úzký displej (pod 768 px) sleduje media query, volbu „Plná verze“
 * si pamatuje prohlížeč (preferences, klíč „layout“).
 */
import { useState, useSyncExternalStore } from 'react'
import { loadPreference, savePreference } from '../preferences'
import { effectiveLayout, type LayoutPreference } from './layout'

const NARROW_QUERY = '(max-width: 767px)'

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
