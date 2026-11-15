/**
 * Dialog importu z Excelu / CSV (I-03): náhled prvních řádků, nebo seznam chyb s čísly řádků.
 * S chybou nejde import potvrdit – nic se nepoužije ani částečně.
 * Veškerý text ze souboru se zobrazuje jen jako text (React ho nikdy nevloží jako HTML).
 */
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cancelImport, confirmImport, useImportState } from '../io/importActions'
import { depthMap, treeOrder } from '../model/hierarchy'
import { formatPredecessors } from '../model/predecessors'
import { useProject } from '../store/useProject'

const PREVIEW_ROWS = 8
const MAX_ERRORS = 20

export function ImportDialog() {
  const { t } = useTranslation()
  const pending = useImportState((s) => s.pending)
  const currentCount = useProject((s) => s.project.tasks.length)
  const currentLines = useProject((s) => s.project.tasks.reduce((sum, t) => sum + t.lines.length, 0))
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
  const depths = imported ? depthMap(imported) : null
  const preview = imported ? treeOrder(imported) : []

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={cancelImport}
      className="m-auto max-h-[90vh] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      {pending && result && (
        <div className="p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {t('import.title')}
          </h2>
          <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-400">{pending.fileName}</p>

          {imported ? (
            <>
              <p className="mt-3 text-sm">{t('import.summary', { count: imported.tasks.length })}</p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-left dark:border-slate-600">
                    <th className="py-1 pr-3 font-semibold">{t('export.columns.number')}</th>
                    <th className="py-1 pr-3 font-semibold">{t('export.columns.name')}</th>
                    <th className="py-1 pr-3 font-semibold">{t('export.columns.kind')}</th>
                    <th className="py-1 pr-3 font-semibold">{t('export.columns.duration')}</th>
                    <th className="py-1 font-semibold">{t('export.columns.predecessors')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, PREVIEW_ROWS).map((task, i) => (
                    <tr key={task.id} className="border-b border-slate-200 last:border-0 dark:border-slate-700">
                      <td className="py-1 pr-3 tabular-nums">{i + 1}</td>
                      <td className="max-w-64 truncate py-1 pr-3" style={{ paddingLeft: `${(depths?.get(task.id) ?? 0) * 1}rem` }}>
                        {task.name}
                      </td>
                      <td className="py-1 pr-3">{t(`kind.${task.kind}`)}</td>
                      <td className="py-1 pr-3 tabular-nums">{task.kind === 'phase' ? '' : task.durationDays}</td>
                      <td className="py-1">{formatPredecessors(imported, task)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > PREVIEW_ROWS && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('import.more', { count: preview.length - PREVIEW_ROWS })}</p>
              )}
              <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                {t('import.replaceWarning', { count: currentCount })}
                {currentLines > 0 && <strong className="mt-1 block">{t('import.linesWarning', { count: currentLines })}</strong>}
              </p>
            </>
          ) : (
            !result.ok && (
              <>
                <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
                  {t('import.errorsIntro', { count: result.errors.length })}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {result.errors.slice(0, MAX_ERRORS).map((error, i) => (
                    <li key={i}>
                      {error.row === 1 && ['empty', 'missingName', 'tooManyRows', 'invalid'].includes(error.code)
                        ? t(`import.error.${error.code}`)
                        : t('import.rowError', { row: error.row, message: t(`import.error.${error.code}`) })}
                    </li>
                  ))}
                </ul>
                {result.errors.length > MAX_ERRORS && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('import.moreErrors', { count: result.errors.length - MAX_ERRORS })}</p>
                )}
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t('import.nothingChanged')}</p>
              </>
            )
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={cancelImport}>
              {t('import.cancel')}
            </button>
            <button type="button" className="btn-primary" disabled={!imported} onClick={() => imported && confirmImport(imported)}>
              {t('import.confirm')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
