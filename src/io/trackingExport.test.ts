import { describe, expect, it } from 'vitest'
import type { EarnedValueResult, EvRow } from '../model/earnedValue'
import { buildTrackingExport } from './trackingExport'

const row = (r: Partial<EvRow> & Pick<EvRow, 'taskId' | 'name'>): EvRow => ({
  kind: 'task',
  parentId: null,
  inPlan: true,
  inBaseline: true,
  percent: 0,
  bac: 0,
  pv: 0,
  ev: 0,
  ac: 0,
  baselineStart: null,
  baselineFinish: null,
  start: null,
  finish: null,
  startShift: null,
  finishShift: null,
  ...r,
})

describe('export tabulky Sledování', () => {
  it('řádky ve stromu (odsazení podle úrovně), peníze v Kč, stav položky, řádek Celkem', () => {
    const rows = [
      row({ taskId: 'P', name: 'Fáze', kind: 'phase', percent: 54, bac: 1_300_000, pv: 900_000, ev: 700_000, ac: 600_000, baselineStart: '2026-11-16', baselineFinish: '2026-11-23', start: '2026-11-16', finish: '2026-11-24', finishShift: 1, startShift: 0 }),
      row({ taskId: 'A', name: '=SUM(A1)', parentId: 'P', percent: 40, bac: 1_000_000, pv: 600_000, ev: 400_000, ac: 250_000 }),
      row({ taskId: 'C', name: 'Nová', parentId: 'P', inBaseline: false, ac: 1_000 }),
      row({ taskId: 'B', name: 'Smazaná', parentId: 'P', inPlan: false, bac: 300_000, pv: 300_000 }),
    ]
    const ev: EarnedValueResult = {
      statusDay: 0,
      rows,
      byId: new Map(rows.map((r) => [r.taskId, r])),
      totals: { bac: 1_300_000, pv: 900_000, ev: 700_000, ac: 600_000, sv: -200_000, cv: 100_000, spi: 0.78, cpi: 1.17, eac: 1_114_286, etc: 514_286, vac: 185_714 },
    }
    const table = buildTrackingExport(ev, {
      headers: ['WBS', 'Název', 'Stav', 'Zač. B', 'Kon. B', 'Zač.', 'Kon.', 'Posun', '%', 'BAC', 'PV', 'EV', 'AC', 'CV', 'SV'],
      wbs: new Map([
        ['P', '1'],
        ['A', '1.1'],
        ['C', '1.2'],
      ]),
      status: (r) => (!r.inPlan ? 'jen v baseline' : !r.inBaseline ? 'nová' : ''),
      total: 'Celkem',
    })
    expect(table.headers).toHaveLength(15)
    expect(table.rows).toEqual([
      ['1', 'Fáze', '', '2026-11-16', '2026-11-23', '2026-11-16', '2026-11-24', 1, 54, 13_000, 9_000, 7_000, 6_000, 1_000, -2_000],
      // Text začínající „=“ ochrání až toCsv / toXlsxSheets; tady jen odsazení podle úrovně.
      ['1.1', '   =SUM(A1)', '', null, null, null, null, null, 40, 10_000, 6_000, 4_000, 2_500, 1_500, -2_000],
      ['1.2', '   Nová', 'nová', null, null, null, null, null, 0, 0, 0, 0, 10, -10, 0],
      ['', '   Smazaná', 'jen v baseline', null, null, null, null, null, 0, 3_000, 3_000, 0, 0, 0, -3_000],
      ['', 'Celkem', '', null, null, null, null, null, 54, 13_000, 9_000, 7_000, 6_000, 1_000, -2_000],
    ])
  })
})
