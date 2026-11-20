/**
 * Rozdělené okno (G-01): vlevo tabulka, vpravo graf, mezi nimi posuvný oddělovač.
 *
 * Obě části mají vlastní posuvníky, ale svislý posun se synchronizuje – řádek tabulky
 * je vždy na stejné výšce jako jeho úsečka v grafu. Vodorovné posuvníky jsou zapnuté
 * trvale (overflow-x: scroll), aby obě části měly stejnou výšku viditelné plochy
 * a na konci seznamu se řádky nerozjely.
 *
 * Fáze 8: stejný rozdělovník používá i pohled Analýza (tabulka | graf) – vlastní klíč pro
 * zapamatování poměru, výchozí poměr a bez synchronizace posunu (syncScroll = false).
 * Rozvržení „pod sebou“ (vertical): první část nahoře, druhá dole, oddělovač se táhne svisle.
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { loadNumberPreference, savePreference } from './preferences'

const MIN_RATIO = 0.15
const MAX_RATIO = 0.85
/** O kolik se oddělovač posune jedním stiskem šipky. */
const KEY_STEP = 0.02

const clamp = (ratio: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))

export function SplitView({
  left,
  right,
  storageKey = 'splitRatio',
  defaultRatio = 0.45,
  syncScroll: sync = true,
  label,
  orientation = 'horizontal',
}: {
  left: ReactNode
  right: ReactNode
  /** Klíč, pod kterým si prohlížeč pamatuje poměr. */
  storageKey?: string
  /** Výchozí podíl levé části (0–1). */
  defaultRatio?: number
  /** Synchronizovat svislý posun obou částí (tabulka a Gantt). */
  syncScroll?: boolean
  /** Popis oddělovače pro čtečky a bublinu. */
  label?: { name: string; hint: string }
  /** horizontal = vedle sebe (výchozí), vertical = pod sebou (left nahoře, right dole). */
  orientation?: 'horizontal' | 'vertical'
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(() => loadNumberPreference(storageKey, defaultRatio, MIN_RATIO, MAX_RATIO))
  const dragging = useRef(false)
  const vertical = orientation === 'vertical'

  function changeRatio(next: number) {
    const value = clamp(next)
    setRatio(value)
    savePreference(storageKey, value.toFixed(3))
  }

  // --- Synchronizace svislého posunu ---
  // Kdo právě „vede“ posun; událost scroll druhé části, kterou jsme sami vyvolali, ignorujeme.
  const leader = useRef<HTMLDivElement | null>(null)
  const releaseFrame = useRef(0)
  function syncScroll(source: HTMLDivElement | null, target: HTMLDivElement | null) {
    if (!sync || !source || !target) return
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
    if (!dragging.current || !box) return
    if (vertical) {
      if (box.height > 0) changeRatio((event.clientY - box.top) / box.height)
    } else if (box.width > 0) changeRatio((event.clientX - box.left) / box.width)
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    dragging.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // --- Ovládání klávesnicí (U-06) ---
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      [vertical ? 'ArrowUp' : 'ArrowLeft']: ratio - KEY_STEP,
      [vertical ? 'ArrowDown' : 'ArrowRight']: ratio + KEY_STEP,
      Home: MIN_RATIO,
      End: MAX_RATIO,
    }
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    changeRatio(next)
  }

  // contain: strict (13c – výkon) = změna uvnitř panelu (náhled tažení, nové termíny) nenutí prohlížeč
  // znovu rozvrhnout zbytek stránky; u plánu s 300 činnostmi to zkrátilo krok náhledu zhruba na polovinu.
  const pane = `${sync ? 'min-h-0 overflow-x-scroll overflow-y-auto' : 'min-h-0 overflow-auto'} [contain:strict]`

  return (
    <div ref={containerRef} className={`flex h-full min-h-0 ${vertical ? 'flex-col' : ''}`}>
      <div
        ref={leftRef}
        className={`${pane} shrink-0`}
        style={vertical ? { height: `${ratio * 100}%` } : { width: `${ratio * 100}%` }}
        onScroll={() => syncScroll(leftRef.current, rightRef.current)}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
        aria-label={label?.name ?? t('gantt.splitter')}
        aria-valuemin={Math.round(MIN_RATIO * 100)}
        aria-valuemax={Math.round(MAX_RATIO * 100)}
        aria-valuenow={Math.round(ratio * 100)}
        title={label?.hint ?? t('gantt.splitterHint')}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        // Na dotykovém displeji je aktivní plocha oddělovače ~26 px (neviditelný přesah after:),
        // viditelná čára zůstane tenká (audit U7).
        className={`${vertical ? 'h-1.5 cursor-row-resize pointer-coarse:after:-inset-y-2.5 pointer-coarse:after:inset-x-0' : 'w-1.5 cursor-col-resize pointer-coarse:after:-inset-x-2.5 pointer-coarse:after:inset-y-0'} relative z-10 shrink-0 touch-none pointer-coarse:after:absolute pointer-coarse:after:content-[''] bg-slate-200 hover:bg-miro-turquoise focus:outline-none focus-visible:bg-focus dark:bg-slate-700 dark:hover:bg-miro-turquoise/70`}
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
