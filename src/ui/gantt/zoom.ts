/**
 * Zvolené měřítko grafu (Dny / Týdny / Měsíce / Čtvrtletí).
 * Sdílí ho přepínač v liště a graf. Pamatuje si ho prohlížeč, do projektu se neukládá.
 */
import { create } from 'zustand'
import { ZOOMS, type Zoom } from '../../gantt/timeline'
import { loadPreference, savePreference } from '../preferences'

const STORAGE_KEY = 'zoom'
const DEFAULT_ZOOM: Zoom = 'week'

function loadZoom(): Zoom {
  const saved = loadPreference(STORAGE_KEY)
  return ZOOMS.find((z) => z === saved) ?? DEFAULT_ZOOM
}

export const useZoom = create<{ zoom: Zoom; setZoom: (zoom: Zoom) => void }>((set) => ({
  zoom: loadZoom(),
  setZoom: (zoom) => {
    savePreference(STORAGE_KEY, zoom)
    set({ zoom })
  },
}))
