/**
 * Tlačítko „Popisky ▾“ v liště plánu: zaškrtávací políčka s údaji, které se ukážou vedle úseček
 * (Název, Termín, Délka, % hotovo, Náklady). Volbu si pamatuje prohlížeč (displayOptions).
 * Panel se zavře kliknutím mimo nebo klávesou Esc (fokus se vrátí na tlačítko).
 */
import { useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { BAR_LABEL_FIELDS, type BarLabelField } from '../../gantt/barLabels'
import { useDisplayOptions } from '../displayOptions'
import { useDropdown } from '../HeaderMenus'

export function BarLabelsMenu() {
  const { t } = useTranslation()
  const panelId = useId()
  const fields = useDisplayOptions((s) => s.barLabels)
  const setFields = useDisplayOptions((s) => s.setBarLabels)
  const { open, setOpen, buttonRef, panelRef, close } = useDropdown()
  const on = fields.length > 0

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [open, panelRef])

  const toggle = (field: BarLabelField, checked: boolean) => setFields(checked ? [...fields, field] : fields.filter((f) => f !== field))

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        title={t('gantt.barLabelsHint')}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          on
            ? 'border-miro-graphite bg-miro-graphite text-miro-paper dark:border-miro-paper dark:bg-miro-paper dark:text-miro-graphite'
            : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          {/* Úsečka a vedle ní řádky textu. */}
          <rect x="1" y="5" width="6" height="6" rx="1.5" fill="currentColor" />
          <path d="M9 6.5h6M9 9.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {t('gantt.barLabels')}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              close()
            }
          }}
          className="absolute right-0 z-30 mt-1 min-w-52 rounded-md border border-slate-300 bg-white px-3 py-2 shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          <fieldset>
            <legend className="sr-only">{t('gantt.barLabelsLegend')}</legend>
            <p aria-hidden="true" className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('gantt.barLabelsLegend')}
            </p>
            {BAR_LABEL_FIELDS.map((field) => (
              <label key={field} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={fields.includes(field)}
                  onChange={(e) => toggle(field, e.target.checked)}
                  className="h-4 w-4 accent-miro-turquoise-dark dark:accent-miro-turquoise"
                />
                {t(`gantt.barLabel.${field}`)}
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </div>
  )
}
