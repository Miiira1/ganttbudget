/**
 * Malá rozbalovací menu v záhlaví (brand 2.0 – přehlednost rozhraní):
 *  - **Nápověda**: Zkratky, Slovníček, Vzorový projekt, Průvodce novým projektem,
 *  - **Zobrazení** (⚙): jazyk a vzhled.
 * Ovládání jako menu Soubor: šipky ↑ / ↓, Home / End, Esc zavře a vrátí fokus na tlačítko;
 * kliknutí mimo menu ho zavře.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const itemClass =
  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-100 focus:bg-miro-turquoise-light/50 focus:outline-none dark:hover:bg-slate-700 dark:focus:bg-slate-700'
const panelClass = 'absolute right-0 z-30 mt-1 min-w-56 whitespace-nowrap rounded-md border border-slate-300 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800'

/** Otevřené / zavřené menu: zavře se klepnutím mimo nebo klávesou Esc. */
export function useDropdown() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement & HTMLUListElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (target: EventTarget | null) =>
      target instanceof Node && !panelRef.current?.contains(target) && !buttonRef.current?.contains(target)
    const onPointerDown = (event: PointerEvent) => {
      if (outside(event.target)) setOpen(false)
    }
    // Fokus odešel z menu (např. klávesou Tab) → menu se zavře (audit U21).
    const onFocusIn = (event: FocusEvent) => {
      if (outside(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [open])
  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }
  return { open, setOpen, buttonRef, panelRef, close }
}

export interface HelpMenuItem {
  id: string
  label: string
  icon?: ReactNode
  onSelect: () => void
  shortcut?: string
}

/** Menu Nápověda; s `label` / `button` jde použít i jako jiné menu (např. mobilní ⋯). */
export function HelpMenu({ items, label, button, title }: { items: HelpMenuItem[]; label?: string; button?: ReactNode; title?: string }) {
  const { t } = useTranslation()
  const menuLabel = label ?? t('toolbar.help')
  const menuId = useId()
  const { open, setOpen, buttonRef, panelRef, close } = useDropdown()

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus()
  }, [open, panelRef])

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const list = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]')]
    const index = list.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown') list[(index + 1) % list.length]?.focus()
    else if (event.key === 'ArrowUp') list[(index - 1 + list.length) % list.length]?.focus()
    else if (event.key === 'Home') list[0]?.focus()
    else if (event.key === 'End') list.at(-1)?.focus()
    else if (event.key === 'Escape') close()
    else return
    event.preventDefault()
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="btn-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={button ? menuLabel : undefined}
        title={title ?? t('toolbar.helpHint')}
        onClick={() => setOpen((o) => !o)}
      >
        {button ?? (
          <>
            <span aria-hidden="true">?</span> {menuLabel} <span aria-hidden="true">▾</span>
          </>
        )}
      </button>
      {open && (
        <ul ref={panelRef} id={menuId} role="menu" aria-label={menuLabel} onKeyDown={onKeyDown} className={panelClass}>
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  close()
                  item.onSelect()
                }}
              >
                <span aria-hidden="true" className="w-5 text-center">
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.shortcut && <kbd className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.shortcut}</kbd>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** ⚙ Zobrazení: panel s volbou jazyka a vzhledu (formulářová pole, ne položky menu). */
export function DisplaySettings({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const panelId = useId()
  const { open, setOpen, buttonRef, panelRef, close } = useDropdown()

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLSelectElement>('select')?.focus()
  }, [open, panelRef])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="btn-secondary px-2"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('toolbar.display')}
        title={t('toolbar.displayHint')}
        onClick={() => setOpen((o) => !o)}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="10" cy="10" r="2.6" />
          <path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label={t('toolbar.display')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              close()
            }
          }}
          className={`${panelClass} flex flex-col gap-3 px-3 py-3`}
        >
          {children}
        </div>
      )}
    </div>
  )
}
