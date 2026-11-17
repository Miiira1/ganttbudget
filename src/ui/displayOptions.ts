/**
 * Volby zobrazení plánu, které si pamatuje prohlížeč (neukládají se do projektu, nejdou do Zpět).
 * Zvýraznění kritické cesty (fáze 6c), stínová úsečka baseline (fáze 9) a popisky vedle úseček.
 */
import { create } from 'zustand'
import { parseBarLabelFields, serializeBarLabelFields, type BarLabelField } from '../gantt/barLabels'
import { loadPreference, savePreference } from './preferences'

interface DisplayOptions {
  /** Zvýraznit kritickou cestu (červené úsečky a vazby, pruh rezervy). */
  showCritical: boolean
  toggleCritical: () => void
  /** Ukázat pod úsečkami termíny vybrané baseline (šedá stínová úsečka). */
  showBaseline: boolean
  toggleBaseline: () => void
  /** Údaje v popisku vedle úseček (prázdné = bez popisků). */
  barLabels: BarLabelField[]
  setBarLabels: (fields: BarLabelField[]) => void
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
  barLabels: parseBarLabelFields(loadPreference('barLabels')),
  setBarLabels: (fields) => {
    const value = serializeBarLabelFields(fields)
    savePreference('barLabels', value)
    set({ barLabels: parseBarLabelFields(value) })
  },
}))
