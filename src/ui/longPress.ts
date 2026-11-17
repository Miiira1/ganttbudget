/**
 * Dlouhý stisk na dotykovém displeji (fáze 13c, G-09): na tabletu není Ctrl, a tak
 * podržení prstu ½ s na řádku nebo úsečce přidá / odebere položku z výběru (jako Ctrl+klik).
 * Pohyb prstu o víc než pár bodů = tažení, dlouhý stisk se zruší. Bez DOM – testuje se v Node.
 */

/** Jak dlouho podržet prst (ms). */
export const LONG_PRESS_MS = 500
/** O kolik bodů se prst smí pohnout, aby to byl pořád „stisk“, ne tažení. */
export const LONG_PRESS_TOLERANCE = 8
/** Jak dlouho po dlouhém stisku se ignoruje následné „kliknutí“ (ms). */
const CLICK_GUARD_MS = 800

let lastFiredAt = -Infinity

/** Prst nebo pero (u myši se používá Ctrl+klik). */
export function isTouchLike(event: { pointerType: string }): boolean {
  return event.pointerType === 'touch' || event.pointerType === 'pen'
}

/** Proběhl právě dlouhý stisk? Pak se kliknutí, které po něm prohlížeč pošle, nemá brát jako výběr jednoho řádku. */
export function recentLongPress(): boolean {
  return Date.now() - lastFiredAt < CLICK_GUARD_MS
}

export interface LongPressWatch {
  /** Prst se pohnul na (x, y) – při velkém pohybu se dlouhý stisk zruší. */
  move: (x: number, y: number) => void
  /** Prst se zvedl nebo tažení začalo – dlouhý stisk už nenastane. */
  cancel: () => void
}

/** Začne hlídat dlouhý stisk od bodu (x, y); po LONG_PRESS_MS bez pohybu zavolá `onLongPress`. */
export function watchLongPress(x: number, y: number, onLongPress: () => void): LongPressWatch {
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    timer = null
    lastFiredAt = Date.now()
    onLongPress()
  }, LONG_PRESS_MS)
  const cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  return {
    move: (nx, ny) => {
      if (Math.abs(nx - x) > LONG_PRESS_TOLERANCE || Math.abs(ny - y) > LONG_PRESS_TOLERANCE) cancel()
    },
    cancel,
  }
}
