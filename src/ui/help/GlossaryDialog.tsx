/**
 * Okno „Slovníček pojmů“ (U-03, fáze 10): všechny pojmy aplikace na jednom místě, s hledáním.
 * Otevírá se tlačítkem „📖 Slovníček“ v liště. Texty jsou v překladech (glossary.*, tracking.terms.*).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EV_TERMS, GLOSSARY_SECTIONS } from './glossary'

type Entry = { key: string; name: string; text: string; extra?: string }

/** Porovnání bez ohledu na velikost písmen a diakritiku („rezerva“ najde i „REZERVA“, „rezerv“). */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function GlossaryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const searchId = useId()
  const [query, setQuery] = useState('')

  // Nativní dialog prohlížeče: umí Esc a drží fokus uvnitř (stejně jako Zkratky).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setQuery('')
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const sections = useMemo(() => {
    const all: { id: string; entries: Entry[] }[] = [
      ...GLOSSARY_SECTIONS.map((s) => ({
        id: s.id,
        entries: s.terms.map((term) => ({ key: term, name: t(`glossary.terms.${term}.name`), text: t(`glossary.terms.${term}.text`) })),
      })),
      {
        id: 'ev',
        entries: EV_TERMS.map((term) => ({
          key: term,
          name: t(`tracking.terms.${term}.name`),
          text: t(`tracking.terms.${term}.text`),
          extra: t(`tracking.terms.${term}.formula`),
        })),
      },
    ]
    const q = normalize(query.trim())
    if (!q) return all
    return all
      .map((s) => ({ ...s, entries: s.entries.filter((e) => normalize(`${e.name} ${e.text}`).includes(q)) }))
      .filter((s) => s.entries.length > 0)
  }, [t, query])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-5">
        {/* Nadpis s ✕ zůstává nahoře i při posouvání – na telefonu (bez Esc) jde okno zavřít kdykoli. */}
        <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 pb-2 pt-5 dark:border-slate-700 dark:bg-slate-900">
          <h2 id={titleId} className="text-lg font-semibold">
            {t('glossary.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('glossary.close')}
            className="rounded px-2 py-0.5 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('glossary.intro')}</p>

        <label htmlFor={searchId} className="mt-4 block text-sm font-medium">
          {t('glossary.search')}
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('glossary.searchPlaceholder')}
          maxLength={100}
          className="field-select mt-1 w-full"
        />

        {sections.length === 0 && <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{t('glossary.noMatch', { query: query.trim() })}</p>}
        {sections.map((section) => (
          <section key={section.id} className="mt-5">
            <h3 className="border-b border-slate-200 pb-1 font-semibold dark:border-slate-700">{t(`glossary.sections.${section.id}`)}</h3>
            <dl className="mt-2 space-y-2.5 text-sm">
              {section.entries.map((entry) => (
                <div key={entry.key}>
                  <dt className="font-semibold">{entry.name}</dt>
                  <dd className="mt-0.5">{entry.text}</dd>
                  {entry.extra && <dd className="mt-0.5 text-slate-600 dark:text-slate-400">{entry.extra}</dd>}
                </div>
              ))}
            </dl>
          </section>
        ))}

        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-primary" onClick={onClose}>
            {t('glossary.close')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
