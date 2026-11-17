/** Hlavní okno aplikace: lišta s nástroji, tabulka činností a patička. */
import logoOnLight from '../assets/brand/miro-horizontal-color-on-light.svg'
import logoOnDark from '../assets/brand/miro-horizontal-color-on-dark.svg'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n/languages'
import { formatIsoDate } from '../i18n/format'
import { addSampleTracking, createSampleProject } from '../samples/automatizace'
import { dayToIso, isoToDay } from '../engine/calendar'
import { todayIso } from '../model/dates'
import { projectStore, useBudgetStatus, useCosts, useLoad, usePlanIssues, useProject, useSchedule } from '../store/useProject'
import { formatMoney } from '../model/money'
import { applyTheme, loadThemePreference, saveThemePreference, THEME_PREFERENCES, watchSystemTheme, type ThemePreference } from './theme'
import { CalendarDialog } from './CalendarDialog'
import { useNotice } from './notice'
import { TaskTable } from './TaskTable'
import { SplitView } from './SplitView'
import { GanttChart } from './gantt/GanttChart'
import { ZoomSwitch } from './gantt/ZoomSwitch'
import { BaselineToggle } from './gantt/BaselineToggle'
import { CriticalToggle } from './gantt/CriticalToggle'
import { StructureToolbar } from './StructureToolbar'
import { runStructureCommand, STRUCTURE_COMMANDS, STRUCTURE_SHORTCUTS } from './structureCommands'
import { useSelectedId, useViewState } from './viewState'
import { ShortcutsDialog } from './ShortcutsDialog'
import { GlossaryDialog } from './help/GlossaryDialog'
import { PlanCheckDialog } from './check/PlanCheckDialog'
import { NewProjectDialog } from './NewProjectDialog'
import { WizardDialog } from './WizardDialog'
import { AiDialog, type AiTab } from './ai/AiDialog'
import { FileMenu } from './FileMenu'
import { ImportDialog } from './ImportDialog'
import { BudgetImportDialog } from './costs/BudgetImportDialog'
import { WorkbookImportDialog } from './WorkbookImportDialog'
import { LibraryDialog } from './resources/LibraryDialog'
import { ProjectName } from './ProjectName'
import { isDirty, openProject, saveProject, useFileState } from '../io/fileActions'
import { startAutosave } from '../io/autosaveRunner'
import { deleteSelected, duplicateSelected } from './structureCommands'
import { ResourcesView } from './resources/ResourcesView'
import { AnalysisIcon, CostsIcon, LoadIcon, PlanIcon, ResourcesIcon, TrackingIcon, AiIcon } from './icons'
import { LoadView } from './load/LoadView'
import { CostsView } from './costs/CostsView'
import { AnalysisView } from './analysis/AnalysisView'
import { TrackingView } from './tracking/TrackingView'
import { DetailDock } from './detail/DetailDock'
import { TaskDetailBody, TaskDetailHeader } from './detail/TaskDetail'
import { loadPreference, savePreference } from './preferences'

