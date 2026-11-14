import { describe, expect, it } from 'vitest'
import { createProjectStore, HISTORY_LIMIT } from './projectStore'
import { createEmptyProject, createTask, ProjectSchema } from '../model/schema'

function newStore() {
  return createProjectStore(createEmptyProject({ name: 'Test', language: 'cs', startDate: '2026-11-16' }))
}

describe('úpravy činností', () => {
  it('přidá činnost s výchozími hodnotami', () => {
    const store = newStore()
    const id = store.getState().addTask('Analýza')
    const task = store.getState().project.tasks[0]!
    expect(task).toMatchObject({ id, name: 'Analýza', kind: 'task', durationDays: 1, order: 0 })
  })

  it('upraví činnost a hlídá pravidla (milník = 0 dní, % do 100)', () => {
    const store = newStore()
    const id = store.getState().addTask('A')
    store.getState().updateTask(id, { durationDays: 7, percentComplete: 150 })
    expect(store.getState().project.tasks[0]).toMatchObject({ durationDays: 7, percentComplete: 100 })
    store.getState().updateTask(id, { kind: 'milestone' })
    expect(store.getState().project.tasks[0]!.durationDays).toBe(0)
    store.getState().updateTask(id, { durationDays: 4 })
    expect(store.getState().project.tasks[0]!.durationDays).toBe(0)
    store.getState().updateTask(id, { kind: 'task' })
    expect(store.getState().project.tasks[0]!.durationDays).toBe(1)
  })

  it('smaže činnost, přečísluje pořadí a odstraní vazby na ni', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    const b = store.getState().addTask('B')
    const c = store.getState().addTask('C')
    const project = store.getState().project
    store.getState().loadProject({
      ...project,
      tasks: project.tasks.map((t) =>
        t.id === c ? { ...t, dependencies: [{ predecessorId: b, type: 'FS' as const, lagDays: 0 }] } : t,
      ),
    })
    store.getState().deleteTask(b)
    const tasks = store.getState().project.tasks
    expect(tasks.map((t) => [t.id, t.order])).toEqual([
      [a, 0],
      [c, 1],
    ])
    expect(tasks[1]!.dependencies).toEqual([])
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })

  it('se smazanou fází smaže i její podřízené položky', () => {
    const store = newStore()
    const project = store.getState().project
    store.getState().loadProject({
      ...project,
      tasks: [
        createTask({ id: 'f', name: 'Fáze', order: 0, kind: 'phase' }),
        { ...createTask({ id: 'x', name: 'X', order: 0 }), parentId: 'f' },
        { ...createTask({ id: 'y', name: 'Y', order: 0 }), parentId: 'x' },
        createTask({ id: 'z', name: 'Z', order: 1 }),
      ],
    })
    store.getState().deleteTask('f')
    expect(store.getState().project.tasks.map((t) => t.id)).toEqual(['z'])
  })
})

describe('vazby, kalendář a začátek projektu', () => {
  it('nastaví vazby a jdou vrátit', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    const b = store.getState().addTask('B')
    store.getState().setDependencies(b, [{ predecessorId: a, type: 'FS', lagDays: 2 }])
    expect(store.getState().project.tasks[1]!.dependencies).toEqual([{ predecessorId: a, type: 'FS', lagDays: 2 }])
    store.getState().undo()
    expect(store.getState().project.tasks[1]!.dependencies).toEqual([])
  })

  it('změna na fázi odebere vazby činnosti i vazby na ni', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    const b = store.getState().addTask('B')
    const c = store.getState().addTask('C')
    store.getState().setDependencies(b, [{ predecessorId: a, type: 'FS', lagDays: 0 }])
    store.getState().setDependencies(c, [{ predecessorId: b, type: 'FS', lagDays: 0 }])
    store.getState().updateTask(b, { kind: 'phase' })
    const tasks = store.getState().project.tasks
    expect(tasks[1]!.dependencies).toEqual([])
    expect(tasks[2]!.dependencies).toEqual([])
    store.getState().undo() // jeden krok vrátí změnu typu i vazby
    expect(store.getState().project.tasks[2]!.dependencies).toHaveLength(1)
  })

  it('změní kalendář a začátek projektu, prázdná změna se nezapíše', () => {
    const store = newStore()
    store.getState().updateCalendar({ useCzechHolidays: false })
    store.getState().updateCalendar({ useCzechHolidays: false })
    store.getState().setProjectStart('2027-01-04')
    store.getState().setProjectStart('2027-01-04')
    expect(store.getState().project.calendar.useCzechHolidays).toBe(false)
    expect(store.getState().project.startDate).toBe('2027-01-04')
    expect(store.getState().past).toHaveLength(2)
    store.getState().undo()
    store.getState().undo()
    expect(store.getState().project.calendar.useCzechHolidays).toBe(true)
  })
})

describe('historie změn (Zpět / Znovu)', () => {
  it('přidání → Zpět → Znovu', () => {
    const store = newStore()
    store.getState().addTask('A')
    expect(store.getState().project.tasks).toHaveLength(1)
    store.getState().undo()
    expect(store.getState().project.tasks).toHaveLength(0)
    store.getState().redo()
    expect(store.getState().project.tasks).toHaveLength(1)
    expect(store.getState().project.tasks[0]!.name).toBe('A')
  })

  it('vrátí úpravu i smazání', () => {
    const store = newStore()
    const id = store.getState().addTask('A')
    store.getState().updateTask(id, { name: 'B' })
    store.getState().deleteTask(id)
    store.getState().undo()
    expect(store.getState().project.tasks[0]!.name).toBe('B')
    store.getState().undo()
    expect(store.getState().project.tasks[0]!.name).toBe('A')
  })

  it('nová změna po Zpět zahodí možnost Znovu', () => {
    const store = newStore()
    store.getState().addTask('A')
    store.getState().undo()
    store.getState().addTask('B')
    expect(store.getState().future).toHaveLength(0)
    store.getState().redo()
    expect(store.getState().project.tasks.map((t) => t.name)).toEqual(['B'])
  })

  it('změna, která nic nemění, se do historie nezapíše', () => {
    const store = newStore()
    const id = store.getState().addTask('A')
    store.getState().updateTask(id, { name: 'A' })
    store.getState().deleteTask('neexistuje')
    expect(store.getState().past).toHaveLength(1)
  })

  it('Zpět a Znovu bez historie nic neudělají', () => {
    const store = newStore()
    const before = store.getState().project
    store.getState().undo()
    store.getState().redo()
    expect(store.getState().project).toBe(before)
  })

  it(`pamatuje si nejvýš ${HISTORY_LIMIT} kroků`, () => {
    const store = newStore()
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) store.getState().addTask(`Č${i}`)
    expect(store.getState().past).toHaveLength(HISTORY_LIMIT)
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) store.getState().undo()
    expect(store.getState().project.tasks).toHaveLength(20)
  })
})
