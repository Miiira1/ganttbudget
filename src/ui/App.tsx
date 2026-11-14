/** Hlavní okno aplikace: lišta s nástroji, tabulka činností a patička. */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n/languages'
import { formatIsoDate } from '../i18n/format'
import { createSampleProject } from '../samples/automatizace'
import { projectStore, useProject, useSchedule } from '../store/useProject'
import { applyTheme, loadThemePreference, saveThemePreference, THEME_PREFERENCES, watchSystemTheme, type ThemePreference } from './theme'
import { CalendarDialog } from './CalendarDialog'
import { useNotice } from './notice'
import { TaskTable } from './TaskTable'
import { SplitView } from './SplitView'
import { GanttChart } from './gantt/GanttChart'
import { ZoomSwitch } from './gantt/ZoomSwitch'
import { StructureToolbar } from './StructureToolbar'
import { runStructureCommand, STRUCTURE_COMMANDS, STRUCTURE_SHORTCUTS } from './structureCommands'
import { useSelectedId, useViewState } from './viewState'

/** Je kurzor v textovém poli? Tam necháme Ctrl+Z prohlížeči (vrací psaní v poli). */
function isEditingField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

export default function App() {
  const { t, i18n } = useTranslation()
  const project = useProject((s) => s.project)
  const canUndo = useProject((s) => s.past.length > 0)
  const canRedo = useProject((s) => s.future.length > 0)
  const { addTask, undo, redo, loadProject } = projectStore.getState()
  const { projectFinish, error: scheduleError } = useSchedule()
  const notice = useNotice((s) => s.message)
  const clearNotice = useNotice((s) => s.clear)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const selectedId = useSelectedId(project)
  const selectRow = useViewState((s) => s.select)

  // --- Vzhled (světlý / tmavý) ---
  const [theme, setTheme] = useState<ThemePreference>(loadThemePreference)
  useEffect(() => {
    applyTheme(theme)
    saveThemePreference(theme)
    if (theme !== 'system') return
    return watchSystemTheme(() => applyTheme('system'))
  }, [theme])

  // Po každé úspěšné změně projektu staré upozornění zmizí.
  useEffect(() => clearNotice(), [project, clearNotice])

  // --- Klávesové zkratky: Alt+Shift+šipky (struktura plánu), Ctrl+Z / Ctrl+Y (Zpět / Znovu) ---
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Alt+Shift+šipky fungují i v poli tabulky – při psaní se tahle kombinace nepoužívá.
      if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
        const command = STRUCTURE_COMMANDS.find((c) => STRUCTURE_SHORTCUTS[c] === event.key)
        if (command) {
          event.preventDefault()
          runStructureCommand(command, i18n.t)
          return
        }
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isEditingField(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        projectStore.getState().undo()
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault()
        projectStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [i18n])

  function handleAddTask() {
    // Nová činnost přijde pod vybraný řádek (na stejnou úroveň) a sama se vybere.
    const id = addTask(t('task.defaultName'), 'task', selectedId)
    selectRow(id)
    // Kurzor rovnou do názvu nové činnosti, ať se dá hned psát.
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLInputElement>(`[data-task-id="${CSS.escape(id)}"] input[type="text"]`)
      row?.focus()
      row?.select()
    })
  }

  function handleLoadSample() {
    // Varování před nahrazením plánu (N-08). Prázdný projekt není co ztratit.
    if (project.tasks.length > 0 && !window.confirm(t('sample.confirmReplace'))) return
    loadProject(createSampleProject((key) => t(key), i18n.language))
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="mr-auto">
            <h1 className="text-lg font-bold">
              {t('app.title')} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">· {t('app.tagline')}</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-800 dark:text-slate-200">{project.name}</span>
              {' · '}
              {t('project.start', { date: formatIsoDate(project.startDate, i18n.language) })}
              {' · '}
              {projectFinish && (
                <>
                  {t('project.finish', { date: formatIsoDate(projectFinish, i18n.language) })}
                  {' · '}
                </>
              )}
              {t('project.taskCount', { count: project.tasks.length })}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            {t('toolbar.language')}
            <select className="field-select" value={i18n.language} onChange={(e) => void i18n.changeLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.translation.meta.languageName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            {t('toolbar.theme')}
            <select className="field-select" value={theme} onChange={(e) => setTheme(e.target.value as ThemePreference)}>
              {THEME_PREFERENCES.map((p) => (
                <option key={p} value={p}>
                  {t(`theme.${p}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div role="toolbar" aria-label={t('toolbar.label')} className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={handleAddTask}>
            <span aria-hidden="true">＋</span> {t('toolbar.addTask')}
          </button>
          <button type="button" className="btn-secondary" onClick={undo} disabled={!canUndo} title={t('toolbar.undoHint')}>
            <span aria-hidden="true">↶</span> {t('toolbar.undo')}
          </button>
          <button type="button" className="btn-secondary" onClick={redo} disabled={!canRedo} title={t('toolbar.redoHint')}>
            <span aria-hidden="true">↷</span> {t('toolbar.redo')}
          </button>
          <button type="button" className="btn-secondary" onClick={handleLoadSample} title={t('toolbar.loadSampleHint')}>
            {t('toolbar.loadSample')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setCalendarOpen(true)} title={t('toolbar.calendarHint')}>
            <span aria-hidden="true">📅</span> {t('toolbar.calendar')}
          </button>
          {project.tasks.length > 0 && <StructureToolbar />}
          {project.tasks.length > 0 && (
            <div className="ml-auto">
              <ZoomSwitch />
            </div>
          )}
        </div>
      </header>

      {/* Upozornění (chybný zápis, nespočitatelné termíny) – čtečka obrazovky ho přečte hned. */}
      <div aria-live="assertive">
        {(notice ?? (scheduleError ? t(`schedule.${scheduleError}`) : null)) && (
          <div className="flex items-start justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <p>
              <span aria-hidden="true">⚠ </span>
              {notice ?? t(`schedule.${scheduleError}`)}
            </p>
            {notice && (
              <button
                type="button"
                onClick={clearNotice}
                aria-label={t('notice.close')}
                className="rounded px-2 hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:hover:bg-amber-900"
              >
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>
        )}
      </div>
      <CalendarDialog open={calendarOpen} onClose={() => setCalendarOpen(false)} />

      {project.tasks.length === 0 ? (
        // Prázdný projekt: jen uvítání přes celou šířku, graf by byl prázdný.
        <main className="flex-1 overflow-auto">
          <TaskTable onAddTask={handleAddTask} onLoadSample={handleLoadSample} />
        </main>
      ) : (
        <main className="min-h-0 flex-1">
          <SplitView left={<TaskTable onAddTask={handleAddTask} onLoadSample={handleLoadSample} />} right={<GanttChart />} />
        </main>
      )}

      <footer className="border-t border-slate-200 px-4 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <span aria-hidden="true">🔒 </span>
        {t('app.privacy')} {t('app.notSavedYet')}
      </footer>
    </div>
  )
}
