/**
 * Náhled načítané knihovny zdrojů: po číselnících kolik položek přibude, změní se a zůstane.
 * Jiná měna než v projektu → načíst nejde. Potvrzení = jeden krok Zpět.
 */
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cancelLibrary, confirmLibrary, useLibraryState } from '../../io/libraryActions'
import { planMerge } from '../../io/libraryFile'
import { CATALOG_KEYS } from '../../model/schema'
import { useProject } from '../../store/useProject'

export function LibraryDialog() {
  const { t } = useTranslation()
  const pending = useLibraryState((s) => s.pending)
  const project = useProject((s) => s.project)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (pending && !dialog.open) dialog.showModal()
    if (!pending && dialog.open) dialog.close()
  }, [pending])

  const plan = pending ? planMerge(project, pending.library) : null
  const totals = plan ? Object.values(plan.counts).reduce((s, c) => ({ added: s.added + c.added, changed: s.changed + c.changed }), { added: 0, changed: 0 }) : null
  const nothingToDo = totals !== null && totals.added + totals.changed === 0
  const th = 'border-b border-slate-300 py-1 pr-3 text-left font-semibold dark:border-slate-600'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={cancelLibrary}
      className="m-auto max-h-[90vh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      {pending && plan && (
        <div className="p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {t('library.title')}
          </h2>
          <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-400">{pending.fileName}</p>

          {plan.currencyMismatch ? (
            <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">
              {t('library.currencyMismatch', { library: pending.library.currency, project: project.currency })}
            </p>
          ) : (
            <>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr>
                    <th className={th}>{t('library.catalog')}</th>
                    <th className={`${th} text-right`}>{t('library.added')}</th>
                    <th className={`${th} text-right`}>{t('library.changed')}</th>
                    <th className={`${th} text-right`}>{t('library.unchanged')}</th>
                  </tr>
                </thead>
                <tbody>
                  {CATALOG_KEYS.map((key) => (
                    <tr key={key} className="border-b border-slate-200 last:border-0 dark:border-slate-700">
                      <td className="py-1 pr-3">{t(`resources.tabs.${key}`)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{plan.counts[key].added}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{plan.counts[key].changed}</td>
                      <td className="py-1 pr-3 text-right tabular-nums text-slate-500 dark:text-slate-400">{plan.counts[key].unchanged}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{nothingToDo ? t('library.nothingToDo') : t('library.explain')}</p>
            </>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={cancelLibrary}>
              {t('rate.cancel')}
            </button>
            <button type="button" className="btn-primary" disabled={plan.currencyMismatch || nothingToDo} onClick={() => confirmLibrary(pending.library)}>
              {t('library.confirm')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
