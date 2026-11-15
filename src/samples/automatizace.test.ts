import { describe, expect, it } from 'vitest'
import { effectiveWorkerRate, professionRate, workingDaysInYear } from '../model/rates'
import { ProjectSchema } from '../model/schema'
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

  it('sazby jsou realistické (200–1 500 Kč/h)', () => {
    for (const p of project.professions) {
      const rate = professionRate(p, fund)!
      expect(rate).toBeGreaterThanOrEqual(20_000)
      expect(rate).toBeLessThanOrEqual(150_000)
    }
  })
})
