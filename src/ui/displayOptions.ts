/**
 * Volby zobrazení plánu, které si pamatuje prohlížeč (neukládají se do projektu, nejdou do Zpět).
 * Zvýraznění kritické cesty (fáze 6c) a stínová úsečka baseline (fáze 9).
 */
import { create } from 'zustand'
import { loadPreference, savePreference } from './preferences'

interface DisplayOptions {
  /** Zvýraznit kritickou cestu (červené úsečky a vazby, pruh rezervy). */
  showCritical: boolean
  toggleCritical: () => void
  /** Ukázat pod úsečkami termíny vybrané baseline (šedá stínová úsečka). */
  showBaseline: boolean
  toggleBaseline: () => void
}

export const useDisplayOptions = create<DisplayOptions>((set) => ({
  showCritical: loadPreference('showCritical') === 'true',
  toggleCritical: () =>
    set((s) => {
      savePreference('showCritical', String(!s.showCritical))
      return { showCritical: !s.showCritical }
    }),
  showBaseline: loadPreference('showBaseline') === 'true',
  toggleBaseline: () =>
    set((s) => {
      savePreference('showBaseline', String(!s.showBaseline))
      return { showBaseline: !s.showBaseline }
    }),
}))
