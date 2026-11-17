/**
 * Okno „Kontrola plánu“ (U-04, fáze 10): varování z model/planCheck.ts seskupená podle druhu.
 * U každého varování tlačítko „Jak to opravit“ (rozbalí radu) a podle druhu akce:
 * Ukázat v plánu (vybere a ukáže řádek), Otevřít Vytížení, Otevřít Náklady.
 * Varování nic neblokují a neskrývají se – zmizí, až se plán opraví.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatIsoDate } from '../../i18n/format'
import { wbsNumbers } from '../../model/hierarchy'
import { formatMoney } from '../../model/money'
import { KIND_ORDER, type PlanIssue, type PlanIssueKind } from '../../model/planCheck'
import { usePlanIssues, useProject } from '../../store/useProject'
import { revealTask } from '../revealTask'

export type CheckTarget = 'plan' | 'load' | 'costs'

export function PlanCheckDialog({ open, onClose, onShowView }: { open: boolean; onClose: () => void; onShowView: (view: CheckTarget) => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const project = useProject((s) => s.project)
  const issues = usePlanIssues()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  // Nativní dialog prohlížeče: umí Esc a drží fokus uvnitř.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setExpanded(new Set())
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const wbs = useMemo(() => wbsNumbers(project), [project])
  const tasks = useMemo(() => new Map(project.tasks.map((x) => [x.id, x])), [project])
  const groups = useMemo(
    () => KIND_ORDER.map((kind) => ({ kind, items: issues.filter((i) => i.kind === kind) })).filter((g) => g.items.length > 0),
    [issues],
  )

  const date = (iso: string) => formatIsoDate(iso, lang)
  const money = (v: number) => formatMoney(v, project.currency, lang)
  const taskName = (id: string) => tasks.get(id)?.name ?? id

  /** Text varování (bez čísla WBS). */
  function describe(issue: PlanIssue): string {
    switch (issue.kind) {
      case 'budgetOver': {
        const main =
          issue.categoryId === null
            ? t('check.items.budgetOverProject', { amount: money(issue.over) })
            : t('check.items.budgetOverCategory', {
                amount: money(issue.over),
                category: project.costCategories.find((c) => c.id === issue.categoryId)?.name ?? issue.categoryId,
              })
        return issue.exceedDate ? `${main} ${t('check.items.exceedFrom', { date: date(issue.exceedDate) })}` : main
      }
      case 'overload':
        return t('check.items.overload', { name: issue.name, kind: t(`load.kind.${issue.resourceKind}`), count: issue.days, date: date(issue.firstDate) })
      case 'leadBeforePredecessor':
        return t('check.items.leadBeforePredecessor', {
          task: taskName(issue.taskId),
          predecessor: `${wbs.get(issue.predecessorId) ?? ''} ${taskName(issue.predecessorId)}`.trim(),
          link: `${issue.type}${issue.lagDays}`,
        })
      case 'notStarted':
        return t(tasks.get(issue.taskId)?.kind === 'milestone' ? 'check.items.notStartedMilestone' : 'check.items.notStarted', {
          task: taskName(issue.taskId),
          date: date(issue.start),
        })
      default:
        return t(`check.items.${issue.kind}`, { task: taskName(issue.taskId) })
    }
  }

  function act(issue: PlanIssue) {
    onClose()
    if (issue.kind === 'budgetOver') onShowView('costs')
    else if (issue.kind === 'overload') onShowView('load')
    else revealTask(issue.taskId, () => onShowView('plan'))
  }

  const actionLabel = (kind: PlanIssueKind) => (kind === 'budgetOver' ? t('check.openCosts') : kind === 'overload' ? t('check.openLoad') : t('check.showInPlan'))

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(46rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {t('check.title')}
        </h2>
        {project.tasks.length === 0 ? (
          <p className="mt-3 text-sm">{t('check.empty')}</p>
        ) : issues.length === 0 ? (
          <p className="mt-3 text-sm">{t('check.none')}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('check.intro')}</p>
            {groups.map((group) => (
              <section key={group.kind} className="mt-5" aria-label={t(`check.kinds.${group.kind}`)}>
                <h3 className="flex items-center gap-2 border-b border-slate-200 pb-1 font-semibold dark:border-slate-700">
                  <span aria-hidden="true" className="text-miro-gold dark:text-miro-yellow">
                    ⚠
                  </span>
                  {t(`check.kinds.${group.kind}`)}
                  <span className="rounded-full bg-slate-200 px-2 text-xs font-semibold leading-5 dark:bg-slate-700">{group.items.length}</span>
                </h3>
                <ul className="mt-1 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {group.items.map((issue, index) => {
                    const key = `${group.kind}-${index}`
                    const fixId = `${titleId}-${key}`
                    const open = expanded.has(key)
                    const number = 'taskId' in issue ? wbs.get(issue.taskId) : undefined
                    return (
                      <li key={key} className="py-1.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="min-w-60 flex-1">
                            {number && <span className="mr-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">{number}</span>}
                            {describe(issue)}
                          </p>
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={fixId}
                            onClick={() => toggle(key)}
                            className="rounded px-2 py-1 text-sm underline decoration-miro-turquoise decoration-2 underline-offset-4 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-slate-800"
                          >
                            {t('check.howToFix')}
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => act(issue)}>
                            {actionLabel(issue.kind)}
                          </button>
                        </div>
                        {open && (
                          <p id={fixId} className="mt-1.5 rounded-md border-l-4 border-miro-turquoise-dark bg-miro-turquoise-light/40 px-3 py-2 dark:border-miro-turquoise dark:bg-slate-800">
                            {t(`check.fix.${issue.kind}`)}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-primary" onClick={onClose}>
            {t('check.close')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
