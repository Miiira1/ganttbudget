/**
 * Karta „Vytvořit plán s AI“ (AI-02, AI-04, fáze 11) v okně AI.
 *  1. Uživatel popíše projekt (název, začátek, měna, popis) → Zkopírovat prompt.
 *  2. Vloží odpověď AI → Zkontrolovat (model/aiPlan.ts): chyby s promptem na opravu, nebo náhled
 *     a Vytvořit projekt (nahradí projekt jedním krokem Zpět; na neuložené změny se zeptá).
 * Vložený text se nikdy nevkládá jako HTML; neplatná data se nepoužijí ani částečně.
 */
import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatIsoDate } from '../../i18n/format'
import { newProject } from '../../io/fileActions'
import { parseAiPlan, type AiPlanResult } from '../../model/aiPlan'
import { describeAiError, fixPrompt, planPrompt, type Translate } from '../../model/aiPrompts'
import { isValidIsoDate, nextMonday, todayIso } from '../../model/dates'
import { depthMap, treeOrder } from '../../model/hierarchy'
import { formatMoneyCompact } from '../../model/money'
import { WIZARD_CURRENCIES } from '../../model/wizard'
import { summarizeProject } from '../../samples/templates'
import { getPlanIssues } from '../../store/useProject'

const PREVIEW_ROWS = 15