/** Hlavní pohledy: Plán (tabulka + graf) a Zdroje (databáze, fáze 6a). */
/** O kolik týdnů dřív začíná vzorový projekt (aby bylo co sledovat). */
const SAMPLE_WEEKS_AGO = 8
const VIEWS = ['plan', 'resources', 'load', 'costs', 'analysis', 'tracking'] as const
type View = (typeof VIEWS)[number]

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
  const projectCost = useCosts().project.total
  const budget = useBudgetStatus()
  const budgetOver = (budget.project?.over ?? 0) > 0 || budget.categories.some((c) => c.over > 0)
  const notice = useNotice((s) => s.message)
  const clearNotice = useNotice((s) => s.clear)
  const isInfo = useNotice((s) => s.kind === 'info') && notice !== null
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [checkOpen, setCheckOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiTab, setAiTab] = useState<AiTab>('export')
  const issueCount = usePlanIssues().length
  const fileName = useFileState((s) => s.fileName)
  const dirty = useFileState((s) => s.savedProject) !== project
  const selectedId = useSelectedId(project)
  const selectRow = useViewState((s) => s.select)

  // --- Pohled Plán / Zdroje / Vytížení (pamatuje si ho prohlížeč) ---
  const [view, setViewState] = useState<View>(() => {
    const saved = loadPreference('view')
    return VIEWS.find((v) => v === saved) ?? 'plan'
  })
  // Počet přetížených zdrojů pro odznak na přepínači (počítá se jen jednou pro každou verzi projektu).
  const overloadedCount = useLoad().overloadedCount
  const setView = (next: View) => {
    setViewState(next)
    savePreference('view', next)
  }
  const viewRef = useRef(view)
  viewRef.current = view

  // --- Vzhled (světlý / tmavý) ---
  const [theme, setTheme] = useState<ThemePreference>(loadThemePreference)
  useEffect(() => {
    applyTheme(theme)
    saveThemePreference(theme)
    if (theme !== 'system') return
    return watchSystemTheme(() => applyTheme('system'))
  }, [theme])

  // Po každé změně projektu staré upozornění zmizí (to, které ke změně patří, zůstane).
  useEffect(() => useNotice.getState().clearIfStale(project), [project])

  // --- Klávesové zkratky (G-06), přehled v ShortcutsDialog.tsx ---
  // Posluchač se registruje jednou; přidání činnosti čte aktuální výběr přes ref.
  const addTaskRef = useRef<() => void>(() => {})
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // F1 = přehled zkratek (místo nápovědy prohlížeče).
      if (event.key === 'F1') {
        event.preventDefault()
        setShortcutsOpen(true)
        return
      }
      // Esc mimo pole (a když neruší tažení) zruší hromadný výběr – zůstane aktuální řádek.
      if (event.key === 'Escape' && !event.defaultPrevented && !isEditingField(event.target)) {
        useViewState.getState().clearMultiSelection()
        return
      }
      const ctrl = (event.ctrlKey || event.metaKey) && !event.altKey
      // Ctrl+S (Uložit), Ctrl+Shift+S (Uložit jako), Ctrl+O (Otevřít) – fungují i v poli tabulky;
      // rozepsaný text v poli se nejdřív potvrdí (opuštěním pole), aby se uložil také.
      if (ctrl && (event.key.toLowerCase() === 's' || (event.key.toLowerCase() === 'o' && !event.shiftKey))) {
        event.preventDefault() // jinak by prohlížeč ukládal / otevíral stránku
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        if (event.key.toLowerCase() === 'o') void openProject(i18n.t)
        else void saveProject(i18n.t, event.shiftKey)
        return
      }
      // Zkratky pro řádky plánu platí jen v pohledu Plán (ve Zdrojích by měnily skrytou tabulku).
      const inPlan = viewRef.current === 'plan'
      // Ctrl+Enter a Ctrl+D fungují i v poli tabulky (při psaní se nepoužívají).
      if (inPlan && ctrl && !event.shiftKey && event.key === 'Enter') {
        event.preventDefault()
        addTaskRef.current()
        return
      }
      if (inPlan && ctrl && !event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault() // jinak by prohlížeč přidal záložku
        duplicateSelected(i18n.t)
        return
      }
      // Ctrl+Delete jen mimo textové pole – v poli maže slovo za kurzorem.
      if (inPlan && ctrl && !event.shiftKey && event.key === 'Delete' && !isEditingField(event.target)) {
        event.preventDefault()
        deleteSelected(i18n.t)
        return
      }
      // Alt+Shift+šipky fungují i v poli tabulky – při psaní se tahle kombinace nepoužívá.
      if (inPlan && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
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

  // Automatická záloha v prohlížeči: po otevření obnoví rozpracovaný projekt, pak průběžně zálohuje (I-02).
  useEffect(() => {
    void startAutosave(i18n.t, i18n.language)
  }, [i18n])

  // Zavření záložky s neuloženými změnami → prohlížeč se zeptá (N-08).
  // (Text otázky určuje prohlížeč, vlastní text už prohlížeče nezobrazují.)
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

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
  addTaskRef.current = handleAddTask

  function handleLoadSample() {
    // Varování před nahrazením plánu (N-08). Prázdný projekt není co ztratit.
    if (project.tasks.length > 0 && !window.confirm(t('sample.confirmReplace'))) return
    // Vzorový projekt „v běhu“ (fáze 9): začal před 8 týdny, má baseline, % hotovo a skutečné náklady.
    const today = todayIso()
    const sample = createSampleProject((key) => t(key), i18n.language, dayToIso(isoToDay(today) - SAMPLE_WEEKS_AGO * 7))
    addSampleTracking(sample, (key) => t(key), today)
    loadProject(sample)
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        {/* 1. řádek: logo vlevo, jazyk a vzhled vpravo na stejné úrovni. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="mr-auto">
            {/* Logo značky MiRo project (varianta pro světlé / tmavé pozadí). */}
            <h1 className="flex items-center">
              <img src={logoOnLight} alt={t('app.title')} className="h-8 w-auto dark:hidden" />
              <img src={logoOnDark} alt={t('app.title')} className="hidden h-8 w-auto dark:block" />
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
        </div>
        {/* 2. řádek: údaje o projektu (název, soubor, termíny, náklady a limit). */}
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          <ProjectName />
          {fileName && <span title={t('file.fileNameHint')}> ({fileName})</span>}
          {dirty && (
            <span className="ml-1 font-medium text-slate-800 dark:text-slate-100" title={t('file.unsavedHint')}>
              <span aria-hidden="true" className="text-miro-gold dark:text-miro-yellow">● </span>
              {t('file.unsaved')}
            </span>
          )}
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
          {projectCost > 0 && (
            <>
              {' · '}
              <span
                title={budgetOver ? t('project.budgetOverHint') : t('project.costHint')}
                className={budgetOver ? 'font-semibold text-red-700 dark:text-red-300' : undefined}
              >
                {budgetOver && <span aria-hidden="true">⚠ </span>}
                {budget.project
                  ? t('project.costOfLimit', {
                      amount: formatMoney(projectCost, project.currency, i18n.language),
                      limit: formatMoney(budget.project.limit, project.currency, i18n.language),
                    })
                  : t('project.cost', { amount: formatMoney(projectCost, project.currency, i18n.language) })}
                {budgetOver && <span className="sr-only"> {t('project.budgetOverHint')}</span>}
              </span>
            </>
          )}
        </p>
        <div role="toolbar" aria-label={t('toolbar.label')} className="mt-2 flex flex-wrap gap-2">
          <div role="group" aria-label={t('view.label')} className="flex rounded-md border border-slate-300 p-0.5 dark:border-slate-600">
            {VIEWS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => setView(id)}
                title={t(`view.${id}Hint`)}
                className={`inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  view === id ? 'bg-miro-graphite text-miro-paper dark:bg-miro-paper dark:text-miro-graphite' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {id === 'plan' ? <PlanIcon /> : id === 'resources' ? <ResourcesIcon /> : id === 'load' ? <LoadIcon /> : id === 'costs' ? <CostsIcon /> : id === 'analysis' ? <AnalysisIcon /> : <TrackingIcon />}
                {t(`view.${id}`)}
                {id === 'load' && overloadedCount > 0 && (
                  <span
                    className="ml-0.5 rounded-full bg-red-600 px-1.5 text-xs font-semibold leading-5 text-white dark:bg-red-500"
                    title={t('load.overloadedBadge', { count: overloadedCount })}
                  >
                    {overloadedCount}
                    <span className="sr-only"> {t('load.overloadedBadge', { count: overloadedCount })}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
          <FileMenu onNew={() => setNewOpen(true)} />
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
          {/* Kontrola kvality plánu (U-04): počet varování žlutě, bez varování ✓. */}
          <button type="button" className="btn-secondary" onClick={() => setCheckOpen(true)} title={t('toolbar.checkHint')}>
            <span aria-hidden="true">🔍</span> {t('toolbar.check')}
            {project.tasks.length > 0 &&
              (issueCount > 0 ? (
                <span className="ml-0.5 rounded-full bg-miro-yellow px-1.5 text-xs font-semibold leading-5 text-miro-graphite">
                  <span aria-hidden="true">{issueCount}</span>
                  <span className="sr-only">{t('toolbar.checkCount', { count: issueCount })}</span>
                </span>
              ) : (
                <span className="ml-0.5 text-miro-turquoise-dark dark:text-miro-turquoise">
                  <span aria-hidden="true">✓</span>
                  <span className="sr-only">{t('toolbar.checkOk')}</span>
                </span>
              ))}
          </button>
          {/* Napojení na AI (fáze 11): export projektu a plán z popisu – nic se neposílá samo. */}
          <button type="button" className="btn-secondary" onClick={() => (setAiTab('export'), setAiOpen(true))} title={t('toolbar.aiHint')}>
            <AiIcon /> {t('toolbar.ai')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShortcutsOpen(true)} title={t('toolbar.shortcutsHint')}>
            <span aria-hidden="true">⌨</span> {t('toolbar.shortcuts')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setGlossaryOpen(true)} title={t('toolbar.glossaryHint')}>
            <span aria-hidden="true">📖</span> {t('toolbar.glossary')}
          </button>
          {/* Druhá řada pohledu Plán: přidání činnosti a úpravy struktury, vpravo kritická cesta a měřítko. */}
          {view === 'plan' && (
            <div className="flex w-full flex-wrap items-center gap-2">
              <button type="button" className="btn-primary" onClick={handleAddTask}>
                <span aria-hidden="true">＋</span> {t('toolbar.addTask')}
              </button>
              {project.tasks.length > 0 && <StructureToolbar />}
              {project.tasks.length > 0 && (
                <div className="ml-auto flex flex-wrap gap-2">
                  <CriticalToggle />
                  <BaselineToggle />
                  <ZoomSwitch />
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Upozornění (chybný zápis, nespočitatelné termíny) – čtečka obrazovky ho přečte hned. */}
      <div aria-live="assertive">
        {(notice ?? (scheduleError ? t(`schedule.${scheduleError}`) : null)) && (
          <div
            className={`flex items-start justify-between gap-3 border-b border-b-slate-300 px-4 py-2 text-sm dark:border-b-slate-700 ${
              isInfo
                ? 'border-l-4 border-l-miro-turquoise-dark bg-white text-slate-800 dark:border-l-miro-turquoise dark:bg-slate-800 dark:text-slate-100'
                : 'border-l-4 border-l-miro-gold bg-miro-yellow-light/50 text-miro-graphite dark:border-l-miro-yellow dark:bg-slate-800 dark:text-miro-yellow-light'
            }`}
          >
            <p>
              <span aria-hidden="true">{isInfo ? 'ℹ ' : '⚠ '}</span>
              {notice ?? t(`schedule.${scheduleError}`)}
            </p>
            {notice && (
              <button
                type="button"
                onClick={clearNotice}
                aria-label={t('notice.close')}
                className="rounded px-2 hover:bg-slate-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-slate-100/10"
              >
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>
        )}
      </div>
      <CalendarDialog open={calendarOpen} onClose={() => setCalendarOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <GlossaryDialog open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
      <NewProjectDialog open={newOpen} onClose={() => setNewOpen(false)} onWizard={() => setWizardOpen(true)} onAi={() => (setAiTab('plan'), setAiOpen(true))} />
      <WizardDialog open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <AiDialog open={aiOpen} onClose={() => setAiOpen(false)} initialTab={aiTab} />
      <PlanCheckDialog open={checkOpen} onClose={() => setCheckOpen(false)} onShowView={setView} />
      <ImportDialog />
      <BudgetImportDialog />
      <WorkbookImportDialog />
      <LibraryDialog />

      {view === 'resources' ? (
        <main className="min-h-0 flex-1">
          <ResourcesView />
        </main>
      ) : view === 'load' ? (
        <main className="min-h-0 flex-1">
          <LoadView onShowPlan={() => setView('plan')} />
        </main>
      ) : view === 'costs' ? (
        <main className="min-h-0 flex-1">
          <CostsView />
        </main>
      ) : view === 'analysis' ? (
        <main className="min-h-0 flex-1">
          <AnalysisView />
        </main>
      ) : view === 'tracking' ? (
        <main className="min-h-0 flex-1">
          <TrackingView />
        </main>
      ) : project.tasks.length === 0 ? (
        // Prázdný projekt: jen uvítání přes celou šířku, graf by byl prázdný.
        <main className="flex-1 overflow-auto">
          <TaskTable onAddTask={handleAddTask} onLoadSample={handleLoadSample} onWizard={() => setWizardOpen(true)} onNewProject={() => setNewOpen(true)} />
        </main>
      ) : (
        <main className="min-h-0 flex-1">
          <DetailDock
            plan={<SplitView left={<TaskTable onAddTask={handleAddTask} onLoadSample={handleLoadSample} onWizard={() => setWizardOpen(true)} onNewProject={() => setNewOpen(true)} />} right={<GanttChart />} />}
            header={<TaskDetailHeader />}
          >
            <TaskDetailBody />
          </DetailDock>
        </main>
      )}

      <footer className="border-t border-slate-200 px-4 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <span aria-hidden="true">🔒 </span>
        {t('app.privacy')} {t('app.notSavedYet')}
      </footer>
    </div>
  )
}
