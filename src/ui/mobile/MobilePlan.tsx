/**
 * Mobilní verze – pohled Plán: přepínač **Seznam / Gantt** (volbu si pamatuje prohlížeč).
 *  - Seznam = karty činností (MobilePlanList),
 *  - Gantt = úsporný obrázek diagramu přes celou šířku (stejné vykreslení jako export SVG, bez
 *    tabulky; název a % hotovo vedle úseček), posouvatelný do strany, s měřítkem Týdny / Měsíce /
 *    Čtvrtletí. Obrázek se jen prohlíží – nic se v něm nedá táhnout ani měnit.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Zoom } from '../../gantt/timeline'
import { currentGanttSvg } from '../../io/ganttExportActions'
import { useProject } from '../../store/useProject'
import { useDisplayOptions } from '../displayOptions'
import { useDarkTheme } from '../useDarkTheme'
import { loadPreference, savePreference } from '../preferences'
import { useViewState } from '../viewState'
import { MobilePlanList } from './MobilePlanList'

type Mode = 'list' | 'gantt'
const ZOOMS: Zoom[] = ['week', 'month', 'quarter']

const segment = (active: boolean) =>
  `px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${
    active ? 'bg-miro-graphite text-miro-paper dark:bg-miro-paper dark:text-miro-graphite' : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'
  }`

export function MobilePlan() {
  const { t } = useTranslation()
  const [mode, setModeState] = useState<Mode>(() => (loadPreference('mobilePlanMode') === 'gantt' ? 'gantt' : 'list'))
  const setMode = (next: Mode) => {
    setModeState(next)
    savePreference('mobilePlanMode', next)
  }
  const [zoom, setZoom] = useState<Zoom>('month')
  const hasTasks = useProject((s) => s.project.tasks.length > 0)
  const showCritical = useDisplayOptions((s) => s.showCritical)
  const toggleCritical = useDisplayOptions((s) => s.toggleCritical)

  return (
    <div className="flex h-full flex-col">
      {hasTasks && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          <div role="group" aria-label={t('mobile.planMode')} className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
            <button type="button" aria-pressed={mode === 'list'} onClick={() => setMode('list')} className={segment(mode === 'list')}>
              {t('mobile.list')}
            </button>
            <button type="button" aria-pressed={mode === 'gantt'} onClick={() => setMode('gantt')} className={`-ml-px ${segment(mode === 'gantt')}`}>
              {t('mobile.gantt')}
            </button>
          </div>
          {mode === 'gantt' && (
            <div role="group" aria-label={t('gantt.zoom')} className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
              {ZOOMS.map((z, i) => (
                <button key={z} type="button" aria-pressed={zoom === z} onClick={() => setZoom(z)} className={`${i > 0 ? '-ml-px' : ''} ${segment(zoom === z)}`}>
                  {t(`gantt.zoomLevel.${z}`)}
                </button>
              ))}
            </div>
          )}
          {/* Kritická cesta i v mobilu (audit U24) – stejná volba jako na počítači. */}
          {mode === 'gantt' && (
            <button
              type="button"
              aria-pressed={showCritical}
              onClick={toggleCritical}
              className={`overflow-hidden rounded-md border border-slate-300 dark:border-slate-600 ${segment(showCritical)}`}
            >
              {t('gantt.critical')}
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">{mode === 'gantt' && hasTasks ? <MobileGantt zoom={zoom} /> : <MobilePlanList />}</div>
    </div>
  )
}

/** Gantt jako obrázek SVG (data: URL – povoluje ho CSP); překreslí se po každé změně projektu. */
function MobileGantt({ zoom }: { zoom: Zoom }) {
  const { t, i18n } = useTranslation()
  const project = useProject((s) => s.project)
  const collapsed = useViewState((s) => s.collapsed)
  const critical = useDisplayOptions((s) => s.showCritical)
  // V tmavém vzhledu tmavý obrázek – dřív svítil bílou plochou (audit U24).
  const theme = useDarkTheme() ? 'dark' : 'light'
  const image = useMemo(() => {
    const { svg, width, height } = currentGanttSvg(t, i18n.language, { zoom, compact: true, labelFields: ['name', 'percent'], critical, theme })
    return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width, height }
    // project a collapsed jsou závislosti záměrně – currentGanttSvg je čte ze stavu aplikace.
  }, [t, i18n.language, zoom, critical, theme, project, collapsed])
  return <img src={image.src} width={image.width} height={image.height} alt={t('mobile.ganttAlt', { name: project.name })} className="block max-w-none" />
}
