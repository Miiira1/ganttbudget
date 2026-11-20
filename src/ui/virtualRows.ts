/**
 * Kreslit jen viditelné řádky (audit R3, krok 7 plánu oprav).
 *
 * Při 2 000 činnostech měla tabulka a Gantt ~107 000 prvků stránky a přepnutí na Plán trvalo
 * přes 2 s, přitom na obrazovce je vidět ~25 řádků. U velkého plánu se proto kreslí jen řádky
 * v okně a rezerva nad a pod nimi; zbytek výšky vyplní prázdné místo, takže posuvník se chová
 * stejně. Plán do 300 řádků se kreslí celý jako dřív.
 *
 * Tabulka i graf jsou v posuvných panelech, které se posouvají spolu (SplitView) – každá část
 * si rozsah spočítá ze svého panelu, výsledek je stejný.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { ROW_HEIGHT } from '../gantt/geometry'

/** Od kolika viditelných řádků se kreslí jen část. */
export const VIRTUALIZE_FROM = 300
/** Kolik řádků navíc nad a pod oknem (plynulé posouvání, Tab na další řádek). */
export const OVERSCAN = 20
/** Hranice rozsahu se zaokrouhlují na skupiny, aby se při posunu nepřekreslovalo po každém řádku. */
const STEP = 10
/** Odhad výšky okna, dokud ji prohlížeč nezměří. */
const FALLBACK_HEIGHT = 1200

export interface RowRange {
  /** První kreslený řádek (včetně). */
  first: number
  /** Za posledním kresleným řádkem (bez). */
  last: number
}

/** Které řádky kreslit pro daný posun panelu (scrollTop) a jeho výšku. Čistá funkce. */
export function visibleRange(scrollTop: number, viewportHeight: number, count: number, rowHeight = ROW_HEIGHT): RowRange {
  if (count <= VIRTUALIZE_FROM) return { first: 0, last: count }
  const height = viewportHeight > 0 ? viewportHeight : FALLBACK_HEIGHT
  const top = Math.max(0, scrollTop)
  const first = Math.max(0, Math.floor((Math.floor(top / rowHeight) - OVERSCAN) / STEP) * STEP)
  const last = Math.min(count, Math.ceil((Math.ceil((top + height) / rowHeight) + OVERSCAN) / STEP) * STEP)
  return { first, last }
}

/**
 * Rozsah řádků pro komponentu uvnitř posuvného panelu. `anchorRef` = prvek, jehož přímý rodič
 * se posouvá (tabulka / obal grafu). Překreslí jen tehdy, když se rozsah změní.
 */
export function useVisibleRange(count: number, anchorRef: RefObject<Element | null>): RowRange {
  const metrics = useRef({ top: 0, height: 0 })
  const countRef = useRef(count)
  countRef.current = count
  const shown = useRef<RowRange | null>(null)
  const [, rerender] = useState(0)
  const hasRows = count > 0

  useLayoutEffect(() => {
    const scroller = anchorRef.current?.parentElement
    if (!scroller) return
    const update = () => {
      metrics.current = { top: scroller.scrollTop, height: scroller.clientHeight }
      const next = visibleRange(metrics.current.top, metrics.current.height, countRef.current)
      const prev = shown.current
      if (!prev || prev.first !== next.first || prev.last !== next.last) rerender((n) => n + 1)
    }
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    const resize = new ResizeObserver(update)
    resize.observe(scroller)
    return () => {
      scroller.removeEventListener('scroll', update)
      resize.disconnect()
    }
  }, [anchorRef, hasRows])

  const range = visibleRange(metrics.current.top, metrics.current.height, count)
  shown.current = range
  return range
}

/**
 * Posune panel plánu tak, aby řádek s daným pořadím byl uprostřed – u velkého plánu totiž řádek
 * mimo okno vůbec není vykreslený a nejde ho najít ani zaměřit. Posun panelu tabulky se sám
 * přenese i do grafu (SplitView).
 */
export function scrollRowIntoView(index: number): void {
  const table = document.querySelector('table[data-plan-table]')
  const scroller = table?.parentElement
  if (!scroller || index < 0) return
  const header = table.querySelector('thead')?.getBoundingClientRect().height ?? 0
  const rowTop = header + index * ROW_HEIGHT
  if (rowTop < scroller.scrollTop + header || rowTop + ROW_HEIGHT > scroller.scrollTop + scroller.clientHeight) {
    scroller.scrollTop = Math.max(0, rowTop - scroller.clientHeight / 2)
  }
}
