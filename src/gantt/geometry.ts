/**
 * Geometrie Ganttova grafu (G-07): kde leží úsečka činnosti, kosočtverec milníku
 * a kudy vede šipka vazby. Čisté funkce bez Reactu, otestované v geometry.test.ts.
 */
import { isoToDay } from '../engine/calendar'
import type { DependencyType, Task, TaskKind } from '../model/schema'
import { dayToX, type Timeline } from './timeline'

/** Výška jednoho řádku v pixelech – stejná v tabulce i v grafu. */
export const ROW_HEIGHT = 32
/** Výška hlavičky (dva řádky časové osy) – stejná jako hlavička tabulky. */
export const HEADER_HEIGHT = 48
/** Polovina výšky úsečky činnosti (a horní části fáze) – sem dosedá svislá šipka. */
export const BAR_HALF_HEIGHT = 8
/** Polovina šířky kosočtverce milníku. */
export const MILESTONE_HALF = 7
/** Jak daleko šipka vyjde z úsečky, než zahne. */
export const ARROW_GAP = 6
/** Nejkratší poslední úsek šipky, aby hrot měl jasný směr. */
const MIN_ENTRY = 4

export interface Bar {
  kind: TaskKind
  /** Levý okraj (začátek) – sem vede šipka do „začátku“. */
  xStart: number
  /** Pravý okraj (konec) – odsud vede šipka z „konce“. */
  xEnd: number
  /** Svislý střed řádku. */
  centerY: number
}

/**
 * Úsečka pro spočítané termíny. Činnost a fáze trvají od začátku prvního dne do konce
 * posledního dne. Milník leží na konci svého dne (tam, kde končí jeho předchůdce).
 */
export function barGeometry(tl: Timeline, kind: TaskKind, start: string, finish: string, rowIndex: number): Bar {
  const centerY = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2
  if (kind === 'milestone') {
    const x = dayToX(tl, isoToDay(finish) + 1)
    return { kind, xStart: x - MILESTONE_HALF, xEnd: x + MILESTONE_HALF, centerY }
  }
  return { kind, xStart: dayToX(tl, isoToDay(start)), xEnd: dayToX(tl, isoToDay(finish) + 1), centerY }
}

/**
 * Úsečky všech řádků (ID činnosti → úsečka). Řádky bez spočítaného termínu
 * (např. činnost v kruhu vazeb nebo fáze bez činností) úsečku nedostanou.
 */
export function layoutBars(
  tl: Timeline,
  rows: Task[],
  dates: Map<string, { start: string | null; finish: string | null }>,
): Map<string, Bar> {
  const bars = new Map<string, Bar>()
  rows.forEach((task, rowIndex) => {
    const d = dates.get(task.id)
    if (d?.start && d.finish) bars.set(task.id, barGeometry(tl, task.kind, d.start, d.finish, rowIndex))
  })
  return bars
}

export type Point = [number, number]

/**
 * Body pravoúhlé šipky od předchůdce k následníkovi.
 *  - Z „konce“ (FS, FF) šipka vyjde doprava, ze „začátku“ (SS, SF) doleva.
 *  - Do „začátku“ (FS, SS) vstoupí zleva, do „konce“ (FF, SF) zprava.
 *  - Když je na přímou cestu místo: vyjít, svisle k cílovému řádku, vodorovně do cíle.
 *  - Když šipka po ohybu klesá (stoupá) přímo nad (pod) úsečkou cíle – typicky činnost
 *    začínající hned další den: svisle do horní (spodní) hrany cíle, bez kličky.
 *  - Do milníku vždy svisle do jeho špičky (viz milestonePoints).
 *  - Jinak oklika mezerou mezi řádky (polovina výšky řádku směrem k cíli).
 */
export function dependencyPoints(from: Bar, to: Bar, type: DependencyType): Point[] {
  const fromEnd = type === 'FS' || type === 'FF'
  const toStart = type === 'FS' || type === 'SS'
  const exitDir = fromEnd ? 1 : -1
  const entryDir = toStart ? 1 : -1 // směr posledního úseku: +1 doprava, −1 doleva

  const x0 = fromEnd ? from.xEnd : from.xStart
  const y0 = from.centerY
  const xT = toStart ? to.xStart : to.xEnd
  const yT = to.centerY
  const vx = x0 + exitDir * ARROW_GAP

  // Do milníku vede šipka vždy svisle do jeho horní (dolní) špičky – vypadá to čistě.
  if (to.kind === 'milestone' && yT !== y0) return milestonePoints(from, to, x0, y0, exitDir)

  if (entryDir * (xT - vx) >= MIN_ENTRY) {
    return [
      [x0, y0],
      [vx, y0],
      [vx, yT],
      [xT, yT],
    ]
  }
  const down = yT >= y0 ? 1 : -1
  if (yT !== y0 && vx >= to.xStart && vx <= to.xEnd) {
    return [
      [x0, y0],
      [vx, y0],
      [vx, yT - down * BAR_HALF_HEIGHT],
    ]
  }
  const midY = y0 + down * (ROW_HEIGHT / 2)
  const ex = xT - entryDir * ARROW_GAP
  return [
    [x0, y0],
    [vx, y0],
    [vx, midY],
    [ex, midY],
    [ex, yT],
    [xT, yT],
  ]
}

/**
 * Šipka do milníku – vždy svisle do jeho špičky (horní, když je milník níž; dolní, když výš):
 *  - milník je ve směru výstupu šipky: vodorovně nad (pod) jeho střed, pak svisle do špičky,
 *  - milník leží nad / pod úsečkou předchůdce (typicky milník v den jejího konce):
 *    šipka spadne svisle z hrany úsečky (u milníku z jeho špičky) přímo do špičky cíle,
 *  - jinak oklika mezerou mezi řádky a svisle do špičky.
 */
function milestonePoints(from: Bar, to: Bar, x0: number, y0: number, exitDir: 1 | -1): Point[] {
  const cx = to.xStart + MILESTONE_HALF
  const down = to.centerY > y0 ? 1 : -1
  const tip = to.centerY - down * MILESTONE_HALF

  if (exitDir * (cx - x0) > 1) {
    return [
      [x0, y0],
      [cx, y0],
      [cx, tip],
    ]
  }
  if (cx >= from.xStart - 1 && cx <= from.xEnd + 1) {
    const edge = from.kind === 'milestone' ? MILESTONE_HALF - Math.abs(cx - (from.xStart + MILESTONE_HALF)) : BAR_HALF_HEIGHT
    return [
      [cx, y0 + down * edge],
      [cx, tip],
    ]
  }
  const vx = x0 + exitDir * ARROW_GAP
  const midY = y0 + down * (ROW_HEIGHT / 2)
  return [
    [x0, y0],
    [vx, y0],
    [vx, midY],
    [cx, midY],
    [cx, tip],
  ]
}

/** Body šipky jako SVG cesta „M x y L x y …“. */
export function pointsToPath(points: Point[]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
}
