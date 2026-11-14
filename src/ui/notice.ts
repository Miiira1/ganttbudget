/**
 * Upozornění pro uživatele (např. chybný zápis předchůdců) zobrazené v liště nahoře.
 * Není součástí projektu, proto nejde do historie Zpět / Znovu.
 */
import { create } from 'zustand'

interface NoticeState {
  message: string | null
  show: (message: string) => void
  clear: () => void
}

export const useNotice = create<NoticeState>()((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}))

export const showNotice = (message: string): void => useNotice.getState().show(message)
