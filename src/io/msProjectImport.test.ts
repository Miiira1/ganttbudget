import { describe, expect, it } from 'vitest'
import { schedule } from '../engine/schedule'
import { treeOrder } from '../model/hierarchy'
import { createEmptyProject, ProjectSchema, type Project } from '../model/schema'
import { importMsProject } from './msProjectImport'

let seq = 0
const makeId = () => `m${++seq}`
const base = () => createEmptyProject({ name: 'Původní', language: 'cs', startDate: '2026-01-05' })

/** Úkol MS Project v XML. */
function task(f: { uid: number; name: string; level: number; summary?: boolean; milestone?: boolean; duration?: string; percent?: number; notes?: string; links?: string; constraint?: [number, string] }) {
  return `<Task><UID>${f.uid}</UID><ID>${f.uid}</ID><Name>${f.name}</Name><OutlineLevel>${f.level}</OutlineLevel>
<Summary>${f.summary ? 1 : 0}</Summary><Milestone>${f.milestone ? 1 : 0}</Milestone><Duration>${f.duration ?? 'PT8H0M0S'}</Duration>
<PercentComplete>${f.percent ?? 0}</PercentComplete>${f.notes ? `<Notes>${f.notes}</Notes>` : ''}
${f.constraint ? `<ConstraintType>${f.constraint[0]}</ConstraintType><ConstraintDate>${f.constraint[1]}</ConstraintDate>` : '<ConstraintType>0</ConstraintType>'}${f.links ?? ''}</Task>`
}
const link = (uid: number, type = 1, lag = 0) => `<PredecessorLink><PredecessorUID>${uid}</PredecessorUID><Type>${type}</Type><LinkLag>${lag}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`

const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Hala.xml</Name><Title>Nová hala</Title><StartDate>2026-11-23T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay>
  <Tasks>
    ${task({ uid: 0, name: 'Nová hala', level: 0, summary: true })}
    ${task({ uid: 1, name: 'Příprava', level: 1, summary: true })}
    ${task({ uid: 2, name: 'Analýza &amp; studie', level: 2, duration: 'PT40H0M0S', percent: 50, notes: 'Pozor na termín' })}
    ${task({ uid: 3, name: 'Projekt', level: 2, duration: 'PT16H0M0S', links: link(2, 1, 4800) })}
    ${task({ uid: 4, name: 'Schválení', level: 1, milestone: true, duration: 'PT0H0M0S', links: link(3, 3, -4800) })}
    ${task({ uid: 5, name: 'Realizace', level: 1, summary: true })}
    ${task({ uid: 6, name: 'Montáž', level: 2, duration: 'PT24H0M0S', links: link(1) + link(4, 0) })}
    ${task({ uid: 7, name: 'Pozdější start', level: 2, duration: 'PT8H0M0S', constraint: [4, '2027-01-04T08:00:00'] })}
    <Task><UID>8</UID><ID>8</ID><OutlineLevel>1</OutlineLevel></Task>
  </Tasks>
</Project>`

function ok(result: ReturnType<typeof importMsProject>): Project & { warnings: { code: string; count: number }[] } {
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return { ...result.project, warnings: result.warnings ?? [] }
}

describe('import z MS Project (XML)', () => {
  it('strom, druhy, délky v pracovních dnech, % hotovo, poznámky a začátek projektu', () => {
    const p = ok(importMsProject(XML, base(), makeId))
    expect(ProjectSchema.safeParse({ ...p, warnings: undefined }).success).toBe(true)
    expect(p.startDate).toBe('2026-11-23')
    expect(p.name).toBe('Původní') // název projektu se nemění (jako u importu tabulky)
    const rows = treeOrder(p)
    expect(rows.map((t) => `${t.kind}:${t.name}`)).toEqual([
      'phase:Příprava',
      'task:Analýza & studie',
      'task:Projekt',
      'milestone:Schválení',
      'phase:Realizace',
      'task:Montáž',
      'task:Pozdější start',
    ])
    const byName = new Map(p.tasks.map((t) => [t.name, t]))
    expect(byName.get('Analýza & studie')).toMatchObject({ durationDays: 5, percentComplete: 50, notes: 'Pozor na termín' })
    expect(byName.get('Projekt')!.durationDays).toBe(2)
    expect(byName.get('Analýza & studie')!.parentId).toBe(byName.get('Příprava')!.id)
  })

  it('vazby: typy FF/FS/SF/SS a prodleva z desetin minut; vazby na souhrnné úkoly se vynechají s upozorněním', () => {
    const p = ok(importMsProject(XML, base(), makeId))
    const byName = new Map(p.tasks.map((t) => [t.name, t]))
    expect(byName.get('Projekt')!.dependencies).toEqual([{ predecessorId: byName.get('Analýza & studie')!.id, type: 'FS', lagDays: 1 }])
    expect(byName.get('Schválení')!.dependencies).toEqual([{ predecessorId: byName.get('Projekt')!.id, type: 'SS', lagDays: -1 }])
    // Montáž: vazba na fázi Příprava se vynechá, vazba FF na milník zůstane.
    expect(byName.get('Montáž')!.dependencies).toEqual([{ predecessorId: byName.get('Schválení')!.id, type: 'FF', lagDays: 0 }])
    expect(p.warnings).toContainEqual({ code: 'summaryLink', count: 1 })
  })

  it('omezení „začít nejdříve“ se převezme; plán jde spočítat', () => {
    const p = ok(importMsProject(XML, base(), makeId))
    expect(p.tasks.find((t) => t.name === 'Pozdější start')!.constraintStart).toBe('2027-01-04')
    expect(schedule(p).cycleTaskIds.size).toBe(0)
  })

  it('chyby: není XML, není MS Project, žádné úkoly, příliš hluboko', () => {
    const codes = (xml: string) => {
      const r = importMsProject(xml, base(), makeId)
      return r.ok ? [] : r.errors.map((e) => e.code)
    }
    expect(codes('tohle není xml <a>')).toEqual(['msp.invalidXml'])
    expect(codes('<project><tasks/></project>')).toEqual(['msp.notMsProject'])
    expect(codes('<Project xmlns="http://schemas.microsoft.com/project"><Tasks/></Project>')).toEqual(['msp.noTasks'])
    const deep = Array.from({ length: 8 }, (_, i) => task({ uid: i + 1, name: `L${i + 1}`, level: i + 1, summary: i < 7 })).join('')
    expect(codes(`<Project xmlns="http://schemas.microsoft.com/project"><Tasks>${deep}</Tasks></Project>`)).toEqual(['msp.tooDeep'])
  })
})
