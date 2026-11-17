import { describe, expect, it } from 'vitest'
import { schedule } from '../engine/schedule'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import { lineDisplayName, mobilePlanRows } from './mobilePlan'

const sample = () => createSampleProject(translateCs, 'cs', '2026-11-23')

describe('mobilní verze – seznam karet plánu', () => {
  it('řádky v pořadí plánu s úrovní, WBS a číslem řádku; fáze ví, že má podřízené', () => {
    const p = sample()
    const rows = mobilePlanRows(p, schedule(p), new Set())
    expect(rows).toHaveLength(p.tasks.length)
    const [phase, first] = rows
    expect(phase).toMatchObject({ depth: 0, wbs: '1', number: 1, hasChildren: true })
    expect(phase!.task.kind).toBe('phase')
    expect(first).toMatchObject({ depth: 1, wbs: '1.1', number: 2, hasChildren: false })
    expect(first!.start).toBeTruthy()
    expect(first!.finish).toBeTruthy()
  })

  it('délka fáze je spočítaná, u činnosti zadaná; sbalená fáze skryje podřízené', () => {
    const p = sample()
    const scheduled = schedule(p)
    const rows = mobilePlanRows(p, scheduled, new Set())
    const phase = rows[0]!
    expect(phase.durationDays).toBe(scheduled.tasks.get(phase.task.id)!.durationDays)
    expect(rows[1]!.durationDays).toBe(rows[1]!.task.durationDays)
    const collapsed = mobilePlanRows(p, scheduled, new Set([phase.task.id]))
    expect(collapsed.length).toBeLessThan(rows.length)
    expect(collapsed[1]!.depth).toBe(0) // hned další fáze
  })

  it('název zdroje řádku: pracovník (jinak profese), stroj, materiál, vlastní název nákladu', () => {
    const p = sample()
    const lines = p.tasks.flatMap((t) => t.lines)
    const labor = lines.find((l) => l.kind === 'labor')!
    const name = lineDisplayName(p, labor)
    const expected = labor.kind === 'labor' && labor.workerId ? p.workers.find((w) => w.id === labor.workerId)!.name : p.professions.find((x) => labor.kind === 'labor' && x.id === labor.professionId)!.name
    expect(name).toBe(expected)
    const material = lines.find((l) => l.kind === 'material')
    if (material?.kind === 'material') expect(lineDisplayName(p, material)).toBe(p.materials.find((m) => m.id === material.materialId)!.name)
    expect(lineDisplayName(p, { id: 'x', categoryId: 'c', kind: 'oneTime', name: 'Doprava', amount: 100, timing: 'start' })).toBe('Doprava')
    expect(lineDisplayName(p, { id: 'y', categoryId: 'c', kind: 'machine', machineId: 'neni', sharePct: 100 })).toBe('')
  })
})
