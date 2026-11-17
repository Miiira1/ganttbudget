import { describe, expect, it } from 'vitest'
import { HEADER_HEIGHT, ROW_HEIGHT } from './geometry'
import { PAPERS, paginateRows, pickZoom, printLayout } from './print'

describe('tisk – stránkování', () => {
  it('rozdělí řádky po stránkách, poslední stránka může být kratší', () => {
    expect(paginateRows(0, 10)).toEqual([{ from: 0, to: 0 }])
    expect(paginateRows(25, 10)).toEqual([
      { from: 0, to: 10 },
      { from: 10, to: 20 },
      { from: 20, to: 25 },
    ])
    expect(paginateRows(10, 10)).toEqual([{ from: 0, to: 10 }])
  })

  it('A3 má víc místa než A4 (širší i vyšší)', () => {
    expect(PAPERS.a3.widthPx).toBeGreaterThan(PAPERS.a4.widthPx)
    expect(PAPERS.a3.heightPx).toBeGreaterThan(PAPERS.a4.heightPx)
  })

  it('obrázek se zmenší na šířku stránky (nikdy nezvětší) a podle toho se vejde víc řádků', () => {
    const narrow = printLayout(800, 'a4')
    expect(narrow.scale).toBe(1)
    const wide = printLayout(PAPERS.a4.widthPx * 2, 'a4')
    expect(wide.scale).toBeCloseTo(0.5)
    expect(wide.rowsPerPage).toBeGreaterThan(narrow.rowsPerPage)
    // Na stránku se vejde nadpis, hlavička osy a celé řádky.
    const used = (narrow.headerPx + HEADER_HEIGHT + narrow.rowsPerPage * ROW_HEIGHT) * narrow.scale
    expect(used).toBeLessThanOrEqual(PAPERS.a4.heightPx)
    expect(used + ROW_HEIGHT * narrow.scale).toBeGreaterThan(PAPERS.a4.heightPx)
  })

  it('automatické měřítko: nejpodrobnější osa, která se na papír vejde čitelně', () => {
    const widths = { day: 6000, week: 2600, month: 1100, quarter: 600 }
    expect(pickZoom(widths, 'a4')).toBe('month')
    expect(pickZoom(widths, 'a3')).toBe('week')
    // Když se nevejde nic, zůstane nejhrubší osa.
    expect(pickZoom({ day: 90000, week: 40000, month: 20000, quarter: 9000 }, 'a4')).toBe('quarter')
  })
})
