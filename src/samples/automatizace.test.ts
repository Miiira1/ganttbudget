import { describe, expect, it } from 'vitest'
import { effectiveWorkerRate, professionRate, workingDaysInYear } from '../model/rates'
import { ProjectSchema } from '../model/schema'
import { schedule } from '../engine/schedule'
import { computeCosts } from '../model/costs'
import { createSampleProject } from './automatizace'
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

  it('sazby jsou realistické (200–1 500 Kč/h)', () => {
    for (const p of project.professions) {
      const rate = professionRate(p, fund)!
      expect(rate).toBeGreaterThanOrEqual(20_000)
      expect(rate).toBeLessThanOrEqual(150_000)
    }
  })
})
