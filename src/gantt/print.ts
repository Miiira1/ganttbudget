/**
 * Tisk Ganttova diagramu / uložení do PDF (I-05, fáze 13a) – výpočty stránek, ČISTÉ FUNKCE s testy (print.test.ts).
 * Stránka = obrázek SVG z renderGanttSvg (jen část řádků) zmenšený na šířku papíru; každá stránka
 * má znovu název projektu a hlavičku osy. Papír je vždy na šířku s okraji 10 mm (viz @page v index.css).
 */
import { TITLE_HEIGHT } from './exportSvg'
import { HEADER_HEIGHT, ROW_HEIGHT } from './geometry'
import { ZOOMS, type Zoom } from './timeline'

const MM_TO_PX = 96 / 25.4
const MARGIN_MM = 10

/** Tisknutelná plocha papíru na šířku (bez okrajů) v obrazových bodech CSS (96 dpi). */
export const PAPERS = {
  a4: { widthPx: Math.floor((297 - 2 * MARGIN_MM) * MM_TO_PX), heightPx: Math.floor((210 - 2 * MARGIN_MM) * MM_TO_PX) },
  a3: { widthPx: Math.floor((420 - 2 * MARGIN_MM) * MM_TO_PX), heightPx: Math.floor((297 - 2 * MARGIN_MM) * MM_TO_PX) },
} as const
export type Paper = keyof typeof PAPERS

/** Nejmenší zmenšení, při kterém je text ještě čitelný (písmo 11 px → asi 5,5 px). */
const READABLE_SCALE = 0.5

/** Řádky po stránkách: od – do (bez „do“). Prázdný plán = jedna prázdná stránka. */
export function paginateRows(rowCount: number, rowsPerPage: number): { from: number; to: number }[] {
  const per = Math.max(1, Math.floor(rowsPerPage))
  if (rowCount === 0) return [{ from: 0, to: 0 }]
  const pages: { from: number; to: number }[] = []
  for (let from = 0; from < rowCount; from += per) pages.push({ from, to: Math.min(rowCount, from + per) })
  return pages
}

/** Zmenšení obrázku na šířku papíru (nikdy nezvětšit) a kolik řádků se vejde na stránku. */
export function printLayout(svgWidth: number, paper: Paper): { scale: number; rowsPerPage: number; headerPx: number } {
  const { widthPx, heightPx } = PAPERS[paper]
  const scale = Math.min(1, widthPx / Math.max(1, svgWidth))
  const rowsPerPage = Math.max(1, Math.floor((heightPx / scale - TITLE_HEIGHT - HEADER_HEIGHT - 1) / ROW_HEIGHT))
  return { scale, rowsPerPage, headerPx: TITLE_HEIGHT }
}

/** Automatické měřítko osy: nejpodrobnější, jehož obrázek jde zmenšit na šířku papíru čitelně; jinak nejhrubší. */
export function pickZoom(widths: Record<Zoom, number>, paper: Paper): Zoom {
  const fits = ZOOMS.find((z) => PAPERS[paper].widthPx / widths[z] >= READABLE_SCALE)
  return fits ?? ZOOMS[ZOOMS.length - 1]!
}
