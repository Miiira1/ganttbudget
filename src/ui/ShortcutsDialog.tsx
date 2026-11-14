/**
 * Přehled klávesových zkratek a ovládání myší (G-06). Otevře se klávesou F1
 * nebo tlačítkem „⌨ Zkratky“ v liště. Popisy jsou v překladech (shortcuts.*).
 */
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/** [klávesy, klíč popisu] – klávesy jsou stejné ve všech jazycích. */
const KEYBOARD: [keys: string[], description: string][] = [
  [['Ctrl', 'S'], 'save'],
  [['Ctrl', 'Shift', 'S'], 'saveAs'],
  [['Ctrl', 'O'], 'open'],
  [['Ctrl', 'Enter'], 'addTask'],
  [['Ctrl', 'D'], 'duplicate'],
  [['Ctrl', 'Delete'], 'delete'],
  [['Alt', 'Shift', '→'], 'indent'],
  [['Alt', 'Shift', '←'], 'outdent'],
  [['Alt', 'Shift', '↑'], 'moveUp'],
  [['Alt', 'Shift', '↓'], 'moveDown'],
  [['Ctrl', 'Z'], 'undo'],
  [['Ctrl', 'Y'], 'redo'],
  [['Enter'], 'confirm'],
  [['Esc'], 'cancel'],
  [['Tab'], 'nextField'],
  [['F1'], 'help'],
]

/** Ovládání myší – jen popisy. */
const MOUSE = ['multiSelect', 'dragGroup', 'zoom', 'dragBar', 'dragEdge', 'drawLink', 'dragRow', 'resizeColumn', 'pin', 'collapse']

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  // Nativní dialog prohlížeče: umí Esc a drží fokus uvnitř (stejně jako Kalendář).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const kbd =
    'inline-block min-w-6 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-center font-mono text-xs dark:border-slate-600 dark:bg-slate-800'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {t('shortcuts.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('shortcuts.intro')}</p>

        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">{t('shortcuts.keyboard')}</caption>
          <tbody>
            {KEYBOARD.map(([keys, description]) => (
              <tr key={description} className="border-b border-slate-200 last:border-0 dark:border-slate-700">
                <th scope="row" className="whitespace-nowrap py-1.5 pr-4 text-left font-normal">
                  {keys.map((key, i) => (
                    <span key={key}>
                      {i > 0 && <span className="px-0.5 text-slate-400">+</span>}
                      <kbd className={kbd}>{key}</kbd>
                    </span>
                  ))}
                </th>
                <td className="py-1.5">{t(`shortcuts.items.${description}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mt-5 font-semibold">{t('shortcuts.mouse')}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {MOUSE.map((item) => (
            <li key={item}>{t(`shortcuts.mouseItems.${item}`)}</li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-primary" onClick={onClose}>
            {t('shortcuts.close')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
