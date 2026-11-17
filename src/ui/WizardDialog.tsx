/**
 * Okno „Průvodce prvním projektem“ (U-01, fáze 10): pět kroků – název a měna, začátek, kalendář,
 * první fáze, shrnutí. Odpovědi se ověří (model/wizard.ts) a projekt se vytvoří jedním krokem
 * (jde vrátit Ctrl+Z); na neuložené změny se aplikace nejdřív zeptá.
 * Otevírá se z okna Nový projekt a z úvodní obrazovky prázdného plánu. Sám se neotevírá.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatIsoDate } from '../i18n/format'
import { newProject } from '../io/fileActions'
import { nextMonday, todayIso } from '../model/dates'
import { createWizardProject, MAX_WIZARD_PHASES, MAX_WIZARD_SHUTDOWNS, validateWizard, WIZARD_CURRENCIES, type WizardAnswers, type WizardError } from '../model/wizard'
import { weekdayName } from './CalendarDialog'

const STEPS = ['name', 'start', 'calendar', 'phases', 'summary'] as const
type Step = (typeof STEPS)[number]

/** Ke kterému kroku patří která chyba (Další ukáže jen chyby aktuálního kroku). */
const STEP_OF_ERROR: Record<WizardError, Step> = {
  nameMissing: 'name',
  nameTooLong: 'name',
  startInvalid: 'start',
  noWorkingDay: 'calendar',
  shutdownMissingDates: 'calendar',
  shutdownEndBeforeStart: 'calendar',
  tooManyShutdowns: 'calendar',
  tooManyPhases: 'phases',
  phaseNameTooLong: 'phases',
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

export function WizardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const ids = { name: useId(), currency: useId(), currencyHint: useId(), start: useId(), startHint: useId(), errors: useId() }

  const initial = (): WizardAnswers => ({
    name: '',
    currency: 'CZK',
    language: lang,
    startDate: nextMonday(todayIso()),
    workingWeekdays: [1, 2, 3, 4, 5],
    useCzechHolidays: true,
    shutdowns: [],
    phases: [t('wizard.defaultPhases.p1'), t('wizard.defaultPhases.p2'), t('wizard.defaultPhases.p3')],
    addFirstTasks: true,
    firstTaskName: t('wizard.firstTaskName'),
  })
  const [answers, setAnswers] = useState<WizardAnswers>(initial)
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState<WizardError[]>([])
  const step = STEPS[stepIndex]!

  // Nativní dialog: Esc zavře, fokus zůstane uvnitř. Každé otevření začne od začátku.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setAnswers(initial())
      setStepIndex(0)
      setErrors([])
      dialog.showModal()
      // Fokus rovnou do pole Název, ať se dá hned psát (pole už je vidět, nebo bude po překreslení).
      nameRef.current?.focus()
      requestAnimationFrame(() => nameRef.current?.focus())
    }
    if (!open && dialog.open) dialog.close()
    // initial() čte jen překlady a dnešek – stačí je přečíst při otevření.
  }, [open])

  /** Přejít na krok a přesunout fokus na jeho nadpis (čtečka obrazovky ho přečte). */
  function goTo(index: number) {
    setStepIndex(index)
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  const set = (patch: Partial<WizardAnswers>) => {
    setAnswers((a) => ({ ...a, ...patch }))
    setErrors([])
  }

  function goNext(event: FormEvent) {
    event.preventDefault()
    const all = validateWizard(answers)
    if (step === 'summary') {
      if (all.length > 0) {
        // Nemělo by nastat (kroky se ověřují průběžně) – vrátit se ke kroku s chybou.
        goTo(STEPS.indexOf(STEP_OF_ERROR[all[0]!]))
        setErrors(all)
        return
      }
      const project = createWizardProject({ ...answers, language: lang, firstTaskName: t('wizard.firstTaskName') }, () => crypto.randomUUID())
      if (newProject(t, lang, project)) onClose()
      return
    }
    const mine = all.filter((e) => STEP_OF_ERROR[e] === step)
    if (mine.length > 0) {
      setErrors(mine)
      return
    }
    setErrors([])
    goTo(stepIndex + 1)
  }

  function goBack() {
    setErrors([])
    goTo(Math.max(0, stepIndex - 1))
  }

  const phasesClean = answers.phases.map((p) => p.trim()).filter((p) => p !== '')
  const field = 'field-select'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      <form className="p-5" onSubmit={goNext} noValidate>
        <p id={titleId} className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {t('wizard.title')} · {t('wizard.stepOf', { step: stepIndex + 1, total: STEPS.length })}
        </p>
        {/* Ukazatel kroků: hotové tyrkysově, aktuální tmavě, budoucí šedě. */}
        <ol className="mt-2 flex gap-1" aria-hidden="true">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i < stepIndex ? 'bg-miro-turquoise-dark dark:bg-miro-turquoise' : i === stepIndex ? 'bg-miro-graphite dark:bg-miro-paper' : 'bg-slate-200 dark:bg-slate-700'}`}
            />
          ))}
        </ol>
        <h2 ref={headingRef} tabIndex={-1} className="mt-3 text-lg font-semibold focus:outline-none">
          {t(`wizard.steps.${step}`)}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t(`wizard.intro.${step}`)}</p>

        <div className="mt-4 space-y-4 text-sm">
          {step === 'name' && (
            <>
              <div>
                <label htmlFor={ids.name} className="block font-medium">
                  {t('wizard.name')}
                </label>
                <input
                  ref={nameRef}
                  id={ids.name}
                  type="text"
                  value={answers.name}
                  maxLength={250}
                  placeholder={t('wizard.namePlaceholder')}
                  onChange={(e) => set({ name: e.target.value })}
                  aria-invalid={errors.includes('nameMissing') || errors.includes('nameTooLong')}
                  aria-describedby={errors.length > 0 ? ids.errors : undefined}
                  className={`${field} mt-1 w-full`}
                />
              </div>
              <div>
                <label htmlFor={ids.currency} className="block font-medium">
                  {t('wizard.currency')}
                </label>
                <select id={ids.currency} value={answers.currency} onChange={(e) => set({ currency: e.target.value })} aria-describedby={ids.currencyHint} className={`${field} mt-1`}>
                  {WIZARD_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p id={ids.currencyHint} className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {t('wizard.currencyHint')}
                </p>
              </div>
            </>
          )}

          {step === 'start' && (
            <div>
              <label htmlFor={ids.start} className="block font-medium">
                {t('wizard.startDate')}
              </label>
              <input
                id={ids.start}
                type="date"
                value={answers.startDate}
                onChange={(e) => set({ startDate: e.target.value })}
                aria-invalid={errors.includes('startInvalid')}
                aria-describedby={ids.startHint}
                className={`${field} mt-1`}
              />
              <p id={ids.startHint} className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {t('wizard.startHint')}
              </p>
            </div>
          )}

          {step === 'calendar' && (
            <>
              <fieldset>
                <legend className="font-medium">{t('calendar.workingDays')}</legend>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {WEEKDAYS.map((day) => (
                    <label key={day} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={answers.workingWeekdays.includes(day)}
                        onChange={(e) =>
                          set({ workingWeekdays: e.target.checked ? [...answers.workingWeekdays, day].sort((a, b) => a - b) : answers.workingWeekdays.filter((d) => d !== day) })
                        }
                        className="h-4 w-4 accent-miro-turquoise-dark"
                      />
                      {weekdayName(day, lang)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={answers.useCzechHolidays} onChange={(e) => set({ useCzechHolidays: e.target.checked })} className="h-4 w-4 accent-miro-turquoise-dark" />
                {t('calendar.czechHolidays')}
              </label>
              <fieldset>
                <legend className="font-medium">{t('calendar.customTitle')}</legend>
                <p className="text-xs text-slate-600 dark:text-slate-400">{t('calendar.customIntro')}</p>
                {answers.shutdowns.length === 0 && <p className="mt-1 text-slate-600 dark:text-slate-400">{t('calendar.customNone')}</p>}
                <ul className="mt-2 space-y-2">
                  {answers.shutdowns.map((s, i) => {
                    const update = (patch: Partial<typeof s>) => set({ shutdowns: answers.shutdowns.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
                    return (
                      <li key={i} className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col text-xs">
                          {t('calendar.customName')}
                          <input type="text" value={s.name} maxLength={200} onChange={(e) => update({ name: e.target.value })} className={`${field} mt-0.5 w-44`} />
                        </label>
                        <label className="flex flex-col text-xs">
                          {t('calendar.customFrom')}
                          <input type="date" value={s.start} onChange={(e) => update({ start: e.target.value })} className={`${field} mt-0.5`} />
                        </label>
                        <label className="flex flex-col text-xs">
                          {t('calendar.customTo')}
                          <input type="date" value={s.end} onChange={(e) => update({ end: e.target.value })} className={`${field} mt-0.5`} />
                        </label>
                        <button
                          type="button"
                          className="btn-secondary"
                          aria-label={t('calendar.customRemove', { name: s.name || t('calendar.customDefaultName') })}
                          onClick={() => set({ shutdowns: answers.shutdowns.filter((_, j) => j !== i) })}
                        >
                          <span aria-hidden="true">✕</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <button
                  type="button"
                  className="btn-secondary mt-2"
                  disabled={answers.shutdowns.length >= MAX_WIZARD_SHUTDOWNS}
                  onClick={() => set({ shutdowns: [...answers.shutdowns, { start: '', end: '', name: t('calendar.customDefaultName') }] })}
                >
                  <span aria-hidden="true">＋</span> {t('calendar.customAdd')}
                </button>
              </fieldset>
            </>
          )}

          {step === 'phases' && (
            <>
              <ol className="space-y-2">
                {answers.phases.map((phase, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <label className="flex flex-1 items-center gap-2">
                      <span className="w-16 shrink-0 text-slate-600 dark:text-slate-400">{t('wizard.phase', { n: i + 1 })}</span>
                      <input
                        type="text"
                        value={phase}
                        maxLength={250}
                        onChange={(e) => set({ phases: answers.phases.map((p, j) => (j === i ? e.target.value : p)) })}
                        className={`${field} w-full`}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label={t('wizard.removePhase', { n: i + 1 })}
                      onClick={() => set({ phases: answers.phases.filter((_, j) => j !== i) })}
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  </li>
                ))}
              </ol>
              <button type="button" className="btn-secondary" disabled={answers.phases.length >= MAX_WIZARD_PHASES} onClick={() => set({ phases: [...answers.phases, ''] })}>
                <span aria-hidden="true">＋</span> {t('wizard.addPhase')}
              </button>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={answers.addFirstTasks} onChange={(e) => set({ addFirstTasks: e.target.checked })} className="mt-0.5 h-4 w-4 accent-miro-turquoise-dark" />
                <span>
                  {t('wizard.addFirstTasks')}
                  <span className="block text-xs text-slate-600 dark:text-slate-400">{t('wizard.addFirstTasksHint')}</span>
                </span>
              </label>
            </>
          )}

          {step === 'summary' && (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                <dt className="text-slate-600 dark:text-slate-400">{t('wizard.summaryLabels.name')}</dt>
                <dd className="font-medium">{answers.name.trim()}</dd>
                <dt className="text-slate-600 dark:text-slate-400">{t('wizard.summaryLabels.currency')}</dt>
                <dd>{answers.currency}</dd>
                <dt className="text-slate-600 dark:text-slate-400">{t('wizard.summaryLabels.start')}</dt>
                <dd>{formatIsoDate(answers.startDate, lang)}</dd>
                <dt className="text-slate-600 dark:text-slate-400">{t('wizard.summaryLabels.workingDays')}</dt>
                <dd>{answers.workingWeekdays.map((d) => weekdayName(d, lang)).join(', ')}</dd>
                <dt className="text-slate-600 dark:text-slate-400">{t('wizard.summaryLabels.holidays')}</dt>
                <dd>{answers.useCzechHolidays ? t('wizard.yes') : t('wizard.no')}</dd>
                <dt className="text-slate-600 dark:text-slate-400">{t('wizard.summaryLabels.shutdowns')}</dt>
                <dd>
                  {answers.shutdowns.length === 0
                    ? t('wizard.none')
                    : answers.shutdowns.map((s) => `${s.name.trim() || t('calendar.customDefaultName')} (${formatIsoDate(s.start, lang)} – ${formatIsoDate(s.end, lang)})`).join(', ')}
                </dd>
                <dt className="text-slate-600 dark:text-slate-400">{t('wizard.summaryLabels.phases')}</dt>
                <dd>
                  {phasesClean.length === 0
                    ? t('wizard.noPhases')
                    : answers.addFirstTasks
                      ? t('wizard.withFirstTasks', { phases: phasesClean.join(', ') })
                      : phasesClean.join(', ')}
                </dd>
              </dl>
              <p className="rounded-md border-l-4 border-miro-turquoise-dark bg-miro-turquoise-light/40 px-3 py-2 dark:border-miro-turquoise dark:bg-slate-800">{t('wizard.replaceNote')}</p>
            </>
          )}
        </div>

        <div id={ids.errors} aria-live="assertive">
          {errors.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-md border-l-4 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-400 dark:bg-red-950/40 dark:text-red-200">
              {errors.map((e) => (
                <li key={e}>
                  <span aria-hidden="true">⚠ </span>
                  {t(`wizard.errors.${e}`)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('wizard.cancel')}
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button type="button" className="btn-secondary" onClick={goBack}>
                <span aria-hidden="true">←</span> {t('wizard.back')}
              </button>
            )}
            <button type="submit" className="btn-primary">
              {step === 'summary' ? (
                t('wizard.create')
              ) : (
                <>
                  {t('wizard.next')} <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
