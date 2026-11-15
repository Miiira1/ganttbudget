import { describe, expect, it } from 'vitest'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import { schedule } from '../engine/schedule'
import { depthMap, treeOrder } from '../model/hierarchy'
import { formatPredecessors } from '../model/predecessors'
import { createEmptyProject, ProjectSchema, type Project } from '../model/schema'
import cs from '../i18n/locales/cs.json'
import en from '../i18n/locales/en.json'
import { buildExportTable, EXPORT_COLUMNS, toCsv } from './tableExport'
import { toXlsx } from './xlsxExport'
import { importTable, readCsv, type ImportResult } from './tableImport'
import { readXlsx } from './xlsxImport'

/** Vzorový projekt s omezením, poznámkami (i „vzorcem“) a všemi typy vazeb. */
function sample(): Project {
  const project = createSampleProject(translateCs, 'cs', '2026-11-16')
  const t1a = project.tasks.find((t) => t.id === 'sample-t1a')!
  t1a.constraintStart = '2026-11-18'
  t1a.notes = '=1+1 a „uvozovky“; středník'
  t1a.percentComplete = 40
  return project
}

/** Obsah projektu bez ID (ta import vytvoří nová): osnova se vším, co se exportuje. */
function content(project: Project) {
  const depths = depthMap(project)
  return treeOrder(project).map((t) => ({
    level: depths.get(t.id),
    name: t.name,
    kind: t.kind,
    duration: t.kind === 'phase' ? null : t.durationDays,
    predecessors: formatPredecessors(project, t),
    constraint: t.constraintStart ?? null,
    percent: t.percentComplete,
    notes: t.notes,
  }))
}

const headersCs = EXPORT_COLUMNS.map((c) => cs.export.columns[c])
const headersEn = EXPORT_COLUMNS.map((c) => en.export.columns[c])
const kindCs = (k: 'task' | 'phase' | 'milestone') => cs.kind[k]

let counter = 0
const makeId = () => `i${++counter}`
const base = () => createEmptyProject({ name: 'Cíl', language: 'cs', startDate: '2026-11-16' })

function ok(result: ImportResult): Project {
  if (!result.ok) throw new Error(`Import selhal: ${JSON.stringify(result.errors.slice(0, 3))}`)
  expect(ProjectSchema.safeParse(result.project).success).toBe(true)
  return result.project
}

describe('export → import vrátí totéž (kritérium 12.7)', () => {
  it('přes CSV', () => {
    const project = sample()
    const csv = toCsv(headersCs, buildExportTable(project, schedule(project), kindCs).rows)
    const imported = ok(importTable(readCsv(csv), base(), makeId))
    expect(content(imported)).toEqual(content(project))
    expect(imported.name).toBe('Cíl') // název a kalendář projektu zůstávají
  })

  it('přes XLSX', async () => {
    const project = sample()
    const buffer = await toXlsx(headersCs, buildExportTable(project, schedule(project), kindCs), 'Plán')
    const imported = ok(importTable(await readXlsx(buffer), base(), makeId))
    expect(content(imported)).toEqual(content(project))
  })

  it('i s anglickými hlavičkami a typy', () => {
    const project = sample()
    const csv = toCsv(headersEn, buildExportTable(project, schedule(project), (k) => en.kind[k]).rows)
    expect(content(ok(importTable(readCsv(csv), base(), makeId)))).toEqual(content(project))
  })
})

