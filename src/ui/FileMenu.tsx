/**
 * Menu „Soubor“ v liště – dvouúrovňové, aby se vešlo i na obrazovku notebooku:
 *  - nahoře Nový, Otevřít, Uložit, Uložit jako, Tisk / PDF,
 *  - podnabídka **Exportovat** (Gantt jako obrázek, celý projekt, činnosti, rozpočet, knihovna zdrojů),
 *  - podnabídka **Importovat** (celý projekt, činnosti, rozpočet, knihovna zdrojů).
 * Podnabídka se otevře najetím myší, kliknutím, nebo klávesou → / Enter; ← nebo Esc ji zavře.
 * Šipky ↑ / ↓ se pohybují v aktuální nabídce (vzor „menu“ pro klávesnici a čtečky obrazovky).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { openProject, saveProject } from '../io/fileActions'
import { exportCsv, exportXlsx } from '../io/exportActions'
import { exportBudgetCsv, exportBudgetXlsx } from '../io/budgetExportActions'
import { startBudgetImport } from '../io/budgetImportActions'
import { exportWorkbook, startWorkbookImport } from '../io/workbookActions'
import { startImport } from '../io/importActions'
import { exportGanttPng, exportGanttSvg } from '../io/ganttExportActions'
import { exportLibrary, startLibraryImport } from '../io/libraryActions'

type ActionId =
  | 'new'
  | 'open'
  | 'save'
  | 'saveAs'
  | 'print'
  | 'exportGanttSvg'
  | 'exportGanttPng'
  | 'exportWorkbook'
  | 'exportXlsx'
  | 'exportCsv'
  | 'exportBudgetXlsx'
  | 'exportBudgetCsv'
  | 'exportLibrary'
  | 'importWorkbook'
  | 'import'
  | 'importBudget'
  | 'importLibrary'

type SubmenuId = 'export' | 'import'

interface Action {
  id: ActionId
  shortcut?: string
  separatorBefore?: boolean
}

const TOP: (Action | { submenu: SubmenuId; separatorBefore?: boolean })[] = [
  { id: 'new' },
  { id: 'open', shortcut: 'Ctrl+O' },
  { id: 'save', shortcut: 'Ctrl+S' },
  { id: 'saveAs', shortcut: 'Ctrl+Shift+S' },
  { id: 'print', shortcut: 'Ctrl+P', separatorBefore: true },
  { submenu: 'export', separatorBefore: true },
  { submenu: 'import' },
]

const SUBMENUS: Record<SubmenuId, Action[]> = {
  export: [
    { id: 'exportGanttSvg' },
    { id: 'exportGanttPng' },
    { id: 'exportWorkbook', separatorBefore: true },
    { id: 'exportXlsx', separatorBefore: true },
    { id: 'exportCsv' },
    { id: 'exportBudgetXlsx', separatorBefore: true },
    { id: 'exportBudgetCsv' },
    { id: 'exportLibrary', separatorBefore: true },
  ],
  import: [{ id: 'importWorkbook' }, { id: 'import', separatorBefore: true }, { id: 'importBudget' }, { id: 'importLibrary', separatorBefore: true }],
}

const itemClass =
  'flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-sm hover:bg-slate-100 focus:bg-miro-turquoise-light/50 focus:outline-none dark:hover:bg-slate-700 dark:focus:bg-slate-700'
const listClass = 'min-w-56 rounded-md border border-slate-300 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800'
const separatorClass = 'mt-1 border-t border-slate-200 pt-1 dark:border-slate-700'

/** Položky (tlačítka) přímo v dané nabídce – bez položek vnořené podnabídky. */
const itemsOf = (list: HTMLElement | null) => [...(list?.querySelectorAll<HTMLButtonElement>(':scope > li > [role=menuitem]') ?? [])]

