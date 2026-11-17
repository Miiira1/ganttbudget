/**
 * Dialog importu celého projektu z Excelu (doplněk po fázi 7): co sešit obsahuje (počty za listy)
 * a varování, že nahradí celý projekt – nebo seznam chyb s listem a číslem řádku.
 * S chybou nejde import potvrdit. Text ze souboru se zobrazuje jen jako text.
 */
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cancelWorkbookImport, confirmWorkbookImport, useWorkbookImportState } from '../io/workbookActions'
import type { WorkbookError, WorkbookSummary } from '../io/workbookImport'
import { formatIsoDate } from '../i18n/format'
import { useProject } from '../store/useProject'

const MAX_ERRORS = 25
const SUMMARY_SHEETS: (keyof WorkbookSummary)[] = ['tasks', 'lines', 'actuals', 'categories', 'departments', 'professions', 'workers', 'absences', 'machines', 'materials']
const SHEET_OF: Record<keyof WorkbookSummary, string> = {
  tasks: 'tasks',
  lines: 'lines',
  categories: 'categories',
  departments: 'departments',
  professions: 'professions',
  workers: 'workers',
  absences: 'absences',
  machines: 'machines',
  materials: 'materials',
  actuals: 'actuals',
}

export function WorkbookImportDialog() {
  const { t, i18n } = useTranslation()
  const pending = useWorkbookImportState((s) => s.pending)
  const currentName = useProject((s) => s.project.name)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (pending && !dialog.open) dialog.showModal()
    if (!pending && dialog.open) dialog.close()
  }, [pending])

  /** Text chyby: list Činnosti a Řádky mají vlastní hlášky z dílčích importů. */
  function message(error: WorkbookError): string {
    // Chybějící list má vlastní text sešitu; ostatní chyby listů Činnosti / Řádky berou texty svých importů.
    const key =
      error.code === 'missingSheet'
        ? 'workbook.error.missingSheet'
        : error.sheet === 'tasks'
          ? `import.error.${error.code}`
          : error.sheet === 'lines'
            ? `budgetImport.error.${error.code}`
            : `workbook.error.${error.code}`
    const sheet = t(`workbook.sheets.${error.sheet}`)
    return error.row === 1 ? t('workbook.error.sheetOnly', { sheet, message: t(key) }) : t('workbook.error.sheetRow', { sheet, row: error.row, message: t(key) })
  }

  const result = pending?.result
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={cancelWorkbookImport}
      className="m-auto max-h-[90vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      {pending && result && (
        <div className="p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {t('workbook.importTitle')}
          </h2>
          <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-400">{pending.fileName}</p>

          {result.ok ? (
            <>
              <p className="mt-3 text-sm">
                {t('workbook.importSummary', { name: result.project.name, start: formatIsoDate(result.project.startDate, i18n.language), currency: result.project.currency })}
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm sm:grid-cols-3">
                {SUMMARY_SHEETS.map((key) => (
                  <li key={key} className="flex justify-between gap-2 border-b border-slate-100 py-0.5 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">{t(`workbook.sheets.${SHEET_OF[key]}`)}</span>
                    <span className="tabular-nums font-medium">{result.summary[key]}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-md border-l-4 border-miro-gold bg-miro-yellow-light/50 p-2 text-sm text-miro-graphite dark:border-miro-yellow dark:bg-slate-800 dark:text-miro-yellow-light">
                {t('workbook.replaceWarning', { name: currentName })}
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
                {t('import.errorsIntro', { count: result.errors.length })}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {result.errors.slice(0, MAX_ERRORS).map((error, i) => (
                  <li key={i}>{message(error)}</li>
                ))}
              </ul>
              {result.errors.length > MAX_ERRORS && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('import.moreErrors', { count: result.errors.length - MAX_ERRORS })}</p>}
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t('import.nothingChanged')}</p>
            </>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={cancelWorkbookImport}>
              {t('import.cancel')}
            </button>
            <button type="button" className="btn-primary" disabled={!result.ok} onClick={() => result.ok && confirmWorkbookImport(result.project)}>
              {t('workbook.importConfirm')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
