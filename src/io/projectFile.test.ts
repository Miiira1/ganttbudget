import { describe, expect, it } from 'vitest'
import { createSampleProject } from '../samples/automatizace'
import { SCHEMA_VERSION } from '../model/schema'
import { fileNameFor, MAX_FILE_CHARS, parseProjectFile, serializeProject } from './projectFile'

/** Vzorový projekt s „přeloženými“ názvy = klíči (překlady tu nepotřebujeme). */
const sample = () => createSampleProject((key) => key, 'cs', '2026-11-16')

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
    expect(text.startsWith('{\n  "schemaVersion": 1,')).toBe(true)
    expect(text.endsWith('\n')).toBe(true)
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

  it('příliš velký soubor se ani nečte', () => {
    expect(parseProjectFile(' '.repeat(MAX_FILE_CHARS + 1))).toEqual({ ok: false, error: { code: 'tooLarge' } })
  })

  it('název souboru z názvu projektu (bez znaků, které Windows nepovolí)', () => {
    expect(fileNameFor({ ...sample(), name: 'Zavedení automatizace / výroby: v2?' })).toBe(
      'Zavedení automatizace výroby v2.ganttbudget.json',
    )
    expect(fileNameFor({ ...sample(), name: '***' })).toBe('projekt.ganttbudget.json')
  })
})
