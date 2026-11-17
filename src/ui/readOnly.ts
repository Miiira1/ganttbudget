/**
 * Režim jen pro čtení (mobilní verze): pohledy skryjí upravovací prvky a nic nezapíšou do projektu.
 * Mobilní obal (MobileShell) obalí obsah ReadOnlyContext.Provider s hodnotou true.
 */
import { createContext, useContext } from 'react'

export const ReadOnlyContext = createContext(false)

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext)
}
