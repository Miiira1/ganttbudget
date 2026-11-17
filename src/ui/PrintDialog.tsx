/**
 * Okno „Tisk / PDF“ (I-05, fáze 13a): Ganttův diagram rozdělený na stránky a tisk prohlížeče
 * (v okně tisku jde zvolit „Uložit jako PDF“). Bez knihovny pro PDF.
 *
 * Volby: papír A4 / A3 na šířku, měřítko osy (automaticky = nejpodrobnější čitelné), kritická cesta.
 * Stránky kreslí renderGanttSvg (každá stránka = část řádků s nadpisem a hlavičkou osy), rozměry
 * počítá gantt/print.ts. Obrázky stránek se vloží jako <img> s data: adresou (CSP to povoluje,
 * žádné vkládání HTML); během tisku se aplikace skryje (třída `printing` na <body>, viz index.css).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { paginateRows, pickZoom, printLayout, type Paper } from '../gantt/print'
import { ZOOMS, type Zoom } from '../gantt/timeline'
import { currentGanttRowCount, currentGanttSvg } from '../io/ganttExportActions'
import { useProject } from '../store/useProject'
import { useDisplayOptions } from './displayOptions'

type ZoomChoice = 'auto' | Zoom
interface PrintPage {
  src: string
  width: number
}

export function PrintDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const project = useProject((s) => s.project)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [paper, setPaper] = useState<Paper>('a4')
  const [zoomChoice, setZoomChoice] = useState<ZoomChoice>('auto')
  const [critical, setCritical] = useState(false)
  const [pages, setPages] = useState<{ paper: Paper; items: PrintPage[] } | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setCritical(useDisplayOptions.getState().showCritical)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Rozložení: měřítko osy, zmenšení a počet stránek (jen při otevřeném okně).
  const layout = useMemo(() => {
    if (!open || project.tasks.length === 0) return null
    const widths = Object.fromEntries(ZOOMS.map((z) => [z, currentGanttSvg(t, lang, { zoom: z, rowRange: { from: 0, to: 0 } }).width])) as Record<Zoom, number>
    const zoom = zoomChoice === 'auto' ? pickZoom(widths, paper) : zoomChoice
    const fit = printLayout(widths[zoom], paper)
    return { zoom, ...fit, width: widths[zoom], ranges: paginateRows(currentGanttRowCount(), fit.rowsPerPage) }
  }, [open, project, zoomChoice, paper, t, lang])

  // Po vykreslení stránek počkat na obrázky a otevřít tisk; po tisku vše uklidit.
  useEffect(() => {
    if (!pages) return
    let cancelled = false
    const done = () => {
      document.body.classList.remove('printing')
      setPages(null)
    }
    document.body.classList.add('printing')
    const images = [...document.querySelectorAll<HTMLImageElement>('.print-root img')]
    void Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(() => {
      if (cancelled) return
      window.addEventListener('afterprint', done, { once: true })
      window.print()
    })
    return () => {
      cancelled = true
      window.removeEventListener('afterprint', done)
      document.body.classList.remove('printing')
    }
  }, [pages])

  function print() {
    if (!layout) return
    const items = layout.ranges.map((rowRange) => {
      const { svg, width } = currentGanttSvg(t, lang, { zoom: layout.zoom, critical, rowRange })
      return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width: width * layout.scale }
    })
    onClose()
    setPages({ paper, items })
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={onClose}
        className="m-auto max-h-[90vh] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="space-y-4 p-5 text-sm">
          <h2 id={titleId} className="text-lg font-semibold">
            {t('print.title')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400">{t('print.intro')}</p>
          {!layout ? (
            <p>{t('ganttExport.empty')}</p>
          ) : (
            <>
              <fieldset className="flex flex-wrap gap-x-5 gap-y-1">
                <legend className="mb-1 font-medium">{t('print.paper')}</legend>
                {(['a4', 'a3'] as const).map((p) => (
                  <label key={p} className="flex items-center gap-1.5">
                    <input type="radio" name="printPaper" checked={paper === p} onChange={() => setPaper(p)} className="h-4 w-4 accent-miro-turquoise-dark" />
                    {t(`print.papers.${p}`)}
                  </label>
                ))}
              </fieldset>
              <label className="flex flex-col gap-1">
                <span className="font-medium">{t('print.zoom')}</span>
                <select value={zoomChoice} onChange={(e) => setZoomChoice(e.target.value as ZoomChoice)} className="field-select w-56">
                  <option value="auto">{t('print.zoomAuto', { zoom: t(`gantt.zoomLevel.${layout.zoom}`) })}</option>
                  {ZOOMS.map((z) => (
                    <option key={z} value={z}>
                      {t(`gantt.zoomLevel.${z}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} className="h-4 w-4 accent-miro-turquoise-dark" />
                {t('print.critical')}
              </label>
              <p className="rounded-md bg-slate-100 px-3 py-2 dark:bg-slate-800">
                {t('print.summary', { pages: layout.ranges.length, rows: layout.rowsPerPage, scale: Math.round(layout.scale * 100) })}
                {layout.scale < 0.5 &&<span className="mt-1 block text-slate-600 dark:text-slate-400">{t('print.smallHint')}</span>}
              </p>
              <p className="text-slate-600 dark:text-slate-400">{t('print.pdfHint', { paper: t(`print.papers.${paper}`) })}</p>
            </>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('print.cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={print} disabled={!layout}>
              <span aria-hidden="true">🖨</span> {t('print.print')}
            </button>
          </div>
        </div>
      </dialog>
      {pages &&
        createPortal(
          <div className="print-root" aria-hidden="true">
            {pages.items.map((page, i) => (
              <div key={i} className={`print-page print-${pages.paper}`}>
                <img src={page.src} alt="" style={{ width: page.width, maxWidth: '100%' }} />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
