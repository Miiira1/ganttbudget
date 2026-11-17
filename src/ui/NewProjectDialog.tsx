/**
 * Okno „Nový projekt“ (U-02, fáze 10): prázdný projekt, průvodce prvním projektem (U-01),
 * nebo projekt ze šablony k zvolenému začátku.
 * Otevírá se z menu Soubor → Nový projekt. Před nahrazením rozpracovaného plánu se aplikace zeptá
 * (neuložené změny); vytvoření jde vrátit Ctrl+Z.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { newProject } from '../io/fileActions'
import { AiIcon } from './icons'
import { isValidIsoDate, nextMonday, todayIso } from '../model/dates'
import { formatMoneyCompact } from '../model/money'
import { createFromTemplate, summarizeProject, templateName, TEMPLATES, type TemplateId } from '../samples/templates'

type Choice = 'blank' | 'wizard' | 'ai' | TemplateId

/** `onWizard` / `onAi` – po zavření tohoto okna otevřít průvodce / okno AI na kartě „Vytvořit plán s AI“. */
export function NewProjectDialog({ open, onClose, onWizard, onAi }: { open: boolean; onClose: () => void; onWizard: () => void; onAi: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const dateId = useId()
  const dateHintId = useId()
  const [choice, setChoice] = useState<Choice>('blank')
  const [startDate, setStartDate] = useState(() => nextMonday(todayIso()))

  // Nativní dialog prohlížeče: umí Esc a drží fokus uvnitř. Při otevření výchozí volby.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setChoice('blank')
      setStartDate(nextMonday(todayIso()))
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const dateOk = isValidIsoDate(startDate)
  const translate = (key: string) => t(key)

  // Údaje na karty šablon (počet položek, délka, rozpočet) – jen když je okno otevřené.
  const summaries = useMemo(() => {
    if (!open) return new Map<TemplateId, ReturnType<typeof summarizeProject>>()
    const start = dateOk ? startDate : nextMonday(todayIso())
    return new Map(TEMPLATES.map((x) => [x.id, summarizeProject(createFromTemplate(x.id, (key) => t(key), lang, start))]))
  }, [open, dateOk, startDate, lang, t])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (choice === 'wizard' || choice === 'ai') {
      onClose()
      if (choice === 'wizard') onWizard()
      else onAi()
      return
    }
    if (choice !== 'blank' && !dateOk) return
    const project = choice === 'blank' ? undefined : createFromTemplate(choice as TemplateId, translate, lang, startDate)
    if (newProject(t, lang, project)) onClose()
  }

  const card = (selected: boolean) =>
    `flex cursor-pointer gap-3 rounded-md border p-3 text-sm ${
      selected ? 'border-miro-turquoise-dark bg-miro-turquoise-light/40 dark:border-miro-turquoise dark:bg-slate-800' : 'border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'
    }`

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      <form className="p-5" onSubmit={submit}>
        <h2 id={titleId} className="text-lg font-semibold">
          {t('newProject.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('newProject.intro')}</p>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">{t('newProject.title')}</legend>
          <label className={card(choice === 'blank')}>
            <input type="radio" name="newProject" checked={choice === 'blank'} onChange={() => setChoice('blank')} className="mt-0.5 h-4 w-4 accent-miro-turquoise-dark" />
            <span>
              <span className="block font-semibold">{t('newProject.blank')}</span>
              <span className="mt-0.5 block text-slate-600 dark:text-slate-400">{t('newProject.blankText')}</span>
            </span>
          </label>

          <label className={card(choice === 'wizard')}>
            <input type="radio" name="newProject" checked={choice === 'wizard'} onChange={() => setChoice('wizard')} className="mt-0.5 h-4 w-4 accent-miro-turquoise-dark" />
            <span>
              <span className="block font-semibold">{t('newProject.wizard')}</span>
              <span className="mt-0.5 block text-slate-600 dark:text-slate-400">{t('newProject.wizardText')}</span>
            </span>
          </label>

          <label className={card(choice === 'ai')}>
            <input type="radio" name="newProject" checked={choice === 'ai'} onChange={() => setChoice('ai')} className="mt-0.5 h-4 w-4 accent-miro-turquoise-dark" />
            <span>
              <span className="flex items-center gap-1.5 font-semibold">
                <AiIcon />
                {t('newProject.ai')}
              </span>
              <span className="mt-0.5 block text-slate-600 dark:text-slate-400">{t('newProject.aiText')}</span>
            </span>
          </label>

          <p className="pt-2 text-sm font-semibold">{t('newProject.templatesHeading')}</p>
          {TEMPLATES.map(({ id }) => {
            const summary = summaries.get(id)
            return (
              <label key={id} className={card(choice === id)}>
                <input type="radio" name="newProject" checked={choice === id} onChange={() => setChoice(id)} className="mt-0.5 h-4 w-4 accent-miro-turquoise-dark" />
                <span>
                  <span className="block font-semibold">{templateName(id, translate)}</span>
                  <span className="mt-0.5 block text-slate-600 dark:text-slate-400">{t(`newProject.templates.${id}`)}</span>
                  {summary && (
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                      {t('newProject.summary', { items: summary.items, months: summary.months, cost: formatMoneyCompact(summary.cost, summary.currency, lang) })}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </fieldset>

        {choice !== 'blank' && choice !== 'wizard' && choice !== 'ai' && (
          <div className="mt-4">
            <label htmlFor={dateId} className="block text-sm font-medium">
              {t('newProject.startDate')}
            </label>
            <input
              id={dateId}
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-describedby={dateHintId}
              aria-invalid={!dateOk}
              className="field-select mt-1"
            />
            <p id={dateHintId} className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {t('newProject.startDateHint')}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('newProject.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={choice !== 'blank' && choice !== 'wizard' && choice !== 'ai' && !dateOk}>
            {choice === 'wizard' || choice === 'ai' ? t('newProject.continue') : t('newProject.create')}
          </button>
        </div>
      </form>
    </dialog>
  )
}