describe('čtení vstupu', () => {
  it('stačí sloupec Název; ostatní mají výchozí hodnoty; prázdné řádky se přeskočí', () => {
    const imported = ok(importTable([['Název'], ['A'], [''], ['B']], base(), makeId))
    expect(content(imported).map((r) => [r.name, r.kind, r.duration, r.level])).toEqual([
      ['A', 'task', 1, 0],
      ['B', 'task', 1, 0],
    ])
  })

  it('apostrof z ochrany proti vzorcům se odstraní, jiný apostrof zůstane', () => {
    const imported = ok(importTable([['Název', 'Poznámka'], ["'=SUM(A1)", "'jen text"]], base(), makeId))
    expect([imported.tasks[0]!.name, imported.tasks[0]!.notes]).toEqual(['=SUM(A1)', "'jen text"])
  })

  it('datum z Excelu (d.m.rrrr), číslo jako předchůdce, procenta se znakem %', () => {
    const rows = [
      ['Č.', 'Název', 'Předchůdci', 'Začít nejdříve', '% hotovo'],
      [1, 'A', '', '18.11.2026', '50 %'],
      [2, 'B', 1, '', 0],
    ]
    const imported = ok(importTable(rows, base(), makeId))
    expect(imported.tasks[0]).toMatchObject({ constraintStart: '2026-11-18', percentComplete: 50 })
    expect(imported.tasks[1]!.dependencies[0]).toMatchObject({ predecessorId: imported.tasks[0]!.id, type: 'FS' })
  })

  it('CSV s čárkou jako oddělovačem se také přečte', () => {
    expect(readCsv('Name,Duration (days)\r\nA,3\r\n')).toEqual([
      ['Name', 'Duration (days)'],
      ['A', '3'],
    ])
  })
})

describe('chyby: nic se nepoužije, seznam s čísly řádků', () => {
  /** Kódy chyb s čísly řádků („3:badKind“). */
  const errors = (rows: unknown[][]) => {
    const result = importTable(rows, base(), makeId)
    return result.ok ? [] : result.errors.map((e) => `${e.row}:${e.code}`)
  }

  it('chybí sloupec Název / prázdný soubor', () => {
    expect(errors([['WBS', 'Typ'], ['1', 'Fáze']])).toEqual(['1:missingName'])
    expect(errors([])).toEqual(['1:empty'])
    expect(errors([['Název']])).toEqual(['1:empty'])
  })

  it('chybné hodnoty v řádcích (číslo řádku = řádek v souboru)', () => {
    const rows = [
      ['Název', 'Typ', 'Délka (dny)', '% hotovo', 'Začít nejdříve'],
      ['', 'Činnost', 1, 0, ''],
      ['B', 'Nesmysl', 1, 0, ''],
      ['C', 'Činnost', 'deset', 0, ''],
      ['D', 'Činnost', 1, 150, ''],
      ['E', 'Činnost', 1, 0, '31.2.2026'],
    ]
    expect(errors(rows)).toEqual(['2:emptyName', '3:badKind', '4:badDuration', '5:badPercent', '6:badDate'])
  })

  it('hierarchie: skok o víc než jednu úroveň a činnost jako nadřazená', () => {
    expect(errors([['Název', 'Úroveň', 'Typ'], ['F', 1, 'Fáze'], ['A', 3, 'Činnost']])).toEqual(['3:badLevel'])
    expect(errors([['Název', 'Úroveň', 'Typ'], ['A', 1, 'Činnost'], ['B', 2, 'Činnost']])).toEqual(['3:parentNotPhase'])
  })

  it('předchůdci: neexistující řádek, chybný zápis, vazba na fázi, kruh', () => {
    const header = ['Č.', 'Název', 'Typ', 'Předchůdci']
    expect(errors([header, [1, 'A', 'Činnost', '9']])).toEqual(['2:unknownPredecessor'])
    expect(errors([header, [1, 'A', 'Činnost', 'xyz']])).toEqual(['2:badPredecessors'])
    expect(errors([header, [1, 'F', 'Fáze', ''], [2, 'A', 'Činnost', '1']])).toEqual(['3:phaseDependency'])
    expect(errors([header, [1, 'A', 'Činnost', '2'], [2, 'B', 'Činnost', '1SS']])).toEqual(['2:cycle', '3:cycle'])
  })

  it('stejné číslo řádku dvakrát', () => {
    expect(errors([['Č.', 'Název'], [1, 'A'], [1, 'B']])).toEqual(['3:duplicateNumber'])
  })

  it('příliš mnoho řádků', () => {
    const rows = [['Název'], ...Array.from({ length: 5001 }, (_, i) => [`T${i}`])]
    expect(errors(rows)).toEqual(['1:tooManyRows'])
  })
})
