import { describe, expect, it } from 'vitest'
import { createDefaultRateCalc } from '../model/rates'
import { createEmptyProject, ProjectSchema, type Project } from '../model/schema'
import { buildLibrary, mergeLibrary, parseLibraryFile, planMerge, serializeLibrary, type Library } from './libraryFile'
import { MAX_FILE_CHARS, serializeProject } from './projectFile'

/** Projekt s databází zdrojů (zdroj knihovny). */
function source(): Project {
  const p = createEmptyProject({ name: 'Zdroj', language: 'cs', startDate: '2026-11-16' })
  p.departments = [{ id: 'd1', name: 'Výroba', code: '120' }]
  p.professions = [
    { id: 'p1', name: 'Programátor PLC', categoryId: 'cat-labor', capacityPerDay: 8, rateCalc: { ...createDefaultRateCalc(), monthlyWage: 6_000_000 } },
    { id: 'p2', name: 'Elektrikář', categoryId: 'cat-labor', capacityPerDay: 8, manualRate: 45_000 },
  ]
  p.workers = [{ id: 'w1', name: 'Jan Novák', professionId: 'p1', departmentId: 'd1', capacityPerDay: 8 }]
  p.machines = [{ id: 'm1', name: 'Jeřáb', categoryId: 'cat-services', rate: 150_000, rateUnit: 'hour', capacityPerDay: 8 }]
  p.materials = [{ id: 'x1', name: 'Kabel', unit: 'm', unitPrice: 3_250, categoryId: 'cat-material', code: 'K-1' }]
  return p
}

let n = 0
const makeId = () => `new${++n}`

function ok(text: string): Library {
  const result = parseLibraryFile(text)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.library
}

describe('soubor knihovny zdrojů (Z-05)', () => {
  it('uložit → načíst vrátí stejné číselníky; úkoly a nastavení projektu v knihovně nejsou', () => {
    const library = ok(serializeLibrary(buildLibrary(source())))
    expect(library).toMatchObject({ kind: 'ganttbudget-library', libraryVersion: 1, currency: 'CZK' })
    expect(library.professions).toEqual(source().professions)
    expect(library.workers).toEqual(source().workers)
    expect('tasks' in library).toBe(false)
  })

  it('poškozený, cizí, novější a příliš velký soubor', () => {
    expect(parseLibraryFile('{"kind": ')).toEqual({ ok: false, error: { code: 'notJson' } })
    expect(parseLibraryFile(serializeProject(source()))).toEqual({ ok: false, error: { code: 'notLibrary' } })
    const newer = { ...buildLibrary(source()), libraryVersion: 2 }
    expect(parseLibraryFile(JSON.stringify(newer))).toEqual({ ok: false, error: { code: 'newerVersion', version: 2 } })
    expect(parseLibraryFile(' '.repeat(MAX_FILE_CHARS + 1))).toEqual({ ok: false, error: { code: 'tooLarge' } })
  })

  it('neplatná data (odkaz na neexistující profesi) se nepoužijí', () => {
    const bad = buildLibrary(source())
    bad.workers[0]!.professionId = 'nic'
    const result = parseLibraryFile(JSON.stringify(bad))
    expect(result.ok === false && result.error.code === 'invalid' && result.error.issues[0]!.message).toBe('unknownProfession')
  })
})

describe('načtení knihovny do projektu: nové přidat, změněné aktualizovat, nic nemazat', () => {
  const library = () => buildLibrary(source())

  it('do prázdného projektu: vše nové, odkazy se přemapují na nová ID', () => {
    const target = createEmptyProject({ name: 'Cíl', language: 'cs', startDate: '2026-11-16' })
    const plan = planMerge(target, library())
    expect(plan.currencyMismatch).toBe(false)
    expect(plan.counts.professions).toEqual({ added: 2, changed: 0, unchanged: 0 })
    expect(plan.counts.costCategories).toEqual({ added: 0, changed: 0, unchanged: 6 }) // výchozí kategorie už jsou
    const merged = mergeLibrary(target, library(), makeId)
    expect(ProjectSchema.safeParse(merged).success).toBe(true)
    const worker = merged.workers[0]!
    expect(merged.professions.find((p) => p.id === worker.professionId)!.name).toBe('Programátor PLC')
    expect(merged.departments.find((d) => d.id === worker.departmentId)!.name).toBe('Výroba')
    expect(merged.professions.every((p) => p.id.startsWith('new'))).toBe(true)
    expect(merged.name).toBe('Cíl') // projekt sám se nemění
  })

  it('stejné názvy (i jiná velikost písmen): změněné se aktualizují a ponechají si ID, chybějící zůstanou', () => {
    const target = createEmptyProject({ name: 'Cíl', language: 'cs', startDate: '2026-11-16' })
    target.professions = [
      { id: 'mine', name: 'ELEKTRIKÁŘ', categoryId: 'cat-labor', capacityPerDay: 8, manualRate: 40_000 }, // jiná sazba
      { id: 'own', name: 'Svářeč', categoryId: 'cat-labor', capacityPerDay: 8 }, // v knihovně není
    ]
    target.materials = [{ id: 'k', name: 'Kabel', unit: 'm', unitPrice: 3_250, categoryId: 'cat-material', code: 'K-1' }] // stejný
    const plan = planMerge(target, library())
    expect(plan.counts.professions).toEqual({ added: 1, changed: 1, unchanged: 0 })
    expect(plan.counts.materials).toEqual({ added: 0, changed: 0, unchanged: 1 })
    const merged = mergeLibrary(target, library(), makeId)
    const electrician = merged.professions.find((p) => p.id === 'mine')!
    expect(electrician).toMatchObject({ name: 'Elektrikář', manualRate: 45_000 })
    expect(merged.professions.map((p) => p.name)).toEqual(['Elektrikář', 'Svářeč', 'Programátor PLC'])
    expect(merged.materials).toEqual(target.materials) // beze změny = stejný objekt i ID
    expect(ProjectSchema.safeParse(merged).success).toBe(true)
  })

  it('odkaz na kategorii podle názvu: knihovna s vlastní kategorií se přidá a použije', () => {
    const lib = library()
    lib.costCategories.push({ id: 'lib-cat', name: 'Doprava' })
    lib.machines[0]!.categoryId = 'lib-cat'
    const target = createEmptyProject({ name: 'Cíl', language: 'cs', startDate: '2026-11-16' })
    const merged = mergeLibrary(target, lib, makeId)
    const category = merged.costCategories.find((c) => c.name === 'Doprava')!
    expect(merged.machines[0]!.categoryId).toBe(category.id)
  })

  it('jiná měna knihovny → import se nesmí použít', () => {
    const target = { ...createEmptyProject({ name: 'Cíl', language: 'cs', startDate: '2026-11-16' }), currency: 'EUR' }
    expect(planMerge(target, library()).currencyMismatch).toBe(true)
  })

  it('opakované načtení stejné knihovny už nic nezmění', () => {
    const target = createEmptyProject({ name: 'Cíl', language: 'cs', startDate: '2026-11-16' })
    const once = mergeLibrary(target, library(), makeId)
    const plan = planMerge(once, library())
    expect(Object.values(plan.counts).every((c) => c.added === 0 && c.changed === 0)).toBe(true)
    expect(mergeLibrary(once, library(), makeId)).toEqual(once)
  })
})
