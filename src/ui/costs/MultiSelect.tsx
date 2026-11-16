/**
 * Filtr s více volbami: tlačítko („Kategorie: vše“ / „Kategorie: 2 z 6“) a pod ním seznam
 * zaškrtávacích políček a volbou „Vybrat vše“. Prázdný výběr = bez omezení (vše);
 * aspoň jedna volba zůstane vždy zaškrtnutá.
 * Zavře se klávesou Esc nebo kliknutím mimo. Bez knihovny.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface MultiOption {
  value: string
  label: string
  /** Čtvereček barvy (třída), shodný s grafem. */
  swatch?: string
}

export function MultiSelect({ label, options, selected, onChange }: { label: string; options: MultiOption[]; selected: ReadonlySet<string>; onChange: (next: Set<string>) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Volby, které už v projektu nejsou (např. smazaná kategorie), se nepočítají.
  const active = options.filter((o) => selected.has(o.value))
  const summary = active.length === 0 || active.length === options.length ? t('costs.filter.all') : t('costs.filter.some', { count: active.length, total: options.length })
  const toggle = (value: string) => {
    // Bez výběru je zaškrtnuté vše – odškrtnutí jedné volby tedy vychází ze všech.
    const next = new Set((active.length === 0 ? options : active).map((o) => o.value))
    if (next.has(value)) next.delete(value)
    else next.add(value)
    if (next.size === 0) return // aspoň jedna volba musí zůstat
    onChange(next.size === options.length ? new Set() : next)
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className={`btn-secondary ${active.length > 0 && active.length < options.length ? 'border-miro-turquoise-dark dark:border-miro-turquoise' : ''}`}
      >
        <span>
          {label}: <span className="font-normal">{summary}</span>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          id={listId}
          role="group"
          aria-label={label}
          className="absolute left-0 top-full z-40 mt-1 max-h-80 w-72 overflow-y-auto rounded-md border border-slate-300 bg-white p-2 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-900"
        >
          <div className="mb-1 flex gap-2 border-b border-slate-200 pb-1 dark:border-slate-700">
            <button type="button" className="rounded px-1.5 py-0.5 text-xs underline decoration-miro-turquoise underline-offset-2 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-slate-800" onClick={() => onChange(new Set())}>
              {t('costs.filter.selectAll')}
            </button>
          </div>
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-miro-turquoise-light/40 dark:hover:bg-slate-800">
              <input type="checkbox" className="accent-[#08708c] dark:accent-[#3bdaff]" checked={active.length === 0 || selected.has(o.value)} onChange={() => toggle(o.value)} />
              {o.swatch && <span aria-hidden="true" className={`inline-block h-2.5 w-3 shrink-0 rounded-sm ${o.swatch}`} />}
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
