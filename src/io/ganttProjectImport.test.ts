import { describe, expect, it } from 'vitest'
import { schedule } from '../engine/schedule'
import { treeOrder } from '../model/hierarchy'
import { createEmptyProject, ProjectSchema, type Project } from '../model/schema'
import { importGanttProject } from './ganttProjectImport'

let seq = 0
const makeId = () => `g${++seq}`
const base = () => createEmptyProject({ name: 'Původní', language: 'cs', startDate: '2026-01-05' })

/**
 * Ukázkový soubor GanttProject: fáze (úkol s podřízenými), činnosti, milník (meeting),
 * vazby `<depend id="následník" type="…" difference="…">` uvnitř předchůdce.
 * Typy: 1 = SS, 2 = FS, 3 = FF, 4 = SF.
 */
const GAN = `<?xml version="1.0" encoding="UTF-8"?>
<project name="Nová hala" company="" version="3.2.3240" locale="cs_CZ">
  <description/>
  <tasks empty-milestones="true">
    <taskproperties><taskproperty id="tpd0" name="type" type="default" valuetype="icon"/></taskproperties>
    <task id="0" name="Příprava" color="#8cb6ce" meeting="false" start="2026-11-23" duration="10" complete="20" expand="true">
      <task id="1" name="Analýza &amp; studie" meeting="false" start="2026-11-23" duration="5" complete="50" expand="true">
        <notes><![CDATA[Pozor na termín]]></notes>
        <depend id="2" type="2" difference="1" hardness="Strong"/>
      </task>
      <task id="2" name="Projekt" meeting="false" start="2026-12-01" duration="2" complete="0" expand="true">
        <depend id="3" type="1" difference="0" hardness="Strong"/>
        <depend id="5" type="3" difference="-2" hardness="Strong"/>
      </task>
    </task>
    <task id="3" name="Schválení" meeting="true" start="2026-12-01" duration="0" complete="0" expand="true"/>
    <task id="4" name="Realizace" meeting="false" start="2026-12-07" duration="8" complete="0" expand="true">
      <depend id="6" type="2" difference="0" hardness="Strong"/>
      <task id="5" name="Montáž" meeting="false" start="2026-12-07" duration="3" complete="0" expand="true"/>
      <task id="6" name="Pozdější start" meeting="false" start="2027-01-04" duration="1" complete="0" expand="true"/>
    </task>
  </tasks>
  <resources/>
  <allocations/>
</project>`

function ok(result: ReturnType<typeof importGanttProject>): Project & { warnings: { code: string; count: number }[] } {
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return { ...result.project, warnings: result.warnings ?? [] }
}

describe('import z GanttProject (.gan)', () => {
  it('strom (úkol s podřízenými = fáze), milník, délky, % hotovo, poznámky; začátek = nejdřívější úkol', () => {
    const p = ok(importGanttProject(GAN, base(), makeId))
    expect(ProjectSchema.safeParse({ ...p, warnings: undefined }).success).toBe(true)
    expect(p.startDate).toBe('2026-11-23')
    expect(treeOrder(p).map((t) => `${t.kind}:${t.name}`)).toEqual([
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
    expect(byName.get('Montáž')!.parentId).toBe(byName.get('Realizace')!.id)
  })

  it('vazby: depend v předchůdci míří na následníka; typy 1 SS, 2 FS, 3 FF; vazby s fází se vynechají', () => {
    const p = ok(importGanttProject(GAN, base(), makeId))
    const byName = new Map(p.tasks.map((t) => [t.name, t]))
    expect(byName.get('Projekt')!.dependencies).toEqual([{ predecessorId: byName.get('Analýza & studie')!.id, type: 'FS', lagDays: 1 }])
    expect(byName.get('Schválení')!.dependencies).toEqual([{ predecessorId: byName.get('Projekt')!.id, type: 'SS', lagDays: 0 }])
    expect(byName.get('Montáž')!.dependencies).toEqual([{ predecessorId: byName.get('Projekt')!.id, type: 'FF', lagDays: -2 }])
    expect(byName.get('Pozdější start')!.dependencies).toEqual([]) // vazba od fáze Realizace se vynechá
    expect(p.warnings).toContainEqual({ code: 'summaryLink', count: 1 })
  })

  it('položka bez předchůdce s pozdějším začátkem dostane 📌 „začít nejdříve“; plán jde spočítat', () => {
    const p = ok(importGanttProject(GAN, base(), makeId))
    expect(p.tasks.find((t) => t.name === 'Pozdější start')!.constraintStart).toBe('2027-01-04')
    expect(p.tasks.find((t) => t.name === 'Analýza & studie')!.constraintStart).toBeUndefined()
    expect(schedule(p).cycleTaskIds.size).toBe(0)
  })

  it('chyby: není XML, není GanttProject, žádné úkoly', () => {
    const codes = (xml: string) => {
      const r = importGanttProject(xml, base(), makeId)
      return r.ok ? [] : r.errors.map((e) => e.code)
    }
    expect(codes('<<<')).toEqual(['gan.invalidXml'])
    expect(codes('<Project><Tasks/></Project>')).toEqual(['gan.notGanttProject'])
    expect(codes('<project><tasks/></project>')).toEqual(['gan.noTasks'])
  })
})
