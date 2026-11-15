/**
 * Dialog „Kalendář projektu“ (K-01 až K-03): začátek projektu, pracovní dny v týdnu,
 * české svátky (zapnout/vypnout, jednotlivé nepočítat) a vlastní volné dny / odstávky.
 * Každá změna se hned projeví v termínech a jde vrátit přes Zpět (Ctrl+Z).
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { czechHolidays } from '../engine/calendar'
import { formatIsoDate } from '../i18n/format'
import { localeFor } from '../i18n/languages'
import { isValidIsoDate } from '../model/dates'
import { projectStore, useProject, useSchedule } from '../store/useProject'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

/** Název dne v týdnu podle jazyka (1 = pondělí). 1. 1. 2024 bylo pondělí. */
function weekdayName(isoWeekday: number, language: string): string {
  const date = new Date(Date.UTC(2024, 0, isoWeekday))
  return new Intl.DateTimeFormat(localeFor(language), { weekday: 'long', timeZone: 'UTC' }).format(date)
}

const fieldClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-slate-600 dark:bg-slate-800'
const sectionClass = 'mt-5 border-t border-slate-200 pt-4 dark:border-slate-700'

export function CalendarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const project = useProject((s) => s.project)
  const { projectFinish } = useSchedule()
  const { updateCalendar, setProjectStart } = projectStore.getState()
  const calendar = project.calendar
  const ids = { title: useId(), start: useId(), name: useId(), from: useId(), to: useId() }

  // Otevření/zavření nativního dialogu prohlížeče (umí Esc a drží fokus uvnitř).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // --- Svátky pro roky, kterých se projekt týká ---
  const fromYear = Number(project.startDate.slice(0, 4))
  const toYear = Math.max(fromYear, Number((projectFinish ?? project.startDate).slice(0, 4)))
  const holidays = []
  for (let year = fromYear; year <= Math.min(toYear, fromYear + 9); year++) holidays.push(...czechHolidays(year))
  const removed = new Set(calendar.removedHolidays)

  function toggleHoliday(date: string, counted: boolean) {
    const next = counted ? calendar.removedHolidays.filter((d) => d !== date) : [...calendar.removedHolidays, date].sort()
    updateCalendar({ removedHolidays: next })
  }

  function toggleWeekday(day: number, working: boolean) {
    const next = working ? [...calendar.workingWeekdays, day].sort() : calendar.workingWeekdays.filter((d) => d !== day)
    if (next.length === 0) return // aspoň jeden pracovní den (pole je pak zakázané)
    updateCalendar({ workingWeekdays: next })
  }

  // --- Přidání vlastního volna ---
  const [name, setName] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function addCustom(event: FormEvent) {
    event.preventDefault()
    const end = to || from
    if (!isValidIsoDate(from) || !isValidIsoDate(end)) return setFormError(t('calendar.customMissingDates'))
    if (end < from) return setFormError(t('calendar.customEndBeforeStart'))
    const range = { start: from, end, name: name.trim().slice(0, 200) || t('calendar.customDefaultName') }
    updateCalendar({
      customHolidays: [...calendar.customHolidays, range].sort((a, b) => a.start.localeCompare(b.start)),
    })
    setName('')
    setFrom('')
    setTo('')
    setFormError(null)
  }

  const fmt = (date: string) => formatIsoDate(date, i18n.language)

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={ids.title}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 id={ids.title} className="text-lg font-semibold">
            {t('calendar.title')}
          </h2>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('calendar.close')}
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('calendar.intro')}</p>

        {/* Začátek projektu */}
        <div className="mt-4">
          <label htmlFor={ids.start} className="block text-sm font-medium">
            {t('calendar.projectStart')}
          </label>
          <input
            id={ids.start}
            type="date"
            className={`${fieldClass} mt-1`}
            value={project.startDate}
            onChange={(e) => {
              if (isValidIsoDate(e.target.value)) setProjectStart(e.target.value)
            }}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('calendar.projectStartHint')}</p>
        </div>

        {/* Pracovní dny v týdnu */}
        <fieldset className={sectionClass}>
          <legend className="text-sm font-medium">{t('calendar.workingDays')}</legend>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {WEEKDAYS.map((day) => {
              const checked = calendar.workingWeekdays.includes(day)
              const onlyOne = checked && calendar.workingWeekdays.length === 1
              return (
                <label key={day} className="flex items-center gap-1.5 text-sm" title={onlyOne ? t('calendar.atLeastOneDay') : undefined}>
                  <input type="checkbox" checked={checked} disabled={onlyOne} onChange={(e) => toggleWeekday(day, e.target.checked)} />
                  {weekdayName(day, i18n.language)}
                </label>
              )
            })}
          </div>
        </fieldset>

        {/* České svátky */}
        <div className={sectionClass}>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={calendar.useCzechHolidays}
              onChange={(e) => updateCalendar({ useCzechHolidays: e.target.checked })}
            />
            {t('calendar.czechHolidays')}
          </label>
          {calendar.useCzechHolidays && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-slate-700 underline decoration-miro-turquoise decoration-2 underline-offset-4 dark:text-slate-200">
                {fromYear === toYear
                  ? t('calendar.holidaysOverviewOne', { year: fromYear })
                  : t('calendar.holidaysOverview', { from: fromYear, to: toYear })}
              </summary>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {holidays.map((h) => (
                  <li key={h.date}>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={!removed.has(h.date)}
                        aria-label={t('calendar.holidayCounted', { name: t(`holiday.${h.key}`), date: fmt(h.date) })}
                        onChange={(e) => toggleHoliday(h.date, e.target.checked)}
                      />
                      <span>
                        <span className="tabular-nums">{fmt(h.date)}</span> – {t(`holiday.${h.key}`)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Vlastní volné dny a odstávky */}
        <div className={sectionClass}>
          <h3 className="text-sm font-medium">{t('calendar.customTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('calendar.customIntro')}</p>
          {calendar.customHolidays.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('calendar.customNone')}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {calendar.customHolidays.map((range, index) => (
                <li key={`${range.start}-${index}`} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1 dark:bg-slate-800">
                  <span>
                    <span className="tabular-nums">
                      {fmt(range.start)}
                      {range.end !== range.start && ` – ${fmt(range.end)}`}
                    </span>
                    {' · '}
                    {range.name}
                  </span>
                  <button
                    type="button"
                    className="rounded px-2 py-0.5 text-slate-500 hover:bg-red-100 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-900/40 dark:hover:text-red-300"
                    aria-label={t('calendar.customRemove', { name: range.name })}
                    onClick={() => updateCalendar({ customHolidays: calendar.customHolidays.filter((_, i) => i !== index) })}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addCustom} className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor={ids.name} className="block text-xs">
                {t('calendar.customName')}
              </label>
              <input
                id={ids.name}
                type="text"
                maxLength={200}
                className={`${fieldClass} w-44`}
                placeholder={t('calendar.customDefaultName')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={ids.from} className="block text-xs">
                {t('calendar.customFrom')}
              </label>
              <input id={ids.from} type="date" className={fieldClass} value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor={ids.to} className="block text-xs">
                {t('calendar.customTo')}
              </label>
              <input id={ids.to} type="date" className={fieldClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary">
              {t('calendar.customAdd')}
            </button>
          </form>
          {formError && (
            <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
              {formError}
            </p>
          )}
        </div>
      </div>
    </dialog>
  )
}
