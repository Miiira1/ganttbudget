/**
 * Název projektu v záhlaví (kritérium 12.1). Kliknutím se změní na textové pole:
 * Enter nebo kliknutí jinam uloží (jeden krok Zpět), Esc zruší.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { projectStore, useProject } from '../store/useProject'

export function ProjectName() {
  const { t } = useTranslation()
  const name = useProject((s) => s.project.name)
  const [draft, setDraft] = useState<string | null>(null)

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(name)}
        title={t('project.renameHint')}
        className="rounded font-medium text-slate-800 underline decoration-dotted decoration-slate-400 underline-offset-2 hover:decoration-solid focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:text-slate-200"
      >
        {name}
      </button>
    )
  }

  const finish = (save: boolean) => {
    if (save) projectStore.getState().renameProject(draft)
    setDraft(null)
  }

  return (
    <input
      type="text"
      autoFocus
      value={draft}
      maxLength={200}
      aria-label={t('project.nameLabel')}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true)
        else if (e.key === 'Escape') finish(false)
        else return
        e.preventDefault()
        e.stopPropagation()
      }}
      className="w-72 max-w-full rounded border border-focus bg-white px-1 font-medium text-slate-900 focus:outline-none dark:bg-slate-800 dark:text-slate-100"
    />
  )
}
