/**
 * Nepřítomnosti pracovníka (fáze 6c, K-05): dovolená, nemoc, školení… jako rozsahy od–do.
 * Ovlivní jen vytížení a varování – termíny činností se samy nemění.
 * Každé přidání / smazání je jeden krok Zpět.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatIsoDate } from '../../i18n/format'
import { absenceWorkingDays } from '../../model/catalogs'
import { isValidIsoDate } from '../../model/dates'
import type { Absence } from '../../model/schema'
import { projectStore, useProject } from '../../store/useProject'

const fieldClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-slate-600 dark:bg-slate-800'

export function AbsenceDialog({ workerId, onClose }: { workerId: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const worker = useProject((s) => s.project.workers.find((w) => w.id === workerId))
  const calendar = useProject((s) => s.project.calendar)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (workerId) {
      setFrom('')
      setTo('')
      setNote('')
      setError(null)
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) dialog.close()
  }, [workerId])

  const absences = worker?.absences ?? []
  const save = (next: Absence[]) => projectStore.getState().updateCatalogItem('workers', workerId as string, { absences: next.length > 0 ? next : undefined })

  function add(event: FormEvent) {
    event.preventDefault()
    const end = to === '' ? from : to
    if (!isValidIsoDate(from) || !isValidIsoDate(end)) return setError(t('absence.error.dates'))
    if (end < from) return setError(t('absence.error.order'))
    const trimmed = note.trim().slice(0, 200)
    const entry: Absence = { start: from, end, ...(trimmed ? { note: trimmed } : {}) }
    save([...absences, entry].sort((a, b) => a.start.localeCompare(b.start)))
    setFrom('')
    setTo('')
    setNote('')
    setError(null)
  }

  const date = (iso: string) => formatIsoDate(iso, i18n.language)
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      {worker && (
        <div className="p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {t('absence.title', { name: worker.name })}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('absence.intro')}</p>

          <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {t('absence.from')}
              <input type="date" className={fieldClass} value={from} onChange={(e) => setFrom(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('absence.to')}
              <input type="date" className={fieldClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
              {t('absence.note')}
              <input type="text" className={fieldClass} value={note} maxLength={200} placeholder={t('absence.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button type="submit" className="btn-primary">
              <span aria-hidden="true">＋</span> {t('absence.add')}
            </button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          {absences.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t('absence.empty')}</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200 text-sm dark:divide-slate-700">
              {absences.map((a, i) => (
                <li key={`${a.start}-${a.end}-${i}`} className="flex items-center gap-3 py-1.5">
                  <span className="tabular-nums">{a.start === a.end ? date(a.start) : t('absence.range', { from: date(a.start), to: date(a.end) })}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {t('absence.workingDays', { count: absenceWorkingDays({ absences: [a] }, calendar) })}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{a.note}</span>
                  <button
                    type="button"
                    onClick={() => save(absences.filter((_, j) => j !== i))}
                    aria-label={t('absence.delete', { range: t('absence.range', { from: date(a.start), to: date(a.end) }) })}
                    className="rounded px-1.5 text-slate-400 hover:bg-red-100 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950 dark:hover:text-red-300"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('absence.undo')}</p>
          <div className="mt-5 flex justify-end">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('absence.close')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
