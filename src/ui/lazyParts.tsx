/**
 * Části aplikace, které se stahují až při prvním použití (audit R7 – menší hlavní soubor).
 *
 * `lazy(() => import(...))` říká nástroji Vite: tuto část dej do samostatného souboru a stáhni
 * ho, až bude poprvé potřeba. Plán (tabulka + Gantt) zůstává v hlavním souboru – je vidět hned.
 * Soubory jsou na stejné adrese jako aplikace, takže je pravidla CSP ('self') povolí.
 */
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

// --- Pohledy ---
export const ResourcesView = lazy(() => import('./resources/ResourcesView').then((m) => ({ default: m.ResourcesView })))
export const LoadView = lazy(() => import('./load/LoadView').then((m) => ({ default: m.LoadView })))
export const CostsView = lazy(() => import('./costs/CostsView').then((m) => ({ default: m.CostsView })))
export const AnalysisView = lazy(() => import('./analysis/AnalysisView').then((m) => ({ default: m.AnalysisView })))
export const TrackingView = lazy(() => import('./tracking/TrackingView').then((m) => ({ default: m.TrackingView })))
export const MindMapView = lazy(() => import('./mindmap/MindMapView').then((m) => ({ default: m.MindMapView })))

// --- Mobilní verze (na počítači se nestáhne vůbec) ---
export const MobileShell = lazy(() => import('./mobile/MobileShell').then((m) => ({ default: m.MobileShell })))
export const MobilePlan = lazy(() => import('./mobile/MobilePlan').then((m) => ({ default: m.MobilePlan })))

// --- Dialogy ---
export const CalendarDialog = lazy(() => import('./CalendarDialog').then((m) => ({ default: m.CalendarDialog })))
export const ShortcutsDialog = lazy(() => import('./ShortcutsDialog').then((m) => ({ default: m.ShortcutsDialog })))
export const GlossaryDialog = lazy(() => import('./help/GlossaryDialog').then((m) => ({ default: m.GlossaryDialog })))
export const NewProjectDialog = lazy(() => import('./NewProjectDialog').then((m) => ({ default: m.NewProjectDialog })))
export const WizardDialog = lazy(() => import('./WizardDialog').then((m) => ({ default: m.WizardDialog })))
export const PrintDialog = lazy(() => import('./PrintDialog').then((m) => ({ default: m.PrintDialog })))
export const AiDialog = lazy(() => import('./ai/AiDialog').then((m) => ({ default: m.AiDialog })))
export const PlanCheckDialog = lazy(() => import('./check/PlanCheckDialog').then((m) => ({ default: m.PlanCheckDialog })))
export const ImportDialog = lazy(() => import('./ImportDialog').then((m) => ({ default: m.ImportDialog })))
export const BudgetImportDialog = lazy(() => import('./costs/BudgetImportDialog').then((m) => ({ default: m.BudgetImportDialog })))
export const WorkbookImportDialog = lazy(() => import('./WorkbookImportDialog').then((m) => ({ default: m.WorkbookImportDialog })))
export const LibraryDialog = lazy(() => import('./resources/LibraryDialog').then((m) => ({ default: m.LibraryDialog })))

/** Než se stáhne soubor pohledu (zlomek sekundy), ukáže se krátký text. */
export function ViewLoading() {
  const { t } = useTranslation()
  return (
    <p role="status" className="p-6 text-sm text-slate-600 dark:text-slate-400">
      {t('app.loading')}
    </p>
  )
}

/** Pohled stažený až při prvním zobrazení. */
export function LazyView({ children }: { children: ReactNode }) {
  return <Suspense fallback={<ViewLoading />}>{children}</Suspense>
}

/**
 * Dialog se stáhne a vykreslí až při prvním otevření (`active`) – a pak už zůstane, takže si
 * po zavření pamatuje rozepsaný stav (např. zadání pro AI) stejně jako dřív.
 */
export function MountWhenNeeded({ active, children }: { active: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(active)
  if (active && !mounted) setMounted(true) // odvozený stav: povolené nastavení během vykreslení
  return mounted ? <Suspense fallback={null}>{children}</Suspense> : null
}
