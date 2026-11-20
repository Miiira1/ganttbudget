/**
 * Štítky řádku (fáze 7, R-03): bublinky s křížkem a políčko pro přidání.
 * Nápověda nabízí štítky už použité v projektu (nativní <datalist>, bez knihovny).
 * Enter nebo čárka štítek přidá, Esc zruší psaní. Každé přidání / odebrání je jeden krok Zpět.
 */
import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_LINE_TAGS, MAX_TAG_LENGTH, nameKey } from '../../model/schema'
import { normalizeTags } from '../../model/tags'
import { projectStore } from '../../store/useProject'

export function TagsCell({ taskId, lineId, tags, suggestions, label }: { taskId: string; lineId: string; tags: readonly string[]; suggestions: readonly string[]; label: string }) {
  const { t } = useTranslation()
  const listId = useId()
  const [draft, setDraft] = useState('')

  const save = (next: string[]) => {
    const normalized = normalizeTags(next)
    projectStore.getState().updateTaskLine(taskId, lineId, { tags: normalized.length > 0 ? normalized : undefined })
  }
  const add = () => {
    const parts = draft.split(',').map((p) => p.trim()).filter(Boolean)
    setDraft('')
    if (parts.length > 0) save([...tags, ...parts])
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add()
    } else if (event.key === 'Escape') {
      setDraft('')
      event.currentTarget.blur()
    }
  }

  const full = tags.length >= MAX_LINE_TAGS
  const used = new Set(tags.map(nameKey))
  return (
    <div className="flex flex-wrap items-center gap-1 py-0.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-slate-300 bg-slate-100 py-px pl-2 pr-0.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <span className="truncate">{tag}</span>
          <button
            type="button"
            onClick={() => save(tags.filter((x) => x !== tag))}
            aria-label={t('detail.tags.remove', { tag })}
            title={t('detail.tags.remove', { tag })}
            className="rounded-full px-1 leading-none text-slate-500 dark:text-slate-400 hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            <span aria-hidden="true">×</span>
          </button>
        </span>
      ))}
      {!full && (
        <>
          <input
            type="text"
            value={draft}
            maxLength={MAX_TAG_LENGTH * 3}
            list={listId}
            aria-label={label}
            title={t('detail.tags.hint')}
            placeholder={tags.length === 0 ? t('detail.tags.placeholder') : '＋'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={add}
            className="min-w-12 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs placeholder:text-slate-400 hover:border-slate-300 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/40 dark:hover:border-slate-600"
          />
          <datalist id={listId}>
            {suggestions.filter((s) => !used.has(nameKey(s))).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </>
      )}
    </div>
  )
}
