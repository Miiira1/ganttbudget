/**
 * Okno „Pracovat s AI“ (fáze 11): tlačítko AI (ikona čtyřcípé hvězdičky) v liště.
 * Karta „Zkopírovat projekt pro AI“ (AI-01): výběr otázky, volba jmen a sazeb (výchozí bez – soukromí),
 * náhled textu a zkopírování do schránky. Aplikace nic sama neposílá – text vloží do AI uživatel.
 * Karta „Vytvořit plán s AI“ (AI-02) je v AiPlanTab.tsx; její rozepsané zadání vydrží i zavření okna
 * (uživatel mezitím pracuje v chatu s AI), po vytvoření projektu se vyprázdní.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AI_QUESTIONS, projectForAi, type AiQuestion, type Translate } from '../../model/aiPrompts'
import { AiIcon } from '../icons'
import { AiPlanTab } from './AiPlanTab'
import { useBudgetStatus, useCosts, useCostTimeline, useEarnedValue, useLoad, usePlanIssues, useProject, useSchedule } from '../../store/useProject'

type QuestionChoice = AiQuestion | 'custom' | 'none'
export type AiTab = 'export' | 'plan'
const TABS: AiTab[] = ['export', 'plan']

/** `initialTab` = karta, která se ukáže při otevření (z okna Nový projekt rovnou „Vytvořit plán s AI“). */
export function AiDialog({ open, onClose, initialTab = 'export' }: { open: boolean; onClose: () => void; initialTab?: AiTab }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const tabsId = useId()
  const [tab, setTab] = useState<AiTab>(initialTab)
  /** Po vytvoření projektu se karta plánu vyprázdní (nový klíč = nová komponenta). */
  const [planKey, setPlanKey] = useState(0)

  // Nativní dialog prohlížeče: Esc zavře, fokus zůstane uvnitř.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setTab(initialTab)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
    // initialTab se čte jen při otevření.
  }, [open])

  /** Šipky vlevo / vpravo přepínají karty (vzor „tabs“ pro klávesnici). */
  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = TABS[(TABS.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!
    setTab(next)
    document.getElementById(`${tabsId}-${next}`)?.focus()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[92vh] w-[min(52rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-5">
        <h2 id={titleId} className="flex items-center gap-2 text-lg font-semibold">
          <AiIcon />
          {t('aiDialog.title')}
        </h2>
        <div role="tablist" aria-label={t('aiDialog.title')} onKeyDown={onTabKey} className="mt-3 flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {TABS.map((id) => (
            <button
              key={id}
              id={`${tabsId}-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`${tabsId}-${id}-panel`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={`-mb-px rounded-t-md border px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                tab === id
                  ? 'border-slate-200 border-b-white bg-white dark:border-slate-700 dark:border-b-slate-900 dark:bg-slate-900'
                  : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {t(`aiDialog.tabs.${id}`)}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`${tabsId}-export-panel`} aria-labelledby={`${tabsId}-export`} hidden={tab !== 'export'}>
          {/* Export se počítá jen při otevřené kartě (prochází celý projekt). */}
          {open && tab === 'export' && <ExportTab lang={lang} />}
        </div>
        <div role="tabpanel" id={`${tabsId}-plan-panel`} aria-labelledby={`${tabsId}-plan`} hidden={tab !== 'plan'}>
          <AiPlanTab
            key={planKey}
            onDone={() => {
              setPlanKey((k) => k + 1)
              onClose()
            }}
          />
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-primary" onClick={onClose}>
            {t('aiDialog.close')}
          </button>
        </div>
      </div>
    </dialog>
  )
}

/** Karta „Zkopírovat projekt pro AI“ (AI-01). */
function ExportTab({ lang }: { lang: string }) {
  const { t } = useTranslation()
  const project = useProject((s) => s.project)
  const scheduled = useSchedule()
  const costs = useCosts()
  const timeline = useCostTimeline()
  const budget = useBudgetStatus()
  const load = useLoad()
  const issues = usePlanIssues()
  const ev = useEarnedValue()
  const ids = { question: useId(), custom: useId(), names: useId(), namesHint: useId(), preview: useId() }
  const previewRef = useRef<HTMLTextAreaElement>(null)
  const [choice, setChoice] = useState<QuestionChoice>('risks')
  const [custom, setCustom] = useState('')
  const [includeNames, setIncludeNames] = useState(false)
  const [status, setStatus] = useState<'copied' | 'copyFailed' | null>(null)

  const question = choice === 'none' ? '' : choice === 'custom' ? custom : t(`ai.questions.${choice}.text`)
  const text = useMemo(
    () => projectForAi(((key, options) => t(key, options ?? {})) as Translate, lang, { project, scheduled, costs, timeline, budget, load, issues, ev }, { question, includeNames }),
    [t, lang, project, scheduled, costs, timeline, budget, load, issues, ev, question, includeNames],
  )

  // Po změně textu zmizí hláška o zkopírování (týkala by se starého textu).
  useEffect(() => setStatus(null), [text])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch {
      // Schránka může být zakázaná (nastavení prohlížeče) – text označit k ručnímu Ctrl+C.
      previewRef.current?.focus()
      previewRef.current?.select()
      setStatus('copyFailed')
    }
  }

  if (project.tasks.length === 0) return <p className="mt-3 text-sm">{t('aiDialog.export.empty')}</p>

  return (
    <div className="mt-3 space-y-4 text-sm">
      <p className="text-slate-600 dark:text-slate-400">{t('aiDialog.export.intro')}</p>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor={ids.question} className="block font-medium">
            {t('aiDialog.export.question')}
          </label>
          <select id={ids.question} value={choice} onChange={(e) => setChoice(e.target.value as QuestionChoice)} className="field-select mt-1">
            {AI_QUESTIONS.map((q) => (
              <option key={q} value={q}>
                {t(`ai.questions.${q}.label`)}
              </option>
            ))}
            <option value="custom">{t('aiDialog.export.custom')}</option>
            <option value="none">{t('aiDialog.export.none')}</option>
          </select>
        </div>
        <label className="flex items-center gap-2" htmlFor={ids.names}>
          <input
            id={ids.names}
            type="checkbox"
            checked={includeNames}
            onChange={(e) => setIncludeNames(e.target.checked)}
            aria-describedby={ids.namesHint}
            className="h-4 w-4 accent-miro-turquoise-dark"
          />
          {t('aiDialog.export.includeNames')}
        </label>
      </div>
      <p id={ids.namesHint} className="-mt-2 text-xs text-slate-600 dark:text-slate-400">
        {t('aiDialog.export.includeNamesHint')}
      </p>

      {choice === 'custom' && (
        <div>
          <label htmlFor={ids.custom} className="block font-medium">
            {t('aiDialog.export.customLabel')}
          </label>
          <textarea
            id={ids.custom}
            value={custom}
            maxLength={2000}
            rows={2}
            placeholder={t('aiDialog.export.customPlaceholder')}
            onChange={(e) => setCustom(e.target.value)}
            className="field-select mt-1 w-full"
          />
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={ids.preview} className="font-medium">
            {t('aiDialog.export.preview')}
          </label>
          <span className="text-xs text-slate-500 dark:text-slate-400">{t('aiDialog.export.size', { chars: new Intl.NumberFormat(lang).format(text.length) })}</span>
        </div>
        <textarea ref={previewRef} id={ids.preview} readOnly value={text} rows={12} className="field-select mt-1 w-full font-mono text-xs" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => void copy()}>
          <span aria-hidden="true">📋</span> {t('aiDialog.export.copy')}
        </button>
        <p role="status" className="text-sm">
          {status && t(`aiDialog.export.${status}`)}
        </p>
      </div>
    </div>
  )
}
