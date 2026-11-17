/**
 * Export Ganttova diagramu jako obrázek (I-05, fáze 13a) – akce z menu Soubor.
 * Obrázek kreslí čistá funkce renderGanttSvg (gantt/exportSvg.ts); tady se jen připraví vstup
 * podle toho, co je právě vidět (měřítko osy, sbalené fáze, kritická cesta) a soubor se uloží.
 *  - SVG: přímo text obrázku (ostrý v jakékoli velikosti, jde vložit do Wordu),
 *  - PNG: SVG se vykreslí do plátna (canvas) v dvojnásobném rozlišení a uloží jako obrázek.
 * Nic se neposílá na server; obrázek vzniká jen v prohlížeči.
 */
import type { TFunction } from 'i18next'
import { createWorkCalendar } from '../engine/calendar'
import { renderGanttSvg, type GanttSvg } from '../gantt/exportSvg'
import type { Zoom } from '../gantt/timeline'
import { formatIsoDate } from '../i18n/format'
import { visibleRows, wbsNumbers } from '../model/hierarchy'
import { todayIso } from '../model/dates'
import { getCosts, getPercents, getSchedule, projectStore } from '../store/useProject'
import { buildBarLabels, type BarLabelField } from '../gantt/barLabels'
import { barLabelFormat } from '../ui/gantt/barLabelFormat'
import { useDisplayOptions } from '../ui/displayOptions'
import { useZoom } from '../ui/gantt/zoom'
import { segmentLabel } from '../ui/gantt/TimelineHeader'
import { showNotice } from '../ui/notice'
import { useViewState } from '../ui/viewState'
import { saveBlob } from './fileActions'
import { FILE_EXTENSION, fileNameFor } from './projectFile'

/** Největší strana obrázku PNG v bodech (prohlížeče větší plátno nevykreslí). */
const MAX_CANVAS_SIDE = 16_000
const PNG_SCALE = 2

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

/** Volby obrázku; bez nich jako na obrazovce. `rowRange` = jen část řádků (stránka tisku). */
export interface GanttSvgOptions {
  rowRange?: { from: number; to: number }
  zoom?: Zoom
  critical?: boolean
  /** Úsporná varianta pro telefon (bez tabulky a nadpisu). */
  compact?: boolean
  /** Údaje v popiscích vedle úseček; chybí = podle volby „Popisky“. */
  labelFields?: BarLabelField[]
}

/** Počet řádků, které se do obrázku kreslí (viditelné – bez řádků ve sbalených fázích). */
export function currentGanttRowCount(): number {
  return visibleRows(projectStore.getState().project, useViewState.getState().collapsed).length
}

/** SVG aktuálního plánu tak, jak je vidět (měřítko, sbalené fáze, kritická cesta), nebo podle voleb. */
export function currentGanttSvg(t: TFunction, language: string, options: GanttSvgOptions = {}): GanttSvg {
  const { rowRange } = options
  const project = projectStore.getState().project
  const scheduled = getSchedule(project)
  const date = (iso: string) => formatIsoDate(iso, language)
  const rows = visibleRows(project, useViewState.getState().collapsed)
  const percents = getPercents(project)
  const costs = getCosts(project)
  // Stejné popisky vedle úseček jako na obrazovce (volba „Popisky“).
  const barLabels = buildBarLabels(
    rows,
    scheduled.tasks,
    percents,
    (id) => costs.byTask.get(id)?.total.total ?? 0,
    options.labelFields ?? useDisplayOptions.getState().barLabels,
    barLabelFormat(t, language, project.currency),
  )
  return renderGanttSvg({
    project,
    scheduled,
    rows,
    wbs: wbsNumbers(project),
    percents,
    barLabels,
    compact: options.compact,
    calendar: createWorkCalendar(project.calendar),
    zoom: options.zoom ?? useZoom.getState().zoom,
    critical: options.critical ?? useDisplayOptions.getState().showCritical,
    rowRange,
    labels: {
      title: project.name,
      subtitle: t('ganttExport.subtitle', {
        start: date(project.startDate),
        finish: scheduled.projectFinish ? date(scheduled.projectFinish) : '–',
        count: project.tasks.length,
        today: date(todayIso()),
      }),
      columns: {
        number: t('table.rowNumber'),
        wbs: t('table.wbs'),
        name: t('table.name'),
        start: t('table.start'),
        finish: t('table.finish'),
        duration: t('table.duration'),
      },
      formatDate: date,
      segmentLabel: (segment, isTop) => segmentLabel(segment, isTop, t, language),
    },
  })
}

const baseName = () => fileNameFor(projectStore.getState().project).slice(0, -FILE_EXTENSION.length)

export async function exportGanttSvg(t: TFunction, language: string): Promise<void> {
  if (projectStore.getState().project.tasks.length === 0) return showNotice(t('ganttExport.empty'))
  const { svg } = currentGanttSvg(t, language)
  try {
    await saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `${baseName()}-gantt.svg`, {
      description: t('ganttExport.svgType'),
      accept: { 'image/svg+xml': ['.svg'] },
    })
  } catch (error) {
    if (!isAbort(error)) showNotice(t('export.failed'))
  }
}

/** Vykreslí SVG do plátna a vrátí PNG (obrázek se načte z data: adresy – CSP to povoluje). */
async function svgToPng({ svg, width, height }: GanttSvg): Promise<Blob> {
  const scale = Math.max(0.25, Math.min(PNG_SCALE, MAX_CANVAS_SIDE / width, MAX_CANVAS_SIDE / height))
  const image = new Image()
  image.decoding = 'async'
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('svgLoad'))
  })
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await loaded
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/png'))
}

export async function exportGanttPng(t: TFunction, language: string): Promise<void> {
  if (projectStore.getState().project.tasks.length === 0) return showNotice(t('ganttExport.empty'))
  try {
    const png = await svgToPng(currentGanttSvg(t, language))
    await saveBlob(png, `${baseName()}-gantt.png`, { description: t('ganttExport.pngType'), accept: { 'image/png': ['.png'] } })
  } catch (error) {
    if (!isAbort(error)) showNotice(t('export.failed'))
  }
}
