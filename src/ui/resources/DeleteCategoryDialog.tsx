/**
 * Smazání kategorie, kterou něco používá: uživatel vybere náhradní kategorii,
 * položky do ní přejdou a kategorie zmizí – jedním krokem Zpět (N-08).
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { categoryUsage } from '../../model/catalogs'
import type { Category } from '../../model/schema'
import { projectStore, useProject } from '../../store/useProject'

export function DeleteCategoryDialog({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const project = useProject((s) => s.project)
  const others = project.costCategories.filter((c) => c.id !== category?.id)
  const [replacementId, setReplacementId] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (category) {
      setReplacementId(projectStore.getState().project.costCategories.find((c) => c.id !== category.id)?.id ?? '')
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) dialog.close()
  }, [category])

  const usage = category ? categoryUsage(project, category.id) : null
  const examples = usage ? [...usage.professions, ...usage.machines, ...usage.materials, ...usage.tasks].slice(0, 5).join(', ') : ''

  function confirm() {
    if (!category || replacementId === '') return
    projectStore.getState().deleteCategory(category.id, replacementId)
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      {category && usage && (
        <div className="p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {t('resources.deleteCategory.title', { name: category.name })}
          </h2>
          <p className="mt-2 text-sm">{t('resources.deleteCategory.usage', { count: usage.total, examples })}</p>
          {others.length === 0 ? (
            <p className="mt-3 text-sm text-red-700 dark:text-red-300">{t('resources.deleteCategory.noOther')}</p>
          ) : (
            <label className="mt-4 flex items-center gap-2 text-sm">
              {t('resources.deleteCategory.moveTo')}
              <select className="field-select" value={replacementId} onChange={(e) => setReplacementId(e.target.value)}>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {project.budget?.categoryLimits.some((c) => c.categoryId === category.id) && (
            <p className="mt-3 text-sm">{t('resources.deleteCategory.limitNote')}</p>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('resources.deleteCategory.undo')}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('rate.cancel')}
            </button>
            <button type="button" className="btn-primary" disabled={others.length === 0} onClick={confirm}>
              {t('resources.deleteCategory.confirm')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
