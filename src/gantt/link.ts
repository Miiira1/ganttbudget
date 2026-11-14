/**
 * Kreslení vazby tažením v grafu (G-03) – čistá funkce, testy v link.test.ts.
 *
 * Uživatel táhne z kolečka na začátku nebo konci úsečky na jinou úsečku. Kam míří:
 * levá polovina cíle = do začátku, pravá polovina = do konce (u milníku strana od středu).
 * Typ vazby plyne z toho, odkud a kam:
 *   konec → začátek = FS, začátek → začátek = SS, konec → konec = FF, začátek → konec = SF.
 */
import type { DependencyType } from '../model/schema'
import type { Bar } from './geometry'

export type LinkAnchor = 'start' | 'end'

const TYPES: Record<LinkAnchor, Record<LinkAnchor, DependencyType>> = {
  end: { start: 'FS', end: 'FF' },
  start: { start: 'SS', end: 'SF' },
}

/** Do kterého konce cílové úsečky vazba vede (podle polohy myši) a jaký typ z toho vznikne. */
export function linkTarget(from: LinkAnchor, target: Bar, pointerX: number): { anchor: LinkAnchor; type: DependencyType } {
  const middle = (target.xStart + target.xEnd) / 2
  const anchor: LinkAnchor = pointerX < middle ? 'start' : 'end'
  return { anchor, type: TYPES[from][anchor] }
}