export function AiPlanTab({ onDone }: { onDone: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const translate: Translate = (key, options) => t(key, options ?? {})
  const ids = { name: useId(), start: useId(), currency: useId(), description: useId(), prompt: useId(), answer: useId() }
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const promptDetailsRef = useRef<HTMLDetailsElement>(null)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(() => nextMonday(todayIso()))
  const [currency, setCurrency] = useState('CZK')
  const [description, setDescription] = useState('')
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<AiPlanResult | null>(null)
  /** Text ukázaný k ručnímu zkopírování, když schránka nejde (prompt, nebo prompt na opravu). */
  const [manual, setManual] = useState<string | null>(null)
  const [status, setStatus] = useState<'copied' | 'copyFailed' | 'fixCopied' | 'missing' | 'startInvalid' | null>(null)

  const settingsOk = name.trim() !== '' && description.trim() !== ''
  const prompt = planPrompt(translate, lang, { name, startDate, currency, description })

  /** Změna zadání nebo odpovědi zneplatní předchozí kontrolu. */
  const reset = () => {
    setResult(null)
    setStatus(null)
    setManual(null)
  }

  async function copyText(text: string, ok: 'copied' | 'fixCopied') {
    try {
      await navigator.clipboard.writeText(text)
      setStatus(ok)
    } catch {
      // Schránka může být zakázaná – ukázat a označit text k ručnímu Ctrl+C.
      setManual(text)
      if (promptDetailsRef.current) promptDetailsRef.current.open = true
      requestAnimationFrame(() => {
        promptRef.current?.focus()
        promptRef.current?.select()
      })
      setStatus('copyFailed')
    }
  }

  function copyPrompt() {
    if (!settingsOk) return setStatus('missing')
    if (!isValidIsoDate(startDate)) return setStatus('startInvalid')
    void copyText(prompt, 'copied')
  }

  function check() {
    if (!settingsOk) return setStatus('missing')
    if (!isValidIsoDate(startDate)) return setStatus('startInvalid')
    setStatus(null)
    setResult(parseAiPlan(answer, { name: name.trim(), startDate, currency, language: lang }, () => crypto.randomUUID()))
  }

  function create() {
    if (!result?.ok) return
    if (newProject(t, lang, result.project)) onDone()
  }

  // Náhled hotového plánu: souhrn, varování kontroly plánu a první řádky stromu.
  const preview = useMemo(() => {
    if (!result?.ok) return null
    const project = result.project
    return { summary: summarizeProject(project), issues: getPlanIssues(project).length, rows: treeOrder(project), depths: depthMap(project) }
  }, [result])

  return (
    <div className="mt-3 space-y-4 text-sm">
      <p className="text-slate-600 dark:text-slate-400">{t('aiDialog.plan.intro')}</p>

      <section className="space-y-3">
        <h4 className="font-semibold">{t('aiDialog.plan.step1')}</h4>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1">
            <label htmlFor={ids.name} className="block font-medium">
              {t('aiDialog.plan.name')}
            </label>
            <input id={ids.name} type="text" value={name} maxLength={200} onChange={(e) => (setName(e.target.value), reset())} className="field-select mt-1 w-full" />
          </div>
          <div>
            <label htmlFor={ids.start} className="block font-medium">
              {t('aiDialog.plan.start')}
            </label>
            <input id={ids.start} type="date" value={startDate} onChange={(e) => (setStartDate(e.target.value), reset())} className="field-select mt-1" />
          </div>
          <div>
            <label htmlFor={ids.currency} className="block font-medium">
              {t('aiDialog.plan.currency')}
            </label>
            <select id={ids.currency} value={currency} onChange={(e) => (setCurrency(e.target.value), reset())} className="field-select mt-1">
              {WIZARD_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor={ids.description} className="block font-medium">
            {t('aiDialog.plan.description')}
          </label>
          <textarea
            id={ids.description}
            value={description}
            maxLength={5000}
            rows={4}
            placeholder={t('aiDialog.plan.descriptionPlaceholder')}
            onChange={(e) => (setDescription(e.target.value), reset())}
            className="field-select mt-1 w-full"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={copyPrompt}>
            <span aria-hidden="true">📋</span> {t('aiDialog.plan.copyPrompt')}
          </button>
        </div>
        <details ref={promptDetailsRef}>
          <summary className="cursor-pointer text-slate-600 dark:text-slate-400">{t('aiDialog.plan.showPrompt')}</summary>
          <textarea ref={promptRef} id={ids.prompt} aria-label={t('aiDialog.plan.showPrompt')} readOnly value={manual ?? prompt} rows={8} className="field-select mt-1 w-full font-mono text-xs" />
        </details>
      </section>

      <section className="space-y-3">
        <h4 className="font-semibold">{t('aiDialog.plan.step2')}</h4>
        <div>
          <label htmlFor={ids.answer} className="block font-medium">
            {t('aiDialog.plan.answer')}
          </label>
          <textarea
            id={ids.answer}
            value={answer}
            rows={6}
            placeholder={t('aiDialog.plan.answerPlaceholder')}
            onChange={(e) => (setAnswer(e.target.value), reset())}
            className="field-select mt-1 w-full font-mono text-xs"
          />
        </div>
        <button type="button" className="btn-secondary" onClick={check} disabled={answer.trim() === ''}>
          {t('aiDialog.plan.check')}
        </button>
      </section>

      <p role="status" className="text-sm">
        {status && t(`aiDialog.plan.${status}`)}
      </p>

      {result && !result.ok && (
        <div className="rounded-md border-l-4 border-red-600 bg-red-50 px-3 py-2 text-red-900 dark:border-red-400 dark:bg-red-950/40 dark:text-red-100">
          <p className="font-semibold">
            <span aria-hidden="true">⚠ </span>
            {t('aiDialog.plan.errorsTitle')}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {result.errors.map((e, i) => (
              <li key={i}>{describeAiError(translate, e)}</li>
            ))}
          </ul>
          <p className="mt-2">{t('aiDialog.plan.fixHint')}</p>
          <button type="button" className="btn-secondary mt-2" onClick={() => void copyText(fixPrompt(translate, result.errors, answer), 'fixCopied')}>
            <span aria-hidden="true">📋</span> {t('aiDialog.plan.copyFix')}
          </button>
        </div>
      )}

      {result?.ok && preview && (
        <div className="rounded-md border-l-4 border-miro-turquoise-dark bg-miro-turquoise-light/40 px-3 py-2 dark:border-miro-turquoise dark:bg-slate-800">
          <p className="font-semibold">{t('aiDialog.plan.okTitle')}</p>
          <p className="mt-1">
            {t('newProject.summary', { items: preview.summary.items, months: preview.summary.months, cost: formatMoneyCompact(preview.summary.cost, preview.summary.currency, lang) })}
            {preview.summary.finish && ` · ${t('aiDialog.plan.finish', { date: formatIsoDate(preview.summary.finish, lang) })}`}
          </p>
          <p>{preview.issues > 0 ? t('aiDialog.plan.issues', { count: preview.issues }) : t('aiDialog.plan.issuesNone')}</p>
          {result.warnings.map((w, i) => (
            <p key={i} className="text-slate-700 dark:text-slate-300">
              ℹ {t(`ai.warnings.${w.code}`, { item: w.item, id: w.taskId })}
            </p>
          ))}
          <ul className="mt-2 space-y-0.5">
            {preview.rows.slice(0, PREVIEW_ROWS).map((task) => (
              <li key={task.id} style={{ paddingLeft: `${(preview.depths.get(task.id) ?? 0) * 1.25}rem` }} className={task.kind === 'phase' ? 'font-semibold' : ''}>
                {task.kind === 'milestone' && <span aria-hidden="true">◆ </span>}
                {task.name}
                {task.kind === 'task' && <span className="text-slate-500 dark:text-slate-400"> · {t('aiDialog.plan.days', { count: task.durationDays })}</span>}
              </li>
            ))}
          </ul>
          {preview.rows.length > PREVIEW_ROWS && <p className="mt-1 text-slate-600 dark:text-slate-400">{t('aiDialog.plan.more', { count: preview.rows.length - PREVIEW_ROWS })}</p>}
          <p className="mt-2 text-slate-700 dark:text-slate-300">{t('wizard.replaceNote')}</p>
          <button type="button" className="btn-primary mt-2" onClick={create}>
            {t('aiDialog.plan.create')}
          </button>
        </div>
      )}
    </div>
  )
}
