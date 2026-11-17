/**
 * Okno „Vytvořit plán z mapy“ (fáze 12, MM-02): náhled nových fází a činností a u neprázdného plánu
 * volba Přidat na konec / Nahradit (s varováním, co zmizí). Vytvoření = jeden krok Zpět,
 * mapa zůstane beze změny. Převod počítá model/mindMapToPlan.ts.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { depthMap, treeOrder } from '../../model/hierarchy'
import { MIND_MAP_TASK_DAYS, planFromMindMap, type PlanFromMapMode } from '../../model/mindMapToPlan'
import type { MindMap } from '../../model/schema'
import { useProject } from '../../store/useProject'

const PREVIEW_ROWS = 15

export function PlanFromMapDialog({ open, map, onClose, onDone }: { open: boolean; map: MindMap; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const project = useProject((s) => s.project)
  const loadProject = useProject((s) => s.loadProject)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [mode, setMode] = useState<PlanFromMapMode>('append')
  const hasPlan = project.tasks.length > 0

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setMode('append')
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Náhled se počítá jen při otevřeném okně; nová ID jsou jen pro náhled (při vytvoření se spočítá znovu).
  const preview = useMemo(() => {
    if (!open) return null
    const result = planFromMindMap(project, map, hasPlan ? mode : 'append', () => crypto.randomUUID())
    if (!result.ok) return result
    const existing = new Set(project.tasks.map((x) => x.id))
    const depths = depthMap(result.project)
    const rows = treeOrder(result.project).filter((x) => !existing.has(x.id))
    return { ...result, rows, depths }
  }, [open, project, map, mode, hasPlan])

  function create() {
    if (!preview?.ok) return
    loadProject(preview.project)
    onClose()
    onDone()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="space-y-4 p-5 text-sm">
        <h2 id={titleId} className="text-lg font-semibold">
          {t('mindMap.plan.title')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">{t('mindMap.plan.intro', { days: MIND_MAP_TASK_DAYS })}</p>

        {preview && !preview.ok && <p className="rounded-md border-l-4 border-miro-gold bg-miro-yellow-light/50 px-3 py-2 dark:border-miro-yellow dark:bg-slate-800">{t(`mindMap.plan.${preview.reason}`)}</p>}

        {preview?.ok && (
          <>
            {hasPlan && (
              <fieldset className="space-y-1.5">
                <legend className="font-medium">{t('mindMap.plan.modeLabel', { count: project.tasks.length })}</legend>
                {(['append', 'replace'] as const).map((m) => (
                  <label key={m} className="flex items-start gap-2">
                    <input type="radio" name="planFromMapMode" checked={mode === m} onChange={() => setMode(m)} className="mt-0.5 h-4 w-4 accent-miro-turquoise-dark" />
                    <span>
                      <span className="font-medium">{t(`mindMap.plan.${m}`)}</span>
                      <span className="block text-slate-600 dark:text-slate-400">{t(`mindMap.plan.${m}Hint`)}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {mode === 'replace' && hasPlan && (
              <p role="alert" className="rounded-md border-l-4 border-red-600 bg-red-50 px-3 py-2 text-red-900 dark:border-red-400 dark:bg-red-950/40 dark:text-red-100">
                <span aria-hidden="true">⚠ </span>
                {t('mindMap.plan.replaceWarning', {
                  tasks: preview.summary.removedTasks,
                  lines: preview.summary.removedLines,
                  actuals: preview.summary.removedActuals,
                })}
              </p>
            )}
            <div>
              <p className="font-medium">{t('mindMap.plan.summary', { phases: preview.summary.phases, tasks: preview.summary.tasks })}</p>
              <ul className="mt-1 space-y-0.5 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
                {preview.rows.slice(0, PREVIEW_ROWS).map((row) => (
                  <li key={row.id} style={{ paddingLeft: `${(preview.depths.get(row.id) ?? 0) * 1.25}rem` }} className={row.kind === 'phase' ? 'font-semibold' : ''}>
                    {row.name}
                  </li>
                ))}
                {preview.rows.length > PREVIEW_ROWS && <li className="text-slate-500 dark:text-slate-400">{t('mindMap.plan.more', { count: preview.rows.length - PREVIEW_ROWS })}</li>}
              </ul>
            </div>
            <p className="text-slate-600 dark:text-slate-400">{t('mindMap.plan.afterHint')}</p>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('mindMap.plan.cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={create} disabled={!preview?.ok}>
            {t('mindMap.plan.create')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
