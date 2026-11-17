/**
 * Okno „Vložit odsazený text“ (fáze 12, MM-03): osnova (z Wordu, poznámek nebo od AI) → myšlenková mapa.
 * Náhled nové mapy, nebo chyby s číslem řádku; „Nahradit mapu“ (s varováním, jeden krok Zpět).
 * Převod dělá model/outline.ts; vložený text se zobrazuje jen jako text.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { childrenOf, depthOf, rootOf } from '../../model/mindMap'
import { parseOutline } from '../../model/outline'
import type { MindMap } from '../../model/schema'
import { useProject } from '../../store/useProject'

const PREVIEW_ROWS = 15

export function OutlineDialog({ open, currentNodes, onClose, onReplaced }: { open: boolean; currentNodes: number; onClose: () => void; onReplaced: () => void }) {
  const { t } = useTranslation()
  const projectName = useProject((s) => s.project.name)
  const setMindMap = useProject((s) => s.setMindMap)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const textId = useId()
  const [text, setText] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setText('')
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const result = useMemo(() => (text.trim() === '' ? null : parseOutline(text, projectName, () => crypto.randomUUID())), [text, projectName])

  /** Uzly nové mapy v pořadí (do hloubky) s hloubkou – pro náhled. */
  const rows = useMemo(() => {
    if (!result?.ok) return []
    const map: MindMap = result.map
    const out: { id: string; text: string; depth: number }[] = []
    const walk = (id: string) => {
      out.push({ id, text: map.nodes.find((n) => n.id === id)!.text, depth: depthOf(map, id) })
      for (const c of childrenOf(map, id)) walk(c.id)
    }
    walk(rootOf(map).id)
    return out
  }, [result])

  function replace() {
    if (!result?.ok) return
    setMindMap(result.map)
    onClose()
    onReplaced()
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
          {t('mindMap.outline.title')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">{t('mindMap.outline.intro')}</p>
        <div>
          <label htmlFor={textId} className="block font-medium">
            {t('mindMap.outline.label')}
          </label>
          <textarea
            id={textId}
            value={text}
            rows={8}
            placeholder={t('mindMap.outline.placeholder')}
            onChange={(e) => setText(e.target.value)}
            className="field-select mt-1 w-full font-mono text-xs"
          />
        </div>

        {result && !result.ok && (
          <ul className="rounded-md border-l-4 border-red-600 bg-red-50 px-3 py-2 text-red-900 dark:border-red-400 dark:bg-red-950/40 dark:text-red-100">
            {result.errors.map((e, i) => (
              <li key={i}>
                <span aria-hidden="true">⚠ </span>
                {t(`mindMap.outline.errors.${e.code}`, { line: e.line })}
              </li>
            ))}
          </ul>
        )}

        {result?.ok && (
          <div>
            <p className="font-medium">{t('mindMap.outline.preview', { count: rows.length })}</p>
            <ul className="mt-1 space-y-0.5 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
              {rows.slice(0, PREVIEW_ROWS).map((row) => (
                <li key={row.id} style={{ paddingLeft: `${row.depth * 1.25}rem` }} className={row.depth === 0 ? 'font-semibold' : ''}>
                  {row.text}
                </li>
              ))}
              {rows.length > PREVIEW_ROWS && <li className="text-slate-500 dark:text-slate-400">{t('mindMap.plan.more', { count: rows.length - PREVIEW_ROWS })}</li>}
            </ul>
            {currentNodes > 1 && (
              <p role="alert" className="mt-2 rounded-md border-l-4 border-miro-gold bg-miro-yellow-light/50 px-3 py-2 dark:border-miro-yellow dark:bg-slate-800">
                <span aria-hidden="true">⚠ </span>
                {t('mindMap.outline.replaceWarning', { count: currentNodes })}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('mindMap.plan.cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={replace} disabled={!result?.ok}>
            {t('mindMap.outline.replace')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
