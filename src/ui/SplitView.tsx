/**
 * Rozdělené okno (G-01): vlevo tabulka, vpravo graf, mezi nimi posuvný oddělovač.
 *
 * Obě části mají vlastní posuvníky, ale svislý posun se synchronizuje – řádek tabulky
 * je vždy na stejné výšce jako jeho úsečka v grafu. Vodorovné posuvníky jsou zapnuté
 * trvale (overflow-x: scroll), aby obě části měly stejnou výšku viditelné plochy
 * a na konci seznamu se řádky nerozjely.
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { loadNumberPreference, savePreference } from './preferences'

const STORAGE_KEY = 'splitRatio'
const MIN_RATIO = 0.15
const MAX_RATIO = 0.85
const DEFAULT_RATIO = 0.45
/** O kolik se oddělovač posune jedním stiskem šipky. */
const KEY_STEP = 0.02

const clamp = (ratio: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))

export function SplitView({ left, right }: { left: ReactNode; right: ReactNode }) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(() => loadNumberPreference(STORAGE_KEY, DEFAULT_RATIO, MIN_RATIO, MAX_RATIO))
  const dragging = useRef(false)

  function changeRatio(next: number) {
    const value = clamp(next)
    setRatio(value)
    savePreference(STORAGE_KEY, value.toFixed(3))
  }

  // --- Synchronizace svislého posunu ---
  // Kdo právě „vede“ posun; událost scroll druhé části, kterou jsme sami vyvolali, ignorujeme.
  const leader = useRef<HTMLDivElement | null>(null)
  const releaseFrame = useRef(0)
  function syncScroll(source: HTMLDivElement | null, target: HTMLDivElement | null) {
    if (!source || !target) return
    if (leader.current && leader.current !== source) return
    leader.current = source
    if (target.scrollTop !== source.scrollTop) target.scrollTop = source.scrollTop
    cancelAnimationFrame(releaseFrame.current)
    releaseFrame.current = requestAnimationFrame(() => {
      leader.current = null
    })
  }

  // --- Tažení oddělovače myší (i dotykem) ---
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    // Zabrání označování textu při tažení; zaměření (pro šipky) proto nastavíme sami.
    event.preventDefault()
    event.currentTarget.focus()
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const box = containerRef.current?.getBoundingClientRect()
    if (!dragging.current || !box || box.width === 0) return
    changeRatio((event.clientX - box.left) / box.width)
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    dragging.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // --- Ovládání klávesnicí (U-06) ---
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowLeft: ratio - KEY_STEP,
      ArrowRight: ratio + KEY_STEP,
      Home: MIN_RATIO,
      End: MAX_RATIO,
    }
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    changeRatio(next)
  }

  const pane = 'min-h-0 overflow-x-scroll overflow-y-auto'

  return (
    <div ref={containerRef} className="flex h-full min-h-0">
      <div
        ref={leftRef}
        className={`${pane} shrink-0`}
        style={{ width: `${ratio * 100}%` }}
        onScroll={() => syncScroll(leftRef.current, rightRef.current)}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('gantt.splitter')}
        aria-valuemin={Math.round(MIN_RATIO * 100)}
        aria-valuemax={Math.round(MAX_RATIO * 100)}
        aria-valuenow={Math.round(ratio * 100)}
        title={t('gantt.splitterHint')}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        className="w-1.5 shrink-0 cursor-col-resize touch-none bg-slate-200 hover:bg-blue-400 focus:outline-none focus-visible:bg-blue-500 dark:bg-slate-700 dark:hover:bg-blue-500"
      />
      <div
        ref={rightRef}
        className={`${pane} min-w-0 flex-1`}
        onScroll={() => syncScroll(rightRef.current, leftRef.current)}
      >
        {right}
      </div>
    </div>
  )
}
