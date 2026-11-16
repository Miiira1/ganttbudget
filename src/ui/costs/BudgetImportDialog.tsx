/**
 * Dialog importu rozpočtu (fáze 7, I-04): náhled prvních řádků a co se nahradí, nebo seznam chyb
 * s čísly řádků. S chybou nejde import potvrdit – nic se nepoužije ani částečně.
 * Text ze souboru se zobrazuje jen jako text.
 */
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cancelBudgetImport, confirmBudgetImport, useBudgetImportState } from '../../io/budgetImportActions'
import { treeOrder, wbsNumbers } from '../../model/hierarchy'
import { formatMoney } from '../../model/money'
import type { Project, TaskLine } from '../../model/schema'
import { useProject } from '../../store/useProject'

const PREVIEW_ROWS = 8
const MAX_ERRORS = 20

/** Zdroj / název řádku pro náhled. */
function lineLabel(project: Project, line: TaskLine): string {
  const find = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? ''
  if (line.kind === 'labor') return [find(project.professions, line.professionId), line.workerId ? find(project.workers, line.workerId) : ''].filter(Boolean).join(' – ')
  if (line.kind === 'machine') return find(project.machines, line.machineId)
  if (line.kind === 'material') return find(project.materials, line.materialId)
  return line.name
}

export function BudgetImportDialog() {
  const { t, i18n } = useTranslation()
  const pending = useBudgetImportState((s) => s.pending)
  const current = useProject((s) => s.project)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (pending && !dialog.open) dialog.showModal()
    if (!pending && dialog.open) dialog.close()
  }, [pending])

  const result = pending?.result
  const imported = result?.ok ? result.project : null
  // Náhled: řádky činností, které se mění (v pořadí plánu).
  const preview = imported
    ? treeOrder(imported)
        .filter((task) => task.lines !== current.tasks.find((x) => x.id === task.id)?.lines)
        .flatMap((task) => task.lines.map((line) => ({ task, line })))
    : []
  const wbs = imported ? wbsNumbers(imported) : new Map<string, string>()
  const th = 'py-1 pr-3 text-left font-semibold'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={cancelBudgetImport}
      className="m-auto max-h-[90vh] w-[min(48rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      {pending && result && (
        <div className="p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {t('budgetImport.title')}
          </h2>
          <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-400">{pending.fileName}</p>

          {result.ok ? (
            <>
              <p className="mt-3 text-sm">{t('budgetImport.summary', { count: result.summary.lines, tasks: result.summary.tasks })}</p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-300 dark:border-slate-600">
                    <th className={th}>{t('budgetExport.columns.wbs')}</th>
                    <th className={th}>{t('budgetExport.columns.task')}</th>
                    <th className={th}>{t('budgetExport.columns.kind')}</th>
                    <th className={th}>{t('budgetExport.columns.resource')}</th>
                    <th className={th}>{t('budgetExport.columns.category')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, PREVIEW_ROWS).map(({ task, line }) => (
                    <tr key={line.id} className="border-b border-slate-200 last:border-0 dark:border-slate-700">
                      <td className="py-1 pr-3 tabular-nums">{wbs.get(task.id)}</td>
                      <td className="max-w-48 truncate py-1 pr-3">{task.name}</td>
                      <td className="py-1 pr-3">{t(`detail.kind.${line.kind}`)}</td>
                      <td className="max-w-56 truncate py-1 pr-3">
                        {lineLabel(imported!, line)}
                        {(line.kind === 'oneTime' || line.kind === 'recurring') && (
                          <span className="text-slate-500 dark:text-slate-400"> · {formatMoney(line.amount, current.currency, i18n.language)}</span>
                        )}
                      </td>
                      <td className="py-1">{imported!.costCategories.find((c) => c.id === line.categoryId)?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > PREVIEW_ROWS && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('import.more', { count: preview.length - PREVIEW_ROWS })}</p>}
              <p className="mt-4 rounded-md border-l-4 border-miro-gold bg-miro-yellow-light/50 p-2 text-sm text-miro-graphite dark:border-miro-yellow dark:bg-slate-800 dark:text-miro-yellow-light">
                {t('budgetImport.replaceWarning', { tasks: result.summary.tasks, count: result.summary.replaced })}
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
                {t('import.errorsIntro', { count: result.errors.length })}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {result.errors.slice(0, MAX_ERRORS).map((error, i) => (
                  <li key={i}>
                    {error.row === 1
                      ? t(`budgetImport.error.${error.code}`)
                      : t('import.rowError', { row: error.row, message: t(`budgetImport.error.${error.code}`) })}
                  </li>
                ))}
              </ul>
              {result.errors.length > MAX_ERRORS && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('import.moreErrors', { count: result.errors.length - MAX_ERRORS })}</p>}
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t('import.nothingChanged')}</p>
            </>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={cancelBudgetImport}>
              {t('import.cancel')}
            </button>
            <button type="button" className="btn-primary" disabled={!imported} onClick={() => imported && confirmBudgetImport(imported)}>
              {t('budgetImport.confirm')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
