/** Hlavní okno aplikace: lišta s nástroji, tabulka činností a patička. */
import logoOnLight from '../assets/brand/miro-horizontal-color-on-light.svg'
import logoOnDark from '../assets/brand/miro-horizontal-color-on-dark.svg'
import { Suspense, useDeferredValue, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n/languages'
import { formatIsoDate } from '../i18n/format'
import { dayToIso, isoToDay } from '../engine/calendar'
import { todayIso } from '../model/dates'
import { getBudgetStatus, getLoad, getPlanIssues, projectStore, useCosts, useProject, useSchedule } from '../store/useProject'
import { formatMoney } from '../model/money'
import { applyTheme, loadThemePreference, saveThemePreference, THEME_PREFERENCES, watchSystemTheme, type ThemePreference } from './theme'
import { showNotice, useNotice } from './notice'
import { TaskTable } from './TaskTable'
import { SplitView } from './SplitView'
import { GanttChart } from './gantt/GanttChart'
import { ZoomSwitch } from './gantt/ZoomSwitch'
import { BaselineToggle } from './gantt/BaselineToggle'
import { CriticalToggle } from './gantt/CriticalToggle'
import { BarLabelsMenu } from './gantt/BarLabelsMenu'
import { StructureToolbar } from './StructureToolbar'
import { runStructureCommand, STRUCTURE_COMMANDS, STRUCTURE_SHORTCUTS } from './structureCommands'
import { useSelectedId, useViewState } from './viewState'
import type { AiTab } from './ai/AiDialog'
import { DisplaySettings, HelpMenu } from './HeaderMenus'
import { FileMenu } from './FileMenu'
import { ProjectName } from './ProjectName'
import { isDirty, loadSampleProject, openProject, saveProject, useFileState } from '../io/fileActions'
import { useImportState } from '../io/importActions'
import { useBudgetImportState } from '../io/budgetImportActions'
import { useWorkbookImportState } from '../io/workbookActions'
import { useLibraryState } from '../io/libraryActions'
import { startAutosave } from '../io/autosaveRunner'
import { deleteSelected, duplicateSelected } from './structureCommands'
import { afterTaskShown } from './revealTask'
import { AnalysisIcon, CostsIcon, LoadIcon, PlanIcon, ResourcesIcon, TrackingIcon, AiIcon, MindMapIcon } from './icons'
import { DetailDock } from './detail/DetailDock'
import { TaskDetailBody, TaskDetailHeader } from './detail/TaskDetail'
import { loadPreference, savePreference } from './preferences'
import { mobileView } from './mobile/layout'
// Pohledy, dialogy a mobilní verze se stahují až při prvním použití (audit R7).
import {
  AiDialog,
  AnalysisView,
  BudgetImportDialog,
  CalendarDialog,
  CostsView,
  GlossaryDialog,
  ImportDialog,
  LazyView,
  LibraryDialog,
  LoadView,
  MindMapView,
  MobilePlan,
  MobileShell,
  MountWhenNeeded,
  NewProjectDialog,
  PlanCheckDialog,
  PrintDialog,
  ResourcesView,
  ShortcutsDialog,
  TrackingView,
  ViewLoading,
  WizardDialog,
  WorkbookImportDialog,
} from './lazyParts'
import { useLayoutMode } from './mobile/useLayoutMode'

/** Hlavní pohledy: Plán (tabulka + graf) a Zdroje (databáze, fáze 6a). */
/** O kolik týdnů dřív začíná vzorový projekt (aby bylo co sledovat). */
const SAMPLE_WEEKS_AGO = 8
const VIEWS = ['plan', 'resources', 'load', 'costs', 'analysis', 'tracking', 'mindmap'] as const
type View = (typeof VIEWS)[number]

/** Je kurzor v textovém poli? Tam necháme Ctrl+Z prohlížeči (vrací psaní v poli). */
function isEditingField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

/** Cíl odkazu „Přeskočit na obsah“ – hlavní oblast aktuálního pohledu. */
const MAIN_ID = 'obsah'

export default function App() {
  const { t, i18n } = useTranslation()
  const project = useProject((s) => s.project)
  const canUndo = useProject((s) => s.past.length > 0)
  const canRedo = useProject((s) => s.future.length > 0)
  const { addTask, undo, redo } = projectStore.getState()
  const { projectFinish, error: scheduleError } = useSchedule()
  const projectCost = useCosts().project.total
  // Odznaky v záhlaví (rozpočet, přetížení, kontrola plánu) potřebují náběh nákladů a vytížení –
  // u velkého plánu desítky ms. Počítají se z „odložené“ verze projektu: React nejdřív ukáže
  // samotnou změnu a odznaky dopočítá hned potom (audit R4).
  const deferredProject = useDeferredValue(project)
  const budget = getBudgetStatus(deferredProject)
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
  const [printOpen, setPrintOpen] = useState(false)
  const [aiTab, setAiTab] = useState<AiTab>('export')
  const issueCount = getPlanIssues(deferredProject).length
  const fileName = useFileState((s) => s.fileName)
  const dirty = useFileState((s) => s.savedProject) !== project
  const selectedId = useSelectedId(project)
  const selectRow = useViewState((s) => s.select)
  const layout = useLayoutMode()
  // Čeká import na potvrzení v dialogu? (Teprve pak se dialog stáhne.)
  const importPending = useImportState((s) => s.pending !== null)
  const budgetImportPending = useBudgetImportState((s) => s.pending !== null)
  const workbookImportPending = useWorkbookImportState((s) => s.pending !== null)
  const libraryPending = useLibraryState((s) => s.pending !== null)
  // Patička s informací o datech: skrytí si pamatuje prohlížeč.
  const [privacyHidden, setPrivacyHiddenState] = useState(() => loadPreference('privacyHidden') === 'true')
  const setPrivacyHidden = (hidden: boolean) => {
    setPrivacyHiddenState(hidden)
    savePreference('privacyHidden', String(hidden))
  }

  // --- Pohled Plán / Zdroje / Vytížení (pamatuje si ho prohlížeč) ---
  const [view, setViewState] = useState<View>(() => {
    const saved = loadPreference('view')
    return VIEWS.find((v) => v === saved) ?? 'plan'
  })
  // Počet přetížených zdrojů pro odznak na přepínači (počítá se jen jednou pro každou verzi projektu).
  const overloadedCount = getLoad(deferredProject).overloadedCount
  const setView = (next: View) => {
    setViewState(next)
    savePreference('view', next)
  }
  const viewRef = useRef(view)
  viewRef.current = view
  const mobileRef = useRef(layout.mobile)
  mobileRef.current = layout.mobile

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
        // Mobilní verze přehled zkratek ani tisk nemá – klávesu necháme prohlížeči (audit U25).
        if (mobileRef.current) return
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
      // Ctrl+P = okno Tisk / PDF Ganttova diagramu (místo tisku celé obrazovky aplikace).
      if (ctrl && !event.shiftKey && event.key.toLowerCase() === 'p' && !mobileRef.current) {
        event.preventDefault()
        setPrintOpen(true)
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
    // Kurzor rovnou do názvu nové činnosti, ať se dá hned psát. U velkého plánu se nejdřív
    // posune k řádku – mimo okno by nebyl vykreslený (audit R3).
    afterTaskShown(id, () => {
      const row = document.querySelector<HTMLInputElement>(`[data-task-id="${CSS.escape(id)}"] input[type="text"]`)
      row?.focus()
      row?.select()
    })
  }
  addTaskRef.current = handleAddTask

  async function handleLoadSample() {
    // Varování před nahrazením plánu (N-08). Prázdný projekt není co ztratit.
    if (project.tasks.length > 0 && !window.confirm(t('sample.confirmReplace'))) return
    // Vzorový projekt se stáhne až teď (audit R7).
    const { addSampleTracking, createSampleProject } = await import('../samples/automatizace')
    // Vzorový projekt „v běhu“ (fáze 9): začal před 8 týdny, má baseline, % hotovo a skutečné náklady.
    const today = todayIso()
    const sample = createSampleProject((key) => t(key), i18n.language, dayToIso(isoToDay(today) - SAMPLE_WEEKS_AGO * 7))
    addSampleTracking(sample, (key) => t(key), today)
    // Odpojí od otevřeného souboru – Ctrl+S pak nepřepíše původní soubor vzorem (audit V1).
    loadSampleProject(sample)
  }

  // Upozornění (chybný zápis, nespočitatelné termíny) – čtečka obrazovky ho přečte hned;
  // informační hlášky („obnoveno ze zálohy“) až domluví a nepřeruší uživatele (audit U26).
  const noticeBar = (
    <div aria-live={isInfo ? 'polite' : 'assertive'}>
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
  )

  // --- Mobilní verze (displej pod 768 px): jen prohlížení, spodní lišta pohledů ---
  const projectMeta = [
    t('project.start', { date: formatIsoDate(project.startDate, i18n.language) }),
    projectFinish ? t('project.finish', { date: formatIsoDate(projectFinish, i18n.language) }) : null,
    projectCost > 0 ? t('project.cost', { amount: formatMoney(projectCost, project.currency, i18n.language) }) : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const displaySettings = (
    <>
      <label className="flex items-center justify-between gap-3 text-sm">
        {t('toolbar.language')}
        <select className="field-select" value={i18n.language} onChange={(e) => void i18n.changeLanguage(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.translation.meta.languageName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        {t('toolbar.theme')}
        <select className="field-select" value={theme} onChange={(e) => setTheme(e.target.value as ThemePreference)}>
          {THEME_PREFERENCES.map((pref) => (
            <option key={pref} value={pref}>
              {t(`theme.${pref}`)}
            </option>
          ))}
        </select>
      </label>
    </>
  )
  if (layout.mobile) {
    const shown = mobileView(view)
    return (
      <Suspense fallback={<ViewLoading />}>
        <MobileShell
          projectName={project.name}
          meta={projectMeta}
          dirty={dirty}
          view={shown}
          onView={setView}
          settings={displaySettings}
          notice={noticeBar}
          menuItems={[
            { id: 'open', label: t('mobile.open'), icon: '📂', onSelect: () => void openProject(t) },
            { id: 'sample', label: t('toolbar.loadSample'), icon: '🧪', onSelect: () => void handleLoadSample() },
            { id: 'glossary', label: t('toolbar.glossary'), icon: '📖', onSelect: () => setGlossaryOpen(true) },
            { id: 'privacy', label: t('app.privacyMenu'), icon: '🔒', onSelect: () => showNotice(`${t('app.privacy')} ${t('app.notSavedYet')}`, 'info') },
            { id: 'full', label: t('mobile.fullVersion'), icon: '🖥', onSelect: () => layout.setPreference('full') },
          ]}
        >
          <LazyView>
            {shown === 'costs' ? (
              <CostsView />
            ) : shown === 'tracking' ? (
              <TrackingView />
            ) : shown === 'analysis' ? (
              <AnalysisView />
            ) : shown === 'mindmap' ? (
              <MindMapView onShowPlan={() => setView('plan')} />
            ) : (
              <MobilePlan />
            )}
          </LazyView>
        </MobileShell>
        <MountWhenNeeded active={glossaryOpen}>
          <GlossaryDialog open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
        </MountWhenNeeded>
      </Suspense>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      {/* „Přeskočit na obsah“ (13d – přístupnost): první zastávka klávesy Tab, vidět jen při fokusu. */}
      <a
        href={`#${MAIN_ID}`}
        onClick={(e) => {
          e.preventDefault()
          document.getElementById(MAIN_ID)?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-miro-yellow focus:px-3 focus:py-2 focus:font-medium focus:text-miro-graphite focus:outline-none focus:ring-2 focus:ring-focus"
      >
        {t('a11y.skipToContent')}
      </a>
      {/*
        Záhlaví (brand 2.0 – přehlednost): 1. řada = logo, projekt a akce celé aplikace,
        2. řada = přepínač pohledů, 3. řada jen v Plánu = nástroje plánu.
      */}
      <header className="border-b border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-2 pt-3">
          {/* Logo značky MiRo project (varianta pro světlé / tmavé pozadí). */}
          <h1 className="flex shrink-0 items-center">
            <img src={logoOnLight} alt={t('app.title')} className="h-7 w-auto dark:hidden" />
            <img src={logoOnDark} alt={t('app.title')} className="hidden h-7 w-auto dark:block" />
          </h1>
          <span aria-hidden="true" className="hidden h-6 w-px bg-slate-300 sm:block dark:bg-slate-600" />
          {/* Projekt: název (kliknutím přejmenovat), neuložené změny a stručné údaje. */}
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-baseline gap-2 text-sm">
              <ProjectName />
              {fileName && (
                <span className="truncate text-slate-500 dark:text-slate-400" title={t('file.fileNameHint')}>
                  {fileName}
                </span>
              )}
              {dirty && (
                <span className="shrink-0 font-medium text-slate-800 dark:text-slate-100" title={t('file.unsavedHint')}>
                  <span aria-hidden="true" className="text-miro-gold dark:text-miro-yellow">● </span>
                  {t('file.unsaved')}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-slate-600 dark:text-slate-400">
              {t('project.start', { date: formatIsoDate(project.startDate, i18n.language) })}
              {projectFinish && <> · {t('project.finish', { date: formatIsoDate(projectFinish, i18n.language) })}</>}
              {' · '}
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
          </div>
          {/* Akce celé aplikace. */}
          <div role="toolbar" aria-label={t('toolbar.label')} className="flex flex-wrap items-center gap-2">
            <FileMenu onNew={() => setNewOpen(true)} onPrint={() => setPrintOpen(true)} />
            <div className="flex">
              <button
                type="button"
                className="btn-secondary rounded-r-none px-2.5"
                onClick={undo}
                disabled={!canUndo}
                aria-label={t('toolbar.undo')}
                title={t('toolbar.undoHint')}
              >
                <span aria-hidden="true">↶</span>
                {/* Na širší obrazovce i text – hlášky radí „tlačítkem Zpět“ (audit U16). */}
                <span aria-hidden="true" className="ml-1 hidden 2xl:inline">
                  {t('toolbar.undo')}
                </span>
              </button>
              <button
                type="button"
                className="btn-secondary -ml-px rounded-l-none px-2.5"
                onClick={redo}
                disabled={!canRedo}
                aria-label={t('toolbar.redo')}
                title={t('toolbar.redoHint')}
              >
                <span aria-hidden="true">↷</span>
                <span aria-hidden="true" className="ml-1 hidden 2xl:inline">
                  {t('toolbar.redo')}
                </span>
              </button>
            </div>
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
            <HelpMenu
              items={[
                { id: 'shortcuts', label: t('toolbar.shortcuts'), icon: '⌨', shortcut: 'F1', onSelect: () => setShortcutsOpen(true) },
                { id: 'glossary', label: t('toolbar.glossary'), icon: '📖', onSelect: () => setGlossaryOpen(true) },
                { id: 'wizard', label: t('toolbar.wizard'), icon: '🧭', onSelect: () => setWizardOpen(true) },
                // Vzorový projekt má všude 🧪; 📂 patří jen k „Otevřít“ (audit U19).
                { id: 'sample', label: t('toolbar.loadSample'), icon: '🧪', onSelect: () => void handleLoadSample() },
                { id: 'privacy', label: t('app.privacyMenu'), icon: '🔒', onSelect: () => setPrivacyHidden(false) },
                ...(layout.narrow ? [{ id: 'mobile', label: t('mobile.mobileVersion'), icon: '📱', onSelect: () => layout.setPreference('auto') }] : []),
              ]}
            />
            <DisplaySettings>{displaySettings}</DisplaySettings>
          </div>
        </div>
        {/* 2. řada: přepínač pohledů (záložky). */}
        <nav aria-label={t('view.label')} className="flex gap-1 overflow-x-auto px-4">
          {VIEWS.map((id) => (
            <button
              key={id}
              type="button"
              aria-current={view === id ? 'page' : undefined}
              onClick={() => setView(id)}
              title={t(`view.${id}Hint`)}
              // Aktivní pohled: žlutá čára (3 px) a jemný žlutý podklad – výrazné, ale klidné; váha písma stejná, nic neposkočí.
              className={`-mb-px inline-flex shrink-0 items-center gap-1.5 rounded-t-md border-b-[3px] px-3 pb-2 pt-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${
                view === id
                  ? 'border-miro-yellow bg-miro-yellow-light/45 text-miro-graphite dark:bg-miro-yellow/15 dark:text-miro-paper'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
              }`}
            >
              {id === 'plan' ? <PlanIcon /> : id === 'resources' ? <ResourcesIcon /> : id === 'load' ? <LoadIcon /> : id === 'costs' ? <CostsIcon /> : id === 'analysis' ? <AnalysisIcon /> : id === 'tracking' ? <TrackingIcon /> : <MindMapIcon />}
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
        </nav>
      </header>
      {/* 3. řada jen v Plánu: přidání činnosti a úpravy struktury, vpravo kritická cesta, baseline a měřítko. */}
      {view === 'plan' && (
        <div role="toolbar" aria-label={t('toolbar.planTools')} className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
          <button type="button" className="btn-primary" onClick={handleAddTask}>
            <span aria-hidden="true">＋</span> {t('toolbar.addTask')}
          </button>
          {project.tasks.length > 0 && <StructureToolbar />}
          {project.tasks.length > 0 && (
            <div className="ml-auto flex flex-wrap gap-2">
              <CriticalToggle />
              <BaselineToggle />
              <BarLabelsMenu />
              <ZoomSwitch />
            </div>
          )}
        </div>
      )}

      {noticeBar}
      {/* Dialogy se stáhnou až při prvním otevření a pak zůstanou připravené (audit R7). */}
      <MountWhenNeeded active={calendarOpen}>
        <CalendarDialog open={calendarOpen} onClose={() => setCalendarOpen(false)} />
      </MountWhenNeeded>
      <MountWhenNeeded active={shortcutsOpen}>
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </MountWhenNeeded>
      <MountWhenNeeded active={glossaryOpen}>
        <GlossaryDialog open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
      </MountWhenNeeded>
      <MountWhenNeeded active={newOpen}>
        <NewProjectDialog open={newOpen} onClose={() => setNewOpen(false)} onWizard={() => setWizardOpen(true)} onAi={() => (setAiTab('plan'), setAiOpen(true))} />
      </MountWhenNeeded>
      <MountWhenNeeded active={wizardOpen}>
        <WizardDialog open={wizardOpen} onClose={() => setWizardOpen(false)} />
      </MountWhenNeeded>
      <MountWhenNeeded active={printOpen}>
        <PrintDialog open={printOpen} onClose={() => setPrintOpen(false)} />
      </MountWhenNeeded>
      <MountWhenNeeded active={aiOpen}>
        <AiDialog open={aiOpen} onClose={() => setAiOpen(false)} initialTab={aiTab} />
      </MountWhenNeeded>
      <MountWhenNeeded active={checkOpen}>
        <PlanCheckDialog open={checkOpen} onClose={() => setCheckOpen(false)} onShowView={setView} />
      </MountWhenNeeded>
      <MountWhenNeeded active={importPending}>
        <ImportDialog />
      </MountWhenNeeded>
      <MountWhenNeeded active={budgetImportPending}>
        <BudgetImportDialog />
      </MountWhenNeeded>
      <MountWhenNeeded active={workbookImportPending}>
        <WorkbookImportDialog />
      </MountWhenNeeded>
      <MountWhenNeeded active={libraryPending}>
        <LibraryDialog />
      </MountWhenNeeded>

      {view !== 'plan' ? (
        <main id={MAIN_ID} tabIndex={-1} className="focus:outline-none min-h-0 flex-1">
          <LazyView>
            {view === 'resources' ? (
              <ResourcesView />
            ) : view === 'load' ? (
              <LoadView onShowPlan={() => setView('plan')} />
            ) : view === 'costs' ? (
              <CostsView />
            ) : view === 'analysis' ? (
              <AnalysisView />
            ) : view === 'tracking' ? (
              <TrackingView />
            ) : (
              <MindMapView onShowPlan={() => setView('plan')} />
            )}
          </LazyView>
        </main>
      ) : project.tasks.length === 0 ? (
        // Prázdný projekt: jen uvítání přes celou šířku, graf by byl prázdný.
        <main id={MAIN_ID} tabIndex={-1} className="focus:outline-none flex-1 overflow-auto">
          <TaskTable onAddTask={handleAddTask} onLoadSample={handleLoadSample} onWizard={() => setWizardOpen(true)} onNewProject={() => setNewOpen(true)} />
        </main>
      ) : (
        <main id={MAIN_ID} tabIndex={-1} className="focus:outline-none min-h-0 flex-1">
          <DetailDock
            plan={<SplitView left={<TaskTable onAddTask={handleAddTask} onLoadSample={handleLoadSample} onWizard={() => setWizardOpen(true)} onNewProject={() => setNewOpen(true)} />} right={<GanttChart />} />}
            header={<TaskDetailHeader />}
            empty={selectedId === null}
          >
            <TaskDetailBody />
          </DetailDock>
        </main>
      )}

      {/* Informace o datech: jedna řádka, jde skrýt (pamatuje si prohlížeč); znovu ji ukáže Nápověda. */}
      {!privacyHidden && (
        <footer className="flex items-center gap-3 border-t border-slate-200 px-4 py-1 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <p className="min-w-0 flex-1 truncate" title={`${t('app.privacy')} ${t('app.notSavedYet')}`}>
            <span aria-hidden="true">🔒 </span>
            {t('app.privacy')} {t('app.notSavedYet')}
          </p>
          <button
            type="button"
            onClick={() => setPrivacyHidden(true)}
            className="shrink-0 rounded px-1.5 py-0.5 hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {t('app.privacyHide')}
          </button>
        </footer>
      )}
    </div>
  )
}
