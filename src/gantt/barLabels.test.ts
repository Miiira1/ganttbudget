import { describe, expect, it } from 'vitest'
import { BAR_LABEL_FIELDS, barLabelText, buildBarLabels, estimateLabelWidth, labelsTrailingPx, parseBarLabelFields, serializeBarLabelFields, type BarLabelData, type BarLabelFormat } from './barLabels'

const fmt: BarLabelFormat = {
  date: (iso) => iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.',
  duration: (days) => `${days} d`,
  percent: (pct) => `${pct} %`,
  money: (amount) => `${amount / 100} Kč`,
}
const task: BarLabelData = { name: 'Montáž', kind: 'task', start: '2026-12-07', finish: '2026-12-09', durationDays: 3, percent: 40, cost: 1_250_000 }

describe('popisky vedle úseček Gantta', () => {
  it('nabízené údaje: název, termín, délka, % hotovo, náklady', () => {
    expect(BAR_LABEL_FIELDS).toEqual(['name', 'dates', 'duration', 'percent', 'cost'])
  })

  it('skládá jen vybrané údaje v pevném pořadí, oddělené tečkou', () => {
    expect(barLabelText(task, ['percent', 'name'], fmt)).toBe('Montáž · 40 %')
    expect(barLabelText(task, ['name', 'dates', 'duration', 'percent', 'cost'], fmt)).toBe('Montáž · 07.12.–09.12. · 3 d · 40 % · 12500 Kč')
    expect(barLabelText(task, [], fmt)).toBe('')
  })

  it('milník: jedno datum, bez délky; jednodenní činnost: jedno datum', () => {
    const milestone: BarLabelData = { ...task, kind: 'milestone', start: '2026-12-09', finish: '2026-12-09', durationDays: 0 }
    expect(barLabelText(milestone, ['name', 'dates', 'duration'], fmt)).toBe('Montáž · 09.12.')
    expect(barLabelText({ ...task, finish: '2026-12-07', durationDays: 1 }, ['dates'], fmt)).toBe('07.12.')
  })

  it('nulové náklady se nevypisují', () => {
    expect(barLabelText({ ...task, cost: 0 }, ['name', 'cost'], fmt)).toBe('Montáž')
  })

  it('volba z prohlížeče: neznámé hodnoty pryč, bez uložené volby = jen Název', () => {
    expect(parseBarLabelFields(null)).toEqual(['name'])
    expect(parseBarLabelFields('')).toEqual([])
    expect(parseBarLabelFields('cost,xyz,name,name')).toEqual(['name', 'cost'])
    expect(serializeBarLabelFields(['percent', 'name'])).toBe('name,percent')
  })

  it('odhad šířky textu roste s délkou (pro prodloužení osy)', () => {
    expect(estimateLabelWidth('')).toBe(0)
    expect(estimateLabelWidth('Montáž · 40 %')).toBeGreaterThan(estimateLabelWidth('Montáž'))
  })

  it('popisky všech řádků: délka fáze ze spočítaných termínů, řádky bez termínu se vynechají', () => {
    const rows = [
      { id: 'f', name: 'Fáze', kind: 'phase' as const, durationDays: 0 },
      { id: 'a', name: 'A', kind: 'task' as const, durationDays: 2 },
      { id: 'x', name: 'V kruhu', kind: 'task' as const, durationDays: 1 },
    ]
    const dates = new Map([
      ['f', { start: '2026-12-07', finish: '2026-12-11', durationDays: 5 }],
      ['a', { start: '2026-12-07', finish: '2026-12-08', durationDays: null }],
      ['x', { start: null, finish: null, durationDays: null }],
    ])
    const labels = buildBarLabels(rows, dates, new Map([['a', 50]]), (id) => (id === 'f' ? 100 : 0), ['name', 'duration', 'percent'], fmt)
    expect([...labels]).toEqual([
      ['f', 'Fáze · 5 d · 0 %'],
      ['a', 'A · 2 d · 50 %'],
    ])
    expect(buildBarLabels(rows, dates, new Map(), () => 0, [], fmt).size).toBe(0)
    expect(labelsTrailingPx(new Map())).toBe(0)
    expect(labelsTrailingPx(labels)).toBeGreaterThan(estimateLabelWidth('Fáze · 5 d · 0 %'))
  })
})
