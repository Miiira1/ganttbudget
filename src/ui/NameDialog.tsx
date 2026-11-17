/**
 * Malý dialog pro zadání názvu (uložit / přejmenovat) – sdílený nabídkou Pohled v Analýze
 * a správou baseline ve Sledování. Žádné window.prompt; Esc a Zrušit zavřou bez změny.
 */
import { useEffect, useId, useRef, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

export function NameDialog({
  open,
  title,
  name,
  label,
  confirm,
  hint,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean
  title: string
  name: string
  label: string
  confirm: string
  hint?: string
  onChange: (name: string) => void
  onSubmit: (event: FormEvent) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      {open && (
        <form onSubmit={onSubmit} className="p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <label className="mt-3 flex flex-col gap-1 text-sm">
            {label}
            <input
              type="text"
              autoFocus
              required
              maxLength={100}
              value={name}
              onChange={(e) => onChange(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          {hint && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('import.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={name.trim() === ''}>
              {confirm}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