export function FileMenu({ onNew, onPrint }: { onNew: () => void; onPrint: () => void }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [submenu, setSubmenu] = useState<SubmenuId | null>(null)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const subRefs = useRef<Record<SubmenuId, HTMLUListElement | null>>({ export: null, import: null })
  const triggerRefs = useRef<Record<SubmenuId, HTMLButtonElement | null>>({ export: null, import: null })

  // Zavřít při kliknutí mimo menu; po otevření zaměřit první položku.
  useEffect(() => {
    if (!open) {
      setSubmenu(null)
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    itemsOf(menuRef.current)[0]?.focus()
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function run(id: ActionId) {
    close()
    if (id === 'new') onNew()
    else if (id === 'print') onPrint()
    else if (id === 'open') void openProject(t)
    else if (id === 'exportGanttSvg') void exportGanttSvg(t, i18n.language)
    else if (id === 'exportGanttPng') void exportGanttPng(t, i18n.language)
    else if (id === 'exportWorkbook') void exportWorkbook(t, i18n.language)
    else if (id === 'importWorkbook') startWorkbookImport(t)
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

  /** Podnabídka otevřená z klávesnice: po vykreslení zaměřit její první položku. */
  const focusFirstRef = useRef(false)
  useEffect(() => {
    if (submenu && focusFirstRef.current) itemsOf(subRefs.current[submenu])[0]?.focus()
    focusFirstRef.current = false
  }, [submenu])

  function openSubmenu(id: SubmenuId, focusFirst: boolean) {
    focusFirstRef.current = focusFirst
    setSubmenu(id)
    // Už otevřená podnabídka se znovu nevykreslí – fokus rovnou.
    if (focusFirst && submenu === id) itemsOf(subRefs.current[id])[0]?.focus()
  }

  function closeSubmenu() {
    const current = submenu
    setSubmenu(null)
    if (current) triggerRefs.current[current]?.focus()
  }

  /** Šipky nahoru / dolů v nabídce, ve které je fokus; → otevře podnabídku, ← / Esc ji zavře. */
  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>, level: 'top' | SubmenuId) {
    const list = event.currentTarget
    const items = itemsOf(list)
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (index === -1) return // fokus je ve vnořené podnabídce – ta si klávesy řeší sama
    const trigger = items[index]?.dataset.submenu as SubmenuId | undefined
    if (event.key === 'ArrowDown') items[(index + 1) % items.length]?.focus()
    else if (event.key === 'ArrowUp') items[(index - 1 + items.length) % items.length]?.focus()
    else if (event.key === 'Home') items[0]?.focus()
    else if (event.key === 'End') items.at(-1)?.focus()
    else if (level === 'top' && trigger && (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ')) openSubmenu(trigger, true)
    else if (level !== 'top' && (event.key === 'ArrowLeft' || event.key === 'Escape')) closeSubmenu()
    else if (level === 'top' && event.key === 'Escape') close()
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  const renderAction = (item: Action) => (
    <li key={item.id} role="none" className={item.separatorBefore ? separatorClass : ''}>
      <button type="button" role="menuitem" onClick={() => run(item.id)} title={t(`file.${item.id}Hint`)} className={itemClass}>
        <span>{t(`file.short.${item.id}`)}</span>
        {item.shortcut && <kbd className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.shortcut}</kbd>}
      </button>
    </li>
  )

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
        <ul ref={menuRef} id={menuId} role="menu" aria-label={t('file.menu')} onKeyDown={(e) => onListKeyDown(e, 'top')} className={`absolute left-0 z-30 mt-1 ${listClass}`}>
          {TOP.map((item) => {
            if (!('submenu' in item)) return renderAction(item)
            const id = item.submenu
            const expanded = submenu === id
            return (
              <li
                key={id}
                role="none"
                className={`relative ${item.separatorBefore ? separatorClass : ''}`}
                // Najetí myší otevře podnabídku (a zavře tu druhou).
                onPointerEnter={(e) => e.pointerType === 'mouse' && setSubmenu(id)}
              >
                <button
                  ref={(el) => {
                    triggerRefs.current[id] = el
                  }}
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={expanded}
                  data-submenu={id}
                  title={t(`file.${id}MenuHint`)}
                  onClick={() => (expanded ? setSubmenu(null) : openSubmenu(id, false))}
                  className={`${itemClass} ${expanded ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                >
                  <span>{t(`file.${id}Menu`)}</span>
                  <span aria-hidden="true" className="text-slate-500 dark:text-slate-400">
                    ▸
                  </span>
                </button>
                {expanded && (
                  <ul
                    ref={(el) => {
                      subRefs.current[id] = el
                    }}
                    role="menu"
                    aria-label={t(`file.${id}Menu`)}
                    onKeyDown={(e) => onListKeyDown(e, id)}
                    className={`absolute left-full top-0 z-40 -mt-1 ml-0.5 ${listClass}`}
                  >
                    {SUBMENUS[id].map(renderAction)}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
