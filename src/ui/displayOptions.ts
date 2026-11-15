/**
 * Volby zobrazení plánu, které si pamatuje prohlížeč (neukládají se do projektu, nejdou do Zpět).
 * Zatím: zvýraznění kritické cesty (fáze 6c).
 */
import { create } from 'zustand'
import { loadPreference, savePreference } from './preferences'

interface DisplayOptions {
  /** Zvýraznit kritickou cestu (červené úsečky a vazby, pruh rezervy). */
  showCritical: boolean
  toggleCritical: () => void
}

export const useDisplayOptions = create<DisplayOptions>((set) => ({
  showCritical: loadPreference('showCritical') === 'true',
  toggleCritical: () =>
    set((s) => {
      savePreference('showCritical', String(!s.showCritical))
      return { showCritical: !s.showCritical }
    }),
}))
