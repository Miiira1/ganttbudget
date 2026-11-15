import { describe, expect, it } from 'vitest'
import { categoryUsage, departmentUsage, professionUsage, uniqueName } from './catalogs'
import { createEmptyProject, type Project } from './schema'

function project(): Project {
  const p = createEmptyProject({ name: 'T', language: 'cs', startDate: '2026-11-16' })
  p.professions = [{ id: 'p1', name: 'Elektrikář', categoryId: 'cat-labor', capacityPerDay: 8 }]
  p.workers = [
    { id: 'w1', name: 'Jan', professionId: 'p1', capacityPerDay: 8 },
    { id: 'w2', name: 'Eva', professionId: 'p1', capacityPerDay: 8 },
  ]
  p.materials = [
    { id: 'x1', name: 'Kabel', unit: 'm', unitPrice: 100, categoryId: 'cat-material' },
    { id: 'x2', name: 'Čidlo', unit: 'ks', unitPrice: 100, categoryId: 'cat-material' },
  ]
  p.machines = [{ id: 'm1', name: 'Jeřáb', categoryId: 'cat-material', rate: 100, rateUnit: 'hour', capacityPerDay: 8 }]
  return p
}

describe('číselníky: pomocné funkce', () => {
  it('jedinečný název pro novou položku (bez ohledu na velikost písmen)', () => {
    expect(uniqueName('Nový materiál', [])).toBe('Nový materiál')
    expect(uniqueName('Nový materiál', ['nový MATERIÁL'])).toBe('Nový materiál 2')
    expect(uniqueName('Nový materiál', ['Nový materiál', 'Nový materiál 2'])).toBe('Nový materiál 3')
  })

  it('kde všude se kategorie používá', () => {
    expect(categoryUsage(project(), 'cat-material')).toEqual({ professions: [], machines: ['Jeřáb'], materials: ['Kabel', 'Čidlo'], total: 3 })
    expect(categoryUsage(project(), 'cat-reserve').total).toBe(0)
  })

  it('kteří pracovníci mají profesi', () => {
    expect(professionUsage(project(), 'p1')).toEqual(['Jan', 'Eva'])
  })

  it('kteří pracovníci patří do střediska', () => {
    const p = project()
    p.departments = [{ id: 'd1', name: 'Výroba' }]
    p.workers[1]!.departmentId = 'd1'
    expect(departmentUsage(p, 'd1')).toEqual(['Eva'])
    expect(departmentUsage(p, 'd2')).toEqual([])
  })
})
