/**
 * Nabídka „Pohled“ v Analýze (fáze 8, A-06): přednastavené pohledy pro začátečníky a vlastní
 * pohledy uložené v projektu (Project.views). Uložit jako nový, uložit změny, přejmenovat, smazat –
 * každá změna projektu je jeden krok Zpět. Název se zadává v malém dialogu (žádné window.prompt).
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { PivotConfig } from '../../model/pivot'
import { projectStore, useProject } from '../../store/useProject'
import { PRESETS, sameConfig } from './presets'

/** Co je právě použité: přednastavený pohled, vlastní pohled, nebo nic. */
export type ActiveView = { kind: 'preset'; id: string } | { kind: 'own'; id: string } | null

export function ViewsMenu({ config, active, onApply }: { config: PivotConfig; active: ActiveView; onApply: (config: PivotConfig, active: ActiveView) => void }) {
  const { t } = useTranslation()
  const views = useProject((s) => s.project.views) ?? []
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState<{ mode: 'save' | 'rename'; name: string } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const ownActive = active?.kind === 'own' ? views.find((v) => v.id === active.id) : undefined
  const presetActive = active?.kind === 'preset' ? PRESETS.find((p) => p.id === active.id) : undefined
  const activeName = ownActive?.name ?? (presetActive ? t(`analysis.presets.${presetActive.id}`) : null)
  const changed = ownActive ? !sameConfig(ownActive.config, config) : presetActive ? !sameConfig(presetActive.config, config) : false

  const apply = (next: PivotConfig, view: ActiveView) => {
    onApply(next, view)
    setOpen(false)
  }

  function submitName(event: FormEvent) {
    event.preventDefault()
    if (!naming) return
    const name = naming.name.trim()
    if (name === '') return
    if (naming.mode === 'save') {
      const id = projectStore.getState().saveView(name, config)
      if (id) onApply(config, { kind: 'own', id })
    } else if (ownActive) projectStore.getState().renameView(ownActive.id, name)
    setNaming(null)
  }

  const item =
    'flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left text-sm hover:bg-miro-turquoise-light/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800'
  const heading = 'px-2 pb-0.5 pt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'

  return (
    <div ref={rootRef} className="relative" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button type="button" aria-haspopup="true" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)} className="btn-secondary" title={t('analysis.views.hint')}>
        <span>
          {t('analysis.views.label')}: <span className="font-normal">{activeName ?? t('analysis.views.custom')}</span>
          {changed && <span className="font-normal text-slate-500 dark:text-slate-400"> ({t('analysis.views.changed')})</span>}
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div id={menuId} role="group" aria-label={t('analysis.views.label')} className="absolute left-0 top-full z-40 mt-1 max-h-[70vh] w-80 overflow-y-auto rounded-md border border-slate-300 bg-white p-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-900">
          <p className={heading}>{t('analysis.views.presets')}</p>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={item} onClick={() => apply(p.config, { kind: 'preset', id: p.id })} aria-pressed={presetActive?.id === p.id}>
              <span>{t(`analysis.presets.${p.id}`)}</span>
              {presetActive?.id === p.id && <span aria-hidden="true">✓</span>}
            </button>
          ))}
          <p className={`${heading} mt-1 border-t border-slate-200 pt-2 dark:border-slate-700`}>{t('analysis.views.own')}</p>
          {views.length === 0 && <p className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400">{t('analysis.views.noOwn')}</p>}
          {views.map((v) => (
            <button key={v.id} type="button" className={item} onClick={() => apply(v.config, { kind: 'own', id: v.id })} aria-pressed={ownActive?.id === v.id}>
              <span className="truncate">{v.name}</span>
              {ownActive?.id === v.id && <span aria-hidden="true">✓</span>}
            </button>
          ))}
          <div className="mt-1 space-y-0.5 border-t border-slate-200 pt-1 dark:border-slate-700">
            <button type="button" className={item} onClick={() => (setOpen(false), setNaming({ mode: 'save', name: '' }))}>
              {t('analysis.views.saveAs')}
            </button>
            <button type="button" className={item} disabled={!ownActive || !changed} onClick={() => (ownActive && projectStore.getState().updateView(ownActive.id, config), setOpen(false))}>
              {t('analysis.views.saveChanges', { name: ownActive?.name ?? '…' })}
            </button>
            <button type="button" className={item} disabled={!ownActive} onClick={() => (setOpen(false), setNaming({ mode: 'rename', name: ownActive?.name ?? '' }))}>
              {t('analysis.views.rename')}
            </button>
            <button
              type="button"
              className={item}
              disabled={!ownActive}
              onClick={() => {
                if (!ownActive) return
                if (window.confirm(t('analysis.views.confirmDelete', { name: ownActive.name }))) {
                  projectStore.getState().deleteView(ownActive.id)
                  onApply(config, null)
                }
                setOpen(false)
              }}
            >
              {t('analysis.views.delete')}
            </button>
          </div>
          <p className="px-2 pt-1 text-xs text-slate-500 dark:text-slate-400">{t('analysis.views.note')}</p>
        </div>
      )}
      <NameDialog naming={naming} onChange={(name) => setNaming((n) => (n ? { ...n, name } : n))} onSubmit={submitName} onClose={() => setNaming(null)} />
    </div>
  )
}

function NameDialog({
  naming,
  onChange,
  onSubmit,
  onClose,
}: {
  naming: { mode: 'save' | 'rename'; name: string } | null
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
    if (naming && !dialog.open) dialog.showModal()
    if (!naming && dialog.open) dialog.close()
  }, [naming])
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      {naming && (
        <form onSubmit={onSubmit} className="p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {t(naming.mode === 'save' ? 'analysis.views.saveTitle' : 'analysis.views.renameTitle')}
          </h2>
          <label className="mt-3 flex flex-col gap-1 text-sm">
            {t('analysis.views.name')}
            <input
              type="text"
              autoFocus
              required
              maxLength={100}
              value={naming.name}
              onChange={(e) => onChange(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('analysis.views.undo')}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('import.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={naming.name.trim() === ''}>
              {t(naming.mode === 'save' ? 'analysis.views.save' : 'analysis.views.renameConfirm')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
