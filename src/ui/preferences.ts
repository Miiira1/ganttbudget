/**
 * Drobné volby zobrazení, které si pamatuje prohlížeč (poloha oddělovače, zoom grafu).
 * Neukládají se do projektu a nejdou do historie Zpět/Znovu.
 */

const PREFIX = 'ganttbudget.'

/** Načte uložený text; když nic není (nebo prohlížeč ukládání zakázal), vrátí null. */
export function loadPreference(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function savePreference(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {
    // Volba se jen nezapamatuje, aplikace funguje dál.
  }
}

/** Načte číslo v povoleném rozsahu; cokoli jiného (i podvržená hodnota) → výchozí hodnota. */
export function loadNumberPreference(key: string, fallback: number, min: number, max: number): number {
  const saved = loadPreference(key)
  const value = Number(saved)
  return saved !== null && saved.trim() !== '' && Number.isFinite(value) && value >= min && value <= max ? value : fallback
}
