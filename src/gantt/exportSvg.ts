/**
 * Export Ganttova diagramu do samostatného SVG (I-05, fáze 13a) – ČISTÁ FUNKCE s testy (exportSvg.test.ts).
 *
 * Výsledek je jeden soubor SVG, který jde otevřít v prohlížeči, vložit do Wordu nebo převést na PNG / PDF:
 *  - nahoře název projektu a podtitul,
 *  - vlevo tabulka (číslo řádku, WBS, název, začátek, konec, délka),
 *  - vpravo časová osa (dva řádky hlavičky), volné dny, úsečky (činnost, fáze, milník), % hotovo
 *    a šipky vazeb; volitelně kritická cesta žlutě.
 * Vždy světlé barvy značky MiRo project, styly přímo v SVG (nezávisí na stylech aplikace).
 * Všechny texty se escapují – název činnosti nikdy nemůže vložit do SVG kód.
 * Texty (popisky sloupců, formát data a hlavičky osy) dodává volající podle jazyka.
 */
import type { WorkCalendar } from '../engine/calendar'
import type { ScheduleResult } from '../engine/schedule'
import type { Project, Task } from '../model/schema'
import { BAR_HALF_HEIGHT, HEADER_HEIGHT, MILESTONE_HALF, ROW_HEIGHT, barGeometry, dependencyPoints, pointsToPath, type Bar } from './geometry'
import { createTimeline, dayToX, headerRows, nonWorkingRuns, type HeaderSegment, type Zoom } from './timeline'
import { LABEL_GAP, labelsTrailingPx } from './barLabels'

export interface GanttSvgLabels {
  title: string
  subtitle: string
  columns: { number: string; wbs: string; name: string; start: string; finish: string; duration: string }
  formatDate: (iso: string) => string
  /** Text úseku hlavičky osy (isTop = horní řádek). */
  segmentLabel: (segment: HeaderSegment, isTop: boolean) => string
}

export interface GanttSvgInput {
  project: Project
  scheduled: ScheduleResult
  /** Řádky v pořadí, jak se mají kreslit (obvykle všechny, nebo jen viditelné). */
  rows: Task[]
  wbs: Map<string, string>
  /** % hotovo (u fází spočítané). */
  percents: Map<string, number>
  calendar: WorkCalendar
  zoom: Zoom
  critical: boolean
  labels: GanttSvgLabels
  /** Jen část řádků (stránka tisku): od – do (bez „do“). */
  rowRange?: { from: number; to: number }
  /** Popisky vedle úseček (id → text), stejné jako na obrazovce; chybí = bez popisků. */
  barLabels?: ReadonlyMap<string, string>
  /** Úsporná varianta pro telefon: bez tabulky vlevo a bez nadpisu (názvy jsou v popiscích). */
  compact?: boolean
}

export interface GanttSvg {
  svg: string
  width: number
  height: number
}

/** Barvy značky (světlý vzhled) – tokeny z src/index.css. */
const C = {
  ink: '#262626',
  muted: '#5c5c58',
  grid: '#e3e2dc',
  headerBg: '#f1f0ea',
  nonWorking: '#f3f2ec',
  holiday: '#ece9dc',
  task: 'rgba(59,218,255,0.35)',
  taskStroke: '#0e7490',
  progress: '#0e7490',
  phase: '#262626',
  phaseProgress: '#3bdaff',
  critical: '#ffc000',
  criticalStroke: '#b38600',
  criticalProgress: 'rgba(38,38,38,0.7)',
  arrow: '#6b6b66',
  criticalArrow: '#b38600',
}

/** Výška pásu s názvem a podtitulem nad hlavičkou (potřebuje ji i stránkování tisku). */
export const TITLE_HEIGHT = 44
const FONT = "Inter, 'Segoe UI', Arial, sans-serif"
/** Sloupce tabulky: šířka a zarovnání. */
const COLUMNS = [
  { key: 'number', width: 30, align: 'end' },
  { key: 'wbs', width: 48, align: 'start' },
  { key: 'name', width: 240, align: 'start' },
  { key: 'start', width: 78, align: 'start' },
  { key: 'finish', width: 78, align: 'start' },
  { key: 'duration', width: 66, align: 'end' },
] as const
/** Kolik znaků názvu se vejde (odhad pro písmo 11 px). */
const NAME_CHARS = 38
const INDENT = 10

/**
 * Escapování textu pro XML (SVG). Řídicí znaky, které XML 1.0 vůbec nedovolí (např. z textu
 * vloženého odjinud), se vynechají – jinak by SVG nešlo otevřít a PNG by selhal (audit B7).
 */
export function escapeXml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)
const r1 = (n: number) => Math.round(n * 10) / 10

