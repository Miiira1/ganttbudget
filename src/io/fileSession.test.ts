import { describe, expect, it } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { createProjectStore } from '../store/projectStore'
import { createEmptyProject, type Project } from '../model/schema'
import { trackFileSessions } from './fileSession'

/** Zjednodušený stav souboru – stačí název a „odkaz“ na soubor. */
interface TestFile {
  fileName: string | null
  handle: string | null
}

function setup() {
  const store = createProjectStore(createEmptyProject({ name: 'Start', language: 'cs' }))
  const files = createStore<TestFile>(() => ({ fileName: null, handle: null }))
  const sessions = trackFileSessions(store, files)
  /** Stejně jako „Otevřít“ / „Nový“ / „Vzorový projekt“ v aplikaci. */
  function open(name: string, file: TestFile): Project {
    const project = createEmptyProject({ name, language: 'cs' })
    sessions.switchProject(() => store.getState().loadProject(project), file)
    return project
  }
  return { store, files, open }
}

const A: TestFile = { fileName: 'a.json', handle: 'A' }
const B: TestFile = { fileName: 'b.json', handle: 'B' }

describe('napojení na soubor při Zpět / Znovu', () => {
  it('Zpět po Otevřít vrátí i předchozí soubor, Znovu zase nový', () => {
    const { store, files, open } = setup()
    const a = open('A', A)
    const b = open('B', B)
    expect(files.getState()).toEqual(B)

    store.getState().undo()
    expect(store.getState().project).toBe(a)
    expect(files.getState()).toEqual(A) // Ctrl+S teď zapíše do A, ne do B

    store.getState().redo()
    expect(store.getState().project).toBe(b)
    expect(files.getState()).toEqual(B)
  })

  it('Zpět až před první otevření vrátí stav „bez souboru“', () => {
    const { store, files, open } = setup()
    open('A', A)
    open('B', B)
    store.getState().undo()
    store.getState().undo()
    expect(files.getState()).toEqual({ fileName: null, handle: null })
    store.getState().redo()
    store.getState().redo()
    expect(files.getState()).toEqual(B)
  })

  it('běžné úpravy a jejich Zpět soubor nemění', () => {
    const { store, files, open } = setup()
    open('B', B)
    store.getState().addTask('Činnost')
    store.getState().addTask('Další')
    store.getState().undo()
    store.getState().undo() // zpět na právě otevřený projekt – pořád soubor B
    expect(files.getState()).toEqual(B)
    store.getState().redo()
    expect(files.getState()).toEqual(B)
  })

  it('úpravy po otevření: Zpět přes všechny kroky vrátí soubor až na hranici', () => {
    const { store, files, open } = setup()
    open('A', A)
    open('B', B)
    store.getState().addTask('Činnost')
    store.getState().undo() // zpět na otevřené B
    expect(files.getState()).toEqual(B)
    store.getState().undo() // přes hranici na A
    expect(files.getState()).toEqual(A)
  })

  it('„Uložit jako“ po otevření: Znovu vrátí naposledy použitý soubor', () => {
    const { store, files, open } = setup()
    open('A', A)
    open('B', B)
    const C: TestFile = { fileName: 'c.json', handle: 'C' }
    files.setState(C) // uživatel uložil B jako c.json
    store.getState().undo()
    expect(files.getState()).toEqual(A)
    store.getState().redo()
    expect(files.getState()).toEqual(C)
  })

  it('otevření téhož projektu dvakrát po sobě nic nerozbije', () => {
    const { store, files, open } = setup()
    open('A', A)
    const b = open('B', B)
    open('C', { fileName: 'c.json', handle: 'C' })
    store.getState().undo()
    expect(store.getState().project).toBe(b)
    expect(files.getState()).toEqual(B)
    store.getState().undo()
    expect(files.getState()).toEqual(A)
    store.getState().redo()
    expect(files.getState()).toEqual(B)
  })

  it('po Zpět a nové úpravě Znovu nejde a soubor zůstane', () => {
    const { store, files, open } = setup()
    open('A', A)
    open('B', B)
    store.getState().undo()
    store.getState().addTask('Úprava v A')
    expect(files.getState()).toEqual(A)
    expect(store.getState().future).toHaveLength(0)
  })

  it('když se projekt nezmění (stejný objekt), hranice nevznikne', () => {
    const { store, files } = setup()
    const sessions = trackFileSessions(store, files)
    const same = store.getState().project
    sessions.switchProject(() => store.getState().loadProject(same), A)
    expect(files.getState()).toEqual(A)
    expect(store.getState().past).toHaveLength(0)
  })
})
