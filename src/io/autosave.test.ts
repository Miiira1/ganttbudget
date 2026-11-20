import { describe, expect, it } from 'vitest'
import { createSampleProject } from '../samples/automatizace'
import { translateCs } from '../samples/translateForTests'
import { createEmptyProject } from '../model/schema'
import { fromBackup, shouldRestore, toBackup } from './autosave'
import { serializeProject } from './projectFile'

const sample = () => createSampleProject(translateCs, 'cs', '2026-11-16')
const now = new Date('2026-11-14T21:30:00Z')

describe('automatická záloha v prohlížeči', () => {
  it('záloha → obnova vrátí stejný projekt, název souboru a stav uložení', () => {
    const project = sample()
    const backup = toBackup(project, { fileName: 'plan.ganttbudget.json', saved: true }, now)
    expect(backup.savedAt).toBe('2026-11-14T21:30:00.000Z')
    expect(fromBackup(backup)).toEqual({
      ok: true,
      project,
      fileName: 'plan.ganttbudget.json',
      saved: true,
      savedAt: '2026-11-14T21:30:00.000Z',
    })
  })

  it('záloha se ukládá úsporně (bez odsazení) – asi poloviční velikost (audit R1, R8)', () => {
    const project = sample()
    const backup = toBackup(project, { fileName: null, saved: false }, now)
    expect(backup.text).toBe(serializeProject(project, { compact: true }))
    expect(backup.text).not.toContain('\n  ')
  })

  it('starší záloha s odsazením se dál obnoví', () => {
    const project = sample()
    const old = { savedAt: now.toISOString(), text: serializeProject(project), fileName: 'plan.ganttbudget.json', saved: true }
    expect(fromBackup(old)).toMatchObject({ ok: true, project, fileName: 'plan.ganttbudget.json' })
  })

  it('poškozená záloha se nepoužije (ověří se stejně jako soubor)', () => {
    const backup = toBackup(sample(), { fileName: null, saved: false }, now)
    expect(fromBackup({ ...backup, text: '{"schemaVersion": 1, "nam' }).ok).toBe(false)
    expect(fromBackup({ ...backup, text: '{"ahoj": 1}' }).ok).toBe(false)
  })

  it('nesmyslný záznam místo zálohy se nepoužije', () => {
    expect(fromBackup(null).ok).toBe(false)
    expect(fromBackup('text').ok).toBe(false)
    expect(fromBackup({ text: 42 }).ok).toBe(false)
  })

  it('obnovit jen do nedotčeného prázdného projektu (nic nepřepsat)', () => {
    const empty = createEmptyProject({ name: 'Nový projekt', language: 'cs' })
    expect(shouldRestore(empty, empty)).toBe(true)
    const edited = { ...empty, name: 'Upravený' }
    expect(shouldRestore(edited, empty)).toBe(false) // uživatel už mezitím něco změnil
  })
})