export function renderGanttSvg(input: GanttSvgInput): GanttSvg {
  const { project, scheduled, wbs, percents, labels } = input
  const from = input.rowRange?.from ?? 0
  const to = Math.min(input.rows.length, input.rowRange?.to ?? input.rows.length)
  const rows = input.rows.slice(from, to)
  const depths = depthOf(input.rows)

  const barLabels = input.barLabels ?? new Map<string, string>()
  const tl = createTimeline({ zoom: input.zoom, projectStart: project.startDate, projectFinish: scheduled.projectFinish, trailingPx: labelsTrailingPx(barLabels) })
  const columns = input.compact ? [] : COLUMNS
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0)
  const chartX = tableWidth
  const top = input.compact ? 0 : TITLE_HEIGHT
  const bodyTop = top + HEADER_HEIGHT
  const width = Math.ceil(tableWidth + tl.width)
  const height = bodyTop + rows.length * ROW_HEIGHT + 1

  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${escapeXml(FONT)}" font-size="11">`,
  )
  out.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`)
  out.push(
    `<defs><marker id="a" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" fill="${C.arrow}"/></marker>` +
      `<marker id="ac" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" fill="${C.criticalArrow}"/></marker></defs>`,
  )

  // Název a podtitul (v úsporné variantě ne – název projektu je v záhlaví aplikace).
  if (!input.compact) {
    out.push(`<text x="8" y="20" font-size="15" font-weight="700" fill="${C.ink}">${escapeXml(labels.title)}</text>`)
    out.push(`<text x="8" y="36" fill="${C.muted}">${escapeXml(labels.subtitle)}</text>`)
  }

  // Hlavička tabulky a osy.
  out.push(`<rect x="0" y="${top}" width="${width}" height="${HEADER_HEIGHT}" fill="${C.headerBg}"/>`)
  let colX = 0
  for (const col of columns) {
    const x = col.align === 'end' ? colX + col.width - 6 : colX + 6
    out.push(`<text x="${x}" y="${top + HEADER_HEIGHT - 10}" font-weight="700" fill="${C.muted}" text-anchor="${col.align}">${escapeXml(labels.columns[col.key])}</text>`)
    colX += col.width
  }
  const [topRow, bottomRow] = headerRows(tl)
  const half = HEADER_HEIGHT / 2
  for (const [segments, rowIndex] of [
    [topRow, 0],
    [bottomRow, 1],
  ] as const) {
    for (const s of segments) {
      const x = chartX + s.x
      out.push(`<line x1="${r1(x)}" y1="${top + rowIndex * half}" x2="${r1(x)}" y2="${top + (rowIndex + 1) * half}" stroke="${C.grid}"/>`)
      if (s.width >= 14) {
        const label = escapeXml(labels.segmentLabel(s, rowIndex === 0))
        out.push(
          `<text x="${r1(x + 4)}" y="${top + rowIndex * half + 16}" fill="${C.muted}"${rowIndex === 0 ? ' font-weight="700"' : ''}>${label}</text>`,
        )
      }
    }
  }
  out.push(`<line x1="0" y1="${top + half}" x2="${width}" y2="${top + half}" stroke="${C.grid}"/>`)

  // Volné dny přes celou výšku těla. V měřítku Měsíce / Čtvrtletí jen svátky a odstávky – víkendy by
  // byly jen husté proužky (stejně jako graf na obrazovce).
  const showWeekends = input.zoom === 'day' || input.zoom === 'week'
  for (const run of nonWorkingRuns(tl, input.calendar)) {
    if (!showWeekends && run.info.kind === 'weekend') continue
    const x = chartX + dayToX(tl, run.startDay)
    const w = (run.endDay - run.startDay) * tl.dayWidth
    out.push(`<rect x="${r1(x)}" y="${bodyTop}" width="${r1(w)}" height="${rows.length * ROW_HEIGHT}" fill="${run.info.kind === 'weekend' ? C.nonWorking : C.holiday}"/>`)
  }

  // Řádky: tabulka a mřížka.
  const bars = new Map<string, Bar>()
  rows.forEach((task, i) => {
    const y = bodyTop + i * ROW_HEIGHT
    const textY = y + ROW_HEIGHT / 2 + 4
    const s = scheduled.tasks.get(task.id)
    const isPhase = task.kind === 'phase'
    const cells: Record<(typeof COLUMNS)[number]['key'], string> = {
      number: String(from + i + 1),
      wbs: wbs.get(task.id) ?? '',
      name: truncate(task.name, NAME_CHARS - (depths.get(task.id) ?? 0) * 2),
      start: s?.start ? labels.formatDate(s.start) : '',
      finish: s?.finish ? labels.formatDate(s.finish) : '',
      duration: s?.durationDays === null || s?.durationDays === undefined ? '' : String(s.durationDays),
    }
    let x = 0
    for (const col of columns) {
      const indent = col.key === 'name' ? (depths.get(task.id) ?? 0) * INDENT : 0
      const tx = col.align === 'end' ? x + col.width - 6 : x + 6 + indent
      out.push(
        `<text x="${tx}" y="${textY}" fill="${C.ink}" text-anchor="${col.align}"${isPhase ? ' font-weight="700"' : ''}>${escapeXml(cells[col.key])}</text>`,
      )
      x += col.width
    }
    out.push(`<line x1="0" y1="${y + ROW_HEIGHT}" x2="${width}" y2="${y + ROW_HEIGHT}" stroke="${C.grid}"/>`)
    if (s?.start && s.finish) {
      const bar = barGeometry(tl, task.kind, s.start, s.finish, i)
      bars.set(task.id, { ...bar, xStart: bar.xStart + chartX, xEnd: bar.xEnd + chartX, centerY: bar.centerY + bodyTop })
    }
  })
  out.push(`<line x1="${chartX}" y1="${top}" x2="${chartX}" y2="${height}" stroke="${C.grid}"/>`)

  // Šipky vazeb (pod úsečkami).
  for (const task of rows) {
    const toBar = bars.get(task.id)
    if (!toBar) continue
    for (const dep of task.dependencies) {
      const fromBar = bars.get(dep.predecessorId)
      if (!fromBar) continue
      const crit = input.critical && !!scheduled.tasks.get(task.id)?.critical && !!scheduled.tasks.get(dep.predecessorId)?.critical
      out.push(
        `<path data-dep="${escapeXml(dep.predecessorId)}" d="${pointsToPath(dependencyPoints(fromBar, toBar, dep.type).map(([px, py]) => [r1(px), r1(py)]))}" fill="none" stroke="${crit ? C.criticalArrow : C.arrow}" stroke-width="${crit ? 1.75 : 1.25}" marker-end="url(#${crit ? 'ac' : 'a'})"/>`,
      )
    }
  }

  // Úsečky.
  for (const task of rows) {
    const bar = bars.get(task.id)
    if (!bar) continue
    const crit = input.critical && !!scheduled.tasks.get(task.id)?.critical
    const percent = Math.max(0, Math.min(100, percents.get(task.id) ?? task.percentComplete))
    const w = Math.max(2, bar.xEnd - bar.xStart)
    const attrs = `data-bar="${escapeXml(task.id)}"${crit ? ' data-critical="true"' : ''}`
    const cy = bar.centerY
    if (task.kind === 'milestone') {
      const cx = bar.xStart + MILESTONE_HALF
      const h = MILESTONE_HALF
      out.push(
        `<polygon ${attrs} points="${r1(cx)},${r1(cy - h)} ${r1(cx + h)},${r1(cy)} ${r1(cx)},${r1(cy + h)} ${r1(cx - h)},${r1(cy)}" fill="${crit ? C.critical : C.phase}" stroke="${crit ? C.criticalStroke : C.phase}"/>`,
      )
    } else if (task.kind === 'phase') {
      const y = cy - BAR_HALF_HEIGHT
      out.push(`<rect ${attrs} x="${r1(bar.xStart)}" y="${r1(y)}" width="${r1(w)}" height="6" fill="${crit ? C.criticalStroke : C.phase}"/>`)
      if (percent > 0) out.push(`<rect x="${r1(bar.xStart)}" y="${r1(y + 1.5)}" width="${r1((w * percent) / 100)}" height="3" fill="${C.phaseProgress}"/>`)
    } else {
      const y = cy - BAR_HALF_HEIGHT
      out.push(
        `<rect ${attrs} x="${r1(bar.xStart)}" y="${r1(y)}" width="${r1(w)}" height="${2 * BAR_HALF_HEIGHT}" rx="3" fill="${crit ? C.critical : C.task}" stroke="${crit ? C.criticalStroke : C.taskStroke}"/>`,
      )
      if (percent > 0) {
        out.push(
          `<rect x="${r1(bar.xStart + 1)}" y="${r1(y + 3)}" width="${r1(Math.max(0, (w * percent) / 100 - 2))}" height="${2 * BAR_HALF_HEIGHT - 6}" rx="2" fill="${crit ? C.criticalProgress : C.progress}"/>`,
        )
      }
    }
  }

  // Popisky vedle úseček (volba „Popisky“) – text je escapovaný.
  for (const task of rows) {
    const bar = bars.get(task.id)
    const text = barLabels.get(task.id)
    if (!bar || !text) continue
    const end = Math.max(bar.xEnd, bar.xStart + (task.kind === 'milestone' ? 2 * MILESTONE_HALF : 2))
    out.push(`<text x="${r1(end + LABEL_GAP)}" y="${r1(bar.centerY + 4)}" fill="${C.muted}">${escapeXml(text)}</text>`)
  }

  out.push('</svg>')
  return { svg: out.join(''), width, height }
}

/** Úroveň zanoření řádků (pro odsazení názvu) – z rodičů v seznamu řádků. */
function depthOf(rows: Task[]): Map<string, number> {
  const byId = new Map(rows.map((t) => [t.id, t]))
  const depths = new Map<string, number>()
  const depth = (task: Task, guard = 0): number => {
    const cached = depths.get(task.id)
    if (cached !== undefined) return cached
    const parent = task.parentId ? byId.get(task.parentId) : undefined
    const d = parent && guard < 10 ? depth(parent, guard + 1) + 1 : 0
    depths.set(task.id, d)
    return d
  }
  rows.forEach((t) => depth(t))
  return depths
}
