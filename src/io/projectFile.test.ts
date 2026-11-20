import { describe, expect, it } from 'vitest'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import { SCHEMA_VERSION } from '../model/schema'
import { fileNameFor, MAX_FILE_CHARS, MAX_PROJECT_FILE_CHARS, parseProjectFile, projectFileFits, serializeProject } from './projectFile'

/** Vzorový projekt s „přeloženými“ názvy = klíči (překlady tu nepotřebujeme). */
const sample = () => createSampleProject(translateCs, 'cs', '2026-11-16')

describe('soubor projektu (JSON)', () => {
  it('uložit → načíst vrátí přesně stejný projekt', () => {
    const project = sample()
    project.tasks[1]!.constraintStart = '2026-11-25'
    project.tasks[1]!.notes = 'Poznámka s „uvozovkami“, diakritikou a\nnovým řádkem'
    const result = parseProjectFile(serializeProject(project))
    expect(result).toEqual({ ok: true, project })
  })

  it('uložený soubor je čitelný a obsahuje verzi formátu', () => {
    const text = serializeProject(sample())
    expect(text.startsWith('{\n  "schemaVersion": 2,')).toBe(true)
    expect(text.endsWith('\n')).toBe(true)
  })

  describe('starší soubor (formát 1 z fáze 5) se převede sám', () => {
    /** Projekt ve tvaru formátu 1: bez číselníků, s assignments a prázdnými resources / costItems. */
    function asVersion1(language = 'cs') {
      const { professions, workers, machines, materials, ...rest } = { ...sample(), language }
      void [professions, workers, machines, materials]
      return {
        ...rest,
        schemaVersion: 1,
        resources: [],
        costCategories: [],
        costItems: [],
        tasks: rest.tasks.map(({ lines, ...task }) => (void lines, { ...task, assignments: [] })),
      }
    }

    it('formát 1 → 2: výchozí kategorie podle jazyka, prázdné číselníky, činnosti beze změny', () => {
      const old = asVersion1()
      const result = parseProjectFile(JSON.stringify(old))
      if (!result.ok) throw new Error(JSON.stringify(result.error))
      expect(result.project.schemaVersion).toBe(2)
      expect(result.project.costCategories.map((c) => c.name)).toEqual(['Materiál', 'Mzdy', 'Služby', 'Investice', 'Režie', 'Rezerva'])
      expect([result.project.professions, result.project.workers, result.project.machines, result.project.materials]).toEqual([[], [], [], []])
      expect(result.project.tasks).toEqual(sample().tasks.map((t) => ({ ...t, lines: [] }))) // formát 1 řádky neměl
      expect('resources' in result.project || 'costItems' in result.project).toBe(false)
    })

    it('anglický projekt dostane anglické kategorie', () => {
      const result = parseProjectFile(JSON.stringify(asVersion1('en')))
      expect(result.ok && result.project.costCategories[0]!.name).toBe('Material')
    })

    it('neplatný soubor formátu 1 se po převodu odmítne s místem chyby', () => {
      const old = asVersion1()
      old.tasks[0]!.name = ''
      const result = parseProjectFile(JSON.stringify(old))
      expect(result.ok === false && result.error.code === 'invalid' && result.error.issues[0]!.path).toBe('tasks.0.name')
    })
  })

  it('poškozený JSON', () => {
    expect(parseProjectFile('{"schemaVersion": 1, "name": ')).toEqual({ ok: false, error: { code: 'notJson' } })
  })

  it('cizí soubor (JSON, ale ne projekt)', () => {
    expect(parseProjectFile('{"ahoj": 1}')).toEqual({ ok: false, error: { code: 'notProject' } })
    expect(parseProjectFile('[1, 2, 3]')).toEqual({ ok: false, error: { code: 'notProject' } })
    expect(parseProjectFile('"text"')).toEqual({ ok: false, error: { code: 'notProject' } })
    expect(parseProjectFile('null')).toEqual({ ok: false, error: { code: 'notProject' } })
  })

  it('soubor z novější verze aplikace', () => {
    const text = serializeProject({ ...sample(), schemaVersion: SCHEMA_VERSION + 1 } as never)
    expect(parseProjectFile(text)).toEqual({ ok: false, error: { code: 'newerVersion', version: SCHEMA_VERSION + 1 } })
  })

  it('neplatná data se nepoužijí ani částečně – vrátí se seznam problémů s místem', () => {
    const project = sample()
    project.tasks[0]!.name = ''
    project.tasks[2]!.percentComplete = 150
    const result = parseProjectFile(serializeProject(project))
    expect(result.ok).toBe(false)
    if (result.ok || result.error.code !== 'invalid') throw new Error('čekal jsem chybu invalid')
    expect(result.error.issues.map((i) => i.path)).toEqual(['tasks.0.name', 'tasks.2.percentComplete'])
  })

  it('kruh v nadřazených v souboru se odhalí', () => {
    const project = sample()
    // fáze 1 pod fází 2 a fáze 2 pod fází 1
    project.tasks[0]!.parentId = 'sample-p2'
    project.tasks.find((t) => t.id === 'sample-p2')!.parentId = 'sample-p1'
    const result = parseProjectFile(serializeProject(project))
    expect(result.ok === false && result.error.code === 'invalid' && result.error.issues.some((i) => i.message === 'parentCycle')).toBe(true)
  })

  it('příliš velký soubor se ani nečte (limit souboru projektu 50 MB)', () => {
    expect(parseProjectFile(' '.repeat(MAX_PROJECT_FILE_CHARS + 1))).toEqual({ ok: false, error: { code: 'tooLarge' } })
  })

  it('soubor projektu větší než limit importů (5 MB) se otevře (audit R1)', () => {
    // Velký projekt (např. 4 000 činností) má přes 5 MB – musí jít znovu otevřít.
    const project = sample()
    const text = serializeProject(project) + ' '.repeat(MAX_FILE_CHARS + 1)
    expect(text.length).toBeGreaterThan(MAX_FILE_CHARS)
    expect(parseProjectFile(text)).toEqual({ ok: true, project })
  })

  it('úsporný zápis (bez odsazení) se načte stejně a je menší', () => {
    const project = sample()
    const compact = serializeProject(project, { compact: true })
    expect(compact.startsWith('{"schemaVersion":2,')).toBe(true)
    expect(compact.length).toBeLessThan(serializeProject(project).length * 0.8)
    expect(parseProjectFile(compact)).toEqual({ ok: true, project })
  })

  it('kontrola před uložením: vejde se soubor do limitu? (počítá bajty, ne znaky)', () => {
    expect(projectFileFits('{}')).toBe(true)
    expect(projectFileFits('a'.repeat(MAX_PROJECT_FILE_CHARS))).toBe(true)
    expect(projectFileFits('a'.repeat(MAX_PROJECT_FILE_CHARS + 1))).toBe(false)
    // „č“ má v souboru 2 bajty – znaků je málo, ale bajtů přes limit.
    expect(projectFileFits('č'.repeat(MAX_PROJECT_FILE_CHARS / 2 + 1))).toBe(false)
  })

  it('název souboru z názvu projektu (bez znaků, které Windows nepovolí)', () => {
    expect(fileNameFor({ ...sample(), name: 'Zavedení automatizace / výroby: v2?' })).toBe(
      'Zavedení automatizace výroby v2.ganttbudget.json',
    )
    expect(fileNameFor({ ...sample(), name: '***' })).toBe('projekt.ganttbudget.json')
  })
})
