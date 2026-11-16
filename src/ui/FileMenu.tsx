/**
 * Menu „Soubor“ v liště: Nový, Otevřít…, Uložit, Uložit jako… (I-01), export a import tabulky (I-03),
 * export rozpočtu (I-04, fáze 7).
 * Rozbalovací nabídka ovladatelná myší i klávesnicí (šipky, Enter, Esc).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { newProject, openProject, saveProject } from '../io/fileActions'
import { exportCsv, exportXlsx } from '../io/exportActions'
import { exportBudgetCsv, exportBudgetXlsx } from '../io/budgetExportActions'
import { startBudgetImport } from '../io/budgetImportActions'
import { startImport } from '../io/importActions'
import { exportLibrary, startLibraryImport } from '../io/libraryActions'

type Item = {
  id: 'new' | 'open' | 'save' | 'saveAs' | 'exportXlsx' | 'exportCsv' | 'import' | 'exportBudgetXlsx' | 'exportBudgetCsv' | 'importBudget' | 'exportLibrary' | 'importLibrary'
  shortcut?: string
  separatorBefore?: boolean
}
const ITEMS: Item[] = [
  { id: 'new' },
  { id: 'open', shortcut: 'Ctrl+O' },
  { id: 'save', shortcut: 'Ctrl+S' },
  { id: 'saveAs', shortcut: 'Ctrl+Shift+S' },
  { id: 'exportXlsx', separatorBefore: true },
  { id: 'exportCsv' },
  { id: 'import', separatorBefore: true },
  { id: 'exportBudgetXlsx', separatorBefore: true },
  { id: 'exportBudgetCsv' },
  { id: 'importBudget' },
  { id: 'exportLibrary', separatorBefore: true },
  { id: 'importLibrary' },
]

export function FileMenu() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  // Zavřít při kliknutí mimo menu.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    // Po otevření zaměřit první položku (ovládání klávesnicí).
    menuRef.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus()
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function run(id: Item['id']) {
    setOpen(false)
    buttonRef.current?.focus()
    if (id === 'new') newProject(t, i18n.language)
    else if (id === 'open') void openProject(t)
    else if (id === 'exportXlsx') void exportXlsx(t, i18n.language)
    else if (id === 'exportCsv') void exportCsv(t)
    else if (id === 'import') startImport(t)
    else if (id === 'exportBudgetXlsx') void exportBudgetXlsx(t, i18n.language)
    else if (id === 'exportBudgetCsv') void exportBudgetCsv(t, i18n.language)
    else if (id === 'importBudget') startBudgetImport(t)
    else if (id === 'exportLibrary') void exportLibrary(t)
    else if (id === 'importLibrary') startLibraryImport(t)
    else void saveProject(t, id === 'saveAs')
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown') items[(index + 1) % items.length]?.focus()
    else if (event.key === 'ArrowUp') items[(index - 1 + items.length) % items.length]?.focus()
    else if (event.key === 'Escape') {
      setOpen(false)
      buttonRef.current?.focus()
    } else return
    event.preventDefault()
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="btn-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">📁</span> {t('file.menu')} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t('file.menu')}
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 z-30 mt-1 min-w-56 rounded-md border border-slate-300 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          {ITEMS.map((item) => (
            <li key={item.id} role="none" className={item.separatorBefore ? 'mt-1 border-t border-slate-200 pt-1 dark:border-slate-700' : ''}>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(item.id)}
                title={t(`file.${item.id}Hint`)}
                className="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-sm hover:bg-slate-100 focus:bg-miro-turquoise-light/50 focus:outline-none dark:hover:bg-slate-700 dark:focus:bg-slate-700"
              >
                <span>{t(`file.${item.id}`)}</span>
                {item.shortcut && <kbd className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.shortcut}</kbd>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
