/** Přepínač měřítka časové osy (G-04): Dny / Týdny / Měsíce / Čtvrtletí. */
import { useTranslation } from 'react-i18next'
import { ZOOMS } from '../../gantt/timeline'
import { useZoom } from './zoom'

export function ZoomSwitch() {
  const { t } = useTranslation()
  const zoom = useZoom((s) => s.zoom)
  const setZoom = useZoom((s) => s.setZoom)
  return (
    <div role="group" aria-label={t('gantt.zoom')} title={t('gantt.zoomHint')} className="inline-flex">
      {ZOOMS.map((z, i) => (
        <button
          key={z}
          type="button"
          aria-pressed={zoom === z}
          onClick={() => setZoom(z)}
          className={`border px-3 py-1.5 text-sm font-medium focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            i === 0 ? 'rounded-l-md' : '-ml-px'
          } ${i === ZOOMS.length - 1 ? 'rounded-r-md' : ''} ${
            zoom === z
              ? 'border-miro-graphite bg-miro-graphite text-miro-paper dark:border-miro-paper dark:bg-miro-paper dark:text-miro-graphite'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          {t(`gantt.zoomLevel.${z}`)}
        </button>
      ))}
    </div>
  )
}
