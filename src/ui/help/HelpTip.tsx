/**
 * Tlačítko ⓘ s krátkým vysvětlením pojmu (U-03, fáze 10).
 *
 * Bublina používá vestavěný „popover“ prohlížeče: leží nad vším ostatním (i nad dialogy
 * a tabulkami, které by ji jinak ořízly), zavře se klávesou Esc nebo kliknutím jinam.
 * Poloha se spočítá podle tlačítka při otevření; při posouvání stránky se bublina zavře.
 * Texty se vykreslují jako obyčejný text, nikdy jako HTML.
 */
import { useEffect, useId, useRef, type ToggleEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { GlossaryTerm } from './glossary'

const MARGIN = 8
const WIDTH = 320

export function InfoTip({ title, text, extra, className = '' }: { title: string; text: string; extra?: string; className?: string }) {
  const { t } = useTranslation()
  const id = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(false)

  // Posouvání stránky nebo tabulky by bublinu odtrhlo od tlačítka – raději ji zavřít.
  useEffect(() => {
    const onScroll = (event: Event) => {
      if (!openRef.current) return
      // Posouvání uvnitř bubliny (dlouhý text) ji zavírat nemá. Při změně velikosti okna je cílem okno, ne prvek.
      if (event.target instanceof Node && popRef.current?.contains(event.target)) return
      popRef.current?.hidePopover()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // Poloha se nastaví těsně před zobrazením (žádné probliknutí jinde) a po zobrazení se upřesní,
  // až je známa výška bublinky.
  function onToggle(event: ToggleEvent<HTMLDivElement>) {
    openRef.current = event.newState === 'open'
    const button = buttonRef.current
    const pop = popRef.current
    if (!openRef.current || !button || !pop) return
    // Pod tlačítko, zarovnat k jeho levému okraji; nevylézt z okna. Když se dole nevejde, nad tlačítko.
    const rect = button.getBoundingClientRect()
    const width = Math.min(WIDTH, window.innerWidth - 2 * MARGIN)
    const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - width - MARGIN))
    const height = pop.offsetHeight
    const below = rect.bottom + 4
    const top = below + height > window.innerHeight - MARGIN ? Math.max(MARGIN, rect.top - height - 4) : below
    pop.style.left = `${left}px`
    pop.style.top = `${top}px`
    pop.style.width = `${width}px`
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={id}
        aria-label={t('help.explain', { term: title })}
        title={t('help.explain', { term: title })}
        // Kliknutí nemá spustit akci rodiče (výběr řádku, třídění…).
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-normal normal-case leading-none tracking-normal text-miro-turquoise-dark hover:bg-miro-turquoise-light focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:text-miro-turquoise dark:hover:bg-slate-700 ${className}`}
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      <div
        ref={popRef}
        id={id}
        popover="auto"
        role="note"
        aria-label={title}
        onBeforeToggle={onToggle}
        onToggle={onToggle}
        className="fixed m-0 max-h-[60vh] overflow-y-auto rounded-md border border-l-4 border-slate-300 border-l-miro-turquoise-dark bg-white p-3 text-left text-sm font-normal normal-case leading-snug tracking-normal text-slate-800 shadow-lg dark:border-slate-600 dark:border-l-miro-turquoise dark:bg-slate-800 dark:text-slate-100"
        style={{ inset: 'auto' }}
      >
        <p className="font-semibold">{title}</p>
        <p className="mt-1 whitespace-normal">{text}</p>
        {extra && <p className="mt-1.5 whitespace-normal text-slate-600 dark:text-slate-400">{extra}</p>}
      </div>
    </>
  )
}

/** ⓘ s pojmem ze slovníčku (glossary.terms.*). */
export function HelpTip({ term, className }: { term: GlossaryTerm; className?: string }) {
  const { t } = useTranslation()
  return <InfoTip title={t(`glossary.terms.${term}.name`)} text={t(`glossary.terms.${term}.text`)} className={className} />
}
