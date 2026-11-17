import { describe, expect, it } from 'vitest'
import { effectiveWorkerRate, professionRate, workingDaysInYear } from '../model/rates'
import { ProjectSchema } from '../model/schema'
import { schedule } from '../engine/schedule'
import { computeCosts } from '../model/costs'
import { isoToDay } from '../engine/calendar'
import { earnedValue } from '../model/earnedValue'
import { addSampleTracking, createSampleProject } from './automatizace'
import { translateCs } from './translateForTests'

describe('vzorová databáze zdrojů (fáze 6a)', () => {
  const project = createSampleProject(translateCs, 'cs', '2026-11-16')
  const fund = workingDaysInYear(project.calendar, 2026)

  it('je platná podle schématu a všechny názvy jsou přeložené', () => {
    expect(ProjectSchema.safeParse(project).success).toBe(true)
  })

  it('obsahuje profese, pracovníky, střediska, stroje a materiály v rozumném množství', () => {
    expect(project.professions.length).toBeGreaterThanOrEqual(5)
    expect(project.workers.length).toBeGreaterThanOrEqual(6)
    expect(project.workers.length).toBeLessThanOrEqual(8)
    expect(project.departments.length).toBeGreaterThanOrEqual(3)
    expect(project.machines).toHaveLength(3)
    expect(project.materials.length).toBeGreaterThanOrEqual(8)
    expect(project.materials.length).toBeLessThanOrEqual(10)
  })

  it('každá profese i pracovník má sazbu; ukázány jsou všechny tři způsoby (ruční, kalkulace, podle profese)', () => {
    expect(project.professions.every((p) => professionRate(p, fund) !== null)).toBe(true)
    const byId = new Map(project.professions.map((p) => [p.id, p]))
    const sources = project.workers.map((w) => effectiveWorkerRate(w, byId.get(w.professionId)!, fund))
    expect(sources.every((s) => s.rate !== null && s.rate > 0)).toBe(true)
    expect(new Set(sources.map((s) => s.source))).toEqual(new Set(['manual', 'calc', 'profession']))
  })

  it('většina činností má zdroje a náklady (fáze 6b); rozpočet je realistický', () => {
    const withLines = project.tasks.filter((t) => t.lines.length > 0)
    expect(withLines.length).toBeGreaterThanOrEqual(15)
    const costs = computeCosts(project, schedule(project))
    expect(costs.project.total).toBeGreaterThan(500_000_000) // přes 5 mil. Kč
    expect(costs.project.total).toBeLessThan(2_000_000_000) // pod 20 mil. Kč
    for (const part of ['labor', 'machines', 'material', 'other'] as const) expect(costs.project[part]).toBeGreaterThan(0)
    expect([...costs.lines.values()].every((c) => c.warning === null)).toBe(true)
  })

  it('kritická cesta vede od první analýzy až k předání; souběžné činnosti mají rezervu', () => {
    const s = schedule(project)
    const critical = (key: string) => s.tasks.get(`sample-${key}`)!.critical
    for (const key of ['t1a', 't1b', 't2a', 't2b', 'm2', 't3a', 't3b', 't4a', 't7b', 't8a', 'm8']) expect(critical(key), key).toBe(true)
    // Úprava podlahy (SS+10 od výroby) a náhradní ruční výroba nejsou kritické.
    expect(critical('t5a')).toBe(false)
    expect(s.tasks.get('sample-t5a')!.totalSlack).toBeGreaterThan(0)
  })

  it('sazby jsou realistické (200–1 500 Kč/h)', () => {
    for (const p of project.professions) {
      const rate = professionRate(p, fund)!
      expect(rate).toBeGreaterThanOrEqual(20_000)
      expect(rate).toBeLessThanOrEqual(150_000)
    }
  })
})

describe('vzorový projekt v běhu – baseline, % hotovo a skutečnost (fáze 9)', () => {
  const project = createSampleProject(translateCs, 'cs', '2026-11-16')
  // Stejně jako tlačítko Vzorový projekt: začátek 8 týdnů před dneškem.
  addSampleTracking(project, translateCs, '2027-01-11')
  const scheduled = schedule(project)

  it('je platný; baseline uložená k začátku projektu je vybraná ke srovnání', () => {
    expect(ProjectSchema.safeParse(project).success).toBe(true)
    expect(project.baselines).toHaveLength(1)
    expect(project.baselines[0]).toMatchObject({ savedAt: '2026-11-16', name: translateCs('sample.baselineName') })
    expect(project.activeBaselineId).toBe(project.baselines[0]!.id)
  })

  it('hotové činnosti mají 100 %, rozpracované méně, budoucí 0 %; skutečnost jen do včerejška', () => {
    const percents = project.tasks.filter((t) => t.kind === 'task').map((t) => t.percentComplete)
    expect(percents).toContain(100)
    expect(percents.some((p) => p > 0 && p < 100)).toBe(true)
    expect(percents).toContain(0)
    const dates = project.tasks.flatMap((t) => (t.actuals ?? []).map((a) => a.date))
    expect(dates.length).toBeGreaterThan(0)
    expect(dates.every((d) => d <= '2027-01-10')).toBe(true)
  })

  it('Earned Value: BAC = náklady projektu, projekt je mírně pozadu a mírně dražší', () => {
    const ev = earnedValue(project, scheduled, project.baselines[0]!, isoToDay('2027-01-11'))
    expect(ev.totals.bac).toBe(computeCosts(project, scheduled).project.total)
    expect(ev.totals.spi).toBeGreaterThan(0.7)
    expect(ev.totals.spi).toBeLessThan(1)
    expect(ev.totals.cpi).toBeGreaterThan(0.85)
    expect(ev.totals.cpi).toBeLessThan(1)
  })
})
