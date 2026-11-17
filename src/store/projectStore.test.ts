import { describe, expect, it } from 'vitest'
import { createProjectStore, HISTORY_LIMIT } from './projectStore'
import { createEmptyProject, createTask, ProjectSchema } from '../model/schema'
import { depthMap, treeOrder } from '../model/hierarchy'

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

describe('strom: odsazení, přesuny, vkládání (fáze 4a)', () => {
  /** Jména v pořadí řádků s odsazením podle úrovně, např. ['A', '  B']. */
  function outline(store: ReturnType<typeof newStore>): string[] {
    const project = store.getState().project
    const depths = depthMap(project)
    return treeOrder(project).map((t) => '  '.repeat(depths.get(t.id) ?? 0) + t.name)
  }

  it('odsadit, předsadit, nahoru, dolů – každá změna je jeden krok Zpět', () => {
    const store = newStore()
    store.getState().addTask('A')
    const b = store.getState().addTask('B')
    const c = store.getState().addTask('C')

    expect(store.getState().indentTask(b)).toBeNull()
    expect(outline(store)).toEqual(['A', '  B', 'C'])
    expect(store.getState().project.tasks.find((t) => t.name === 'A')?.kind).toBe('phase')
    expect(store.getState().indentTask(c)).toBeNull() // předchozí sourozenec C je fáze A → C za B
    expect(outline(store)).toEqual(['A', '  B', '  C'])
    expect(store.getState().moveTaskUp(c)).toBeNull()
    expect(outline(store)).toEqual(['A', '  C', '  B'])
    expect(store.getState().moveTaskDown(c)).toBeNull()
    expect(store.getState().outdentTask(b)).toBeNull()
    expect(outline(store)).toEqual(['A', '  C', 'B'])
    expect(store.getState().past).toHaveLength(3 + 5)

    store.getState().undo() // vrátí předsazení
    expect(outline(store)).toEqual(['A', '  B', '  C'])
    store.getState().redo()
    expect(outline(store)).toEqual(['A', '  C', 'B'])
  })

  it('neplatná operace nic nezapíše a vrátí důvod pro hlášku', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    expect(store.getState().indentTask(a)).toBe('noPreviousSibling')
    expect(store.getState().outdentTask(a)).toBe('topLevel')
    expect(store.getState().moveTaskUp(a)).toBe('noPreviousSibling')
    expect(store.getState().moveTask(a, 'neexistuje', 'after')).toBe('notFound')
    expect(store.getState().past).toHaveLength(1)
  })

  it('přesun tažením dovnitř fáze a před jiný řádek', () => {
    const store = newStore()
    const f = store.getState().addTask('F', 'phase')
    const a = store.getState().addTask('A')
    const b = store.getState().addTask('B')
    expect(store.getState().moveTask(b, f, 'inside')).toBeNull()
    expect(store.getState().moveTask(a, b, 'before')).toBeNull()
    expect(outline(store)).toEqual(['F', '  A', '  B'])
    store.getState().undo()
    expect(outline(store)).toEqual(['F', '  B', 'A'])
  })

  it('fázi s podřízenými nejde změnit na činnost ani milník', () => {
    const store = newStore()
    const f = store.getState().addTask('F', 'phase')
    const a = store.getState().addTask('A')
    store.getState().moveTask(a, f, 'inside')
    const pastBefore = store.getState().past.length
    store.getState().updateTask(f, { kind: 'task' })
    expect(store.getState().project.tasks.find((t) => t.id === f)?.kind).toBe('phase')
    expect(store.getState().past).toHaveLength(pastBefore)
  })

  it('nová činnost se vloží pod vybraný řádek na stejnou úroveň', () => {
    const store = newStore()
    const f = store.getState().addTask('F', 'phase')
    const x = store.getState().addTask('X')
    store.getState().addTask('Z')
    store.getState().moveTask(x, f, 'inside')
    store.getState().addTask('N1', 'task', x) // pod X, uvnitř fáze
    store.getState().addTask('N2', 'task', f) // pod fázi F (za celou fázi), na nejvyšší úroveň
    expect(outline(store)).toEqual(['F', '  X', '  N1', 'N2', 'Z'])
    store.getState().addTask('N3', 'task', 'neexistuje') // neznámý výběr → na konec
    expect(outline(store).at(-1)).toBe('N3')
  })
})

describe('termíny z tažení a duplikování (fáze 4b)', () => {
  const find = (store: ReturnType<typeof newStore>, id: string) => store.getState().project.tasks.find((t) => t.id === id)!

  it('nastaví omezení i délku najednou – jeden krok Zpět', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    store.getState().setTaskTiming(a, { constraintStart: '2026-11-25', durationDays: 4 })
    expect(find(store, a)).toMatchObject({ constraintStart: '2026-11-25', durationDays: 4 })
    expect(store.getState().past).toHaveLength(2)
    store.getState().undo()
    expect(find(store, a).constraintStart).toBeUndefined()
    expect(find(store, a).durationDays).toBe(1)
  })

  it('null omezení zruší; beze změny se nic nezapíše', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    store.getState().setTaskTiming(a, { constraintStart: '2026-11-25' })
    store.getState().setTaskTiming(a, { constraintStart: '2026-11-25' })
    expect(store.getState().past).toHaveLength(2)
    store.getState().setTaskTiming(a, { constraintStart: null })
    expect('constraintStart' in find(store, a)).toBe(false)
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })

  it('milník si nechá délku 0, fáze se tažením nemění', () => {
    const store = newStore()
    const m = store.getState().addTask('M', 'milestone')
    const f = store.getState().addTask('F', 'phase')
    store.getState().setTaskTiming(m, { constraintStart: '2026-11-20', durationDays: 5 })
    expect(find(store, m)).toMatchObject({ constraintStart: '2026-11-20', durationDays: 0 })
    const pastBefore = store.getState().past.length
    store.getState().setTaskTiming(f, { constraintStart: '2026-11-20' })
    expect(store.getState().past).toHaveLength(pastBefore)
  })

  it('duplikuje řádek pod originál a vrátí ID kopie; jde to vrátit', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    store.getState().addTask('B')
    const copy = store.getState().duplicateTask(a, ' (kopie)')
    expect(treeOrder(store.getState().project).map((t) => t.name)).toEqual(['A', 'A (kopie)', 'B'])
    expect(copy).not.toBeNull()
    store.getState().undo()
    expect(store.getState().project.tasks).toHaveLength(2)
    expect(store.getState().duplicateTask('neexistuje', ' (kopie)')).toBeNull()
  })
})

describe('obnovení ze zálohy (fáze 5)', () => {
  it('nahradí projekt a smaže historii – Ctrl+Z nevrací na prázdný projekt', () => {
    const store = newStore()
    store.getState().addTask('A')
    const restored = createEmptyProject({ name: 'Ze zálohy', language: 'cs', startDate: '2026-11-16' })
    store.getState().resetProject(restored)
    expect(store.getState().project).toBe(restored)
    expect(store.getState().past).toHaveLength(0)
    expect(store.getState().future).toHaveLength(0)
    store.getState().undo()
    expect(store.getState().project).toBe(restored)
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

  it('Zpět/Znovu v plném rozsahu (G-05): všechny druhy změn tam i zpět', () => {
    const store = newStore()
    const initial = store.getState().project
    const s = () => store.getState()

    // Každý druh změny, který aplikace umí:
    const a = s().addTask('A')
    const b = s().addTask('B', 'task', a)
    const c = s().addTask('C')
    s().updateTask(b, { durationDays: 4, name: 'B2' })
    s().setDependencies(c, [{ predecessorId: b, type: 'FS', lagDays: 1 }])
    s().indentTask(b) // A se změní na fázi
    s().moveTask(c, a, 'inside')
    s().moveTaskUp(c)
    s().moveTaskDown(c)
    s().outdentTask(c)
    s().updateCalendar({ customHolidays: [{ start: '2026-12-21', end: '2026-12-31', name: 'Odstávka' }] })
    s().setProjectStart('2027-01-04')
    s().deleteTask(a)
    const final = s().project
    const steps = s().past.length
    expect(steps).toBe(13)

    for (let i = 0; i < steps; i++) s().undo()
    expect(s().project).toEqual(initial)
    expect(s().past).toHaveLength(0)

    for (let i = 0; i < steps; i++) s().redo()
    expect(s().project).toEqual(final)
    expect(s().future).toHaveLength(0)
  })

  it(`pamatuje si nejvýš ${HISTORY_LIMIT} kroků`, () => {
    const store = newStore()
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) store.getState().addTask(`Č${i}`)
    expect(store.getState().past).toHaveLength(HISTORY_LIMIT)
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) store.getState().undo()
    expect(store.getState().project.tasks).toHaveLength(20)
  })
})

describe('hromadné akce s více vybranými řádky', () => {
  function threeTasks() {
    const store = newStore()
    const ids = ['A', 'B', 'C', 'D'].map((name) => store.getState().addTask(name))
    return { store, ids, past: () => store.getState().past.length }
  }
  const names = (store: ReturnType<typeof newStore>) => treeOrder(store.getState().project).map((t) => t.name)

  it('každá hromadná akce = jeden krok Zpět', () => {
    const { store, ids, past } = threeTasks()
    const [a, b, c, d] = ids as [string, string, string, string]
    const start = past()
    expect(store.getState().moveTasksDown([a, b])).toBeNull()
    expect(names(store)).toEqual(['C', 'A', 'B', 'D'])
    expect(store.getState().moveTasksUp([a, b])).toBeNull()
    expect(store.getState().indentTasks([b, c])).toBeNull()
    expect(depthMap(store.getState().project).get(c)).toBe(1)
    expect(store.getState().outdentTasks([b, c])).toBeNull()
    expect(store.getState().moveTasks([a, b], d, 'after')).toBeNull()
    expect(names(store)).toEqual(['C', 'D', 'A', 'B'])
    expect(past() - start).toBe(5)
    store.getState().undo()
    expect(names(store)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('když nejde u jednoho, vrátí důvod a nic se nezmění', () => {
    const { store, ids, past } = threeTasks()
    const before = store.getState().project
    expect(store.getState().moveTasksUp([ids[0]!, ids[2]!])).toBe('noPreviousSibling')
    expect(store.getState().project).toBe(before)
    expect(past()).toBe(4)
  })

  it('duplikovat a smazat více řádků', () => {
    const { store, ids, past } = threeTasks()
    const copies = store.getState().duplicateTasks([ids[0]!, ids[1]!], ' (kopie)')
    expect(copies).toHaveLength(2)
    expect(names(store)).toEqual(['A', 'B', 'A (kopie)', 'B (kopie)', 'C', 'D'])
    store.getState().deleteTasks([...copies!, ids[3]!])
    expect(names(store)).toEqual(['A', 'B', 'C'])
    expect(past()).toBe(6)
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })
})

describe('termíny více činností najednou (posun skupiny úseček)', () => {
  it('jeden krok Zpět; fáze a beze změny se přeskočí', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    const b = store.getState().addTask('B')
    const f = store.getState().addTask('F', 'phase')
    const before = store.getState().past.length
    store.getState().setTasksTiming([
      { id: a, constraintStart: '2026-11-18' },
      { id: b, constraintStart: '2026-11-20', durationDays: 3 },
      { id: f, constraintStart: '2026-11-20' },
    ])
    const byId = new Map(store.getState().project.tasks.map((t) => [t.id, t]))
    expect(byId.get(a)!.constraintStart).toBe('2026-11-18')
    expect(byId.get(b)).toMatchObject({ constraintStart: '2026-11-20', durationDays: 3 })
    expect(byId.get(f)!.constraintStart).toBeUndefined()
    expect(store.getState().past.length - before).toBe(1)
    store.getState().setTasksTiming([{ id: a, constraintStart: '2026-11-18' }]) // nic nového
    expect(store.getState().past.length - before).toBe(1)
  })
})

describe('databáze zdrojů (fáze 6a)', () => {
  const material = { id: 'x1', name: 'Kabel', unit: 'm', unitPrice: 3_250, categoryId: 'cat-material' }

  it('přidat, upravit a smazat položku = vždy jeden krok Zpět', () => {
    const store = newStore()
    store.getState().addCatalogItem('materials', material)
    store.getState().updateCatalogItem('materials', 'x1', { unitPrice: 4_000, code: 'K-1' })
    expect(store.getState().project.materials[0]).toMatchObject({ unitPrice: 4_000, code: 'K-1' })
    store.getState().deleteCatalogItem('materials', 'x1')
    expect(store.getState().project.materials).toEqual([])
    expect(store.getState().past).toHaveLength(3)
    store.getState().undo()
    expect(store.getState().project.materials[0]!.unitPrice).toBe(4_000)
  })

  it('beze změny se nic nezapíše; undefined nepovinnou hodnotu odstraní', () => {
    const store = newStore()
    store.getState().addCatalogItem('materials', { ...material, code: 'K-1' })
    store.getState().updateCatalogItem('materials', 'x1', { unitPrice: 3_250 })
    store.getState().updateCatalogItem('materials', 'nic', { unitPrice: 1 })
    expect(store.getState().past).toHaveLength(1)
    store.getState().updateCatalogItem('materials', 'x1', { code: undefined })
    expect('code' in store.getState().project.materials[0]!).toBe(false)
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })

  it('smazat používanou kategorii s náhradou = jeden krok Zpět; položky přejdou do náhradní', () => {
    const store = newStore()
    store.getState().addCatalogItem('materials', material) // kategorie cat-material
    store.getState().addCatalogItem('machines', { id: 'm1', name: 'Jeřáb', categoryId: 'cat-material', rate: 100, rateUnit: 'hour', capacityPerDay: 8 })
    const before = store.getState().past.length
    store.getState().deleteCategory('cat-material', 'cat-services')
    const { project } = store.getState()
    expect(project.costCategories.some((c) => c.id === 'cat-material')).toBe(false)
    expect([project.materials[0]!.categoryId, project.machines[0]!.categoryId]).toEqual(['cat-services', 'cat-services'])
    expect(store.getState().past.length - before).toBe(1)
    expect(ProjectSchema.safeParse(project).success).toBe(true)
    store.getState().undo()
    expect(store.getState().project.materials[0]!.categoryId).toBe('cat-material')
  })

  it('náhradou nesmí být mazaná ani neexistující kategorie', () => {
    const store = newStore()
    store.getState().addCatalogItem('materials', material)
    store.getState().deleteCategory('cat-material', 'cat-material')
    store.getState().deleteCategory('cat-material', 'nic')
    expect(store.getState().project.costCategories.some((c) => c.id === 'cat-material')).toBe(true)
    store.getState().deleteCategory('cat-reserve', null) // nepoužívaná jde smazat bez náhrady
    expect(store.getState().project.costCategories.some((c) => c.id === 'cat-reserve')).toBe(false)
    store.getState().deleteCategory('cat-material', null) // používaná bez náhrady ne
    expect(store.getState().project.costCategories.some((c) => c.id === 'cat-material')).toBe(true)
  })

  it('kategorie: přidat, přejmenovat', () => {
    const store = newStore()
    store.getState().addCatalogItem('costCategories', { id: 'c7', name: 'Doprava' })
    store.getState().updateCatalogItem('costCategories', 'c7', { name: 'Logistika' })
    expect(store.getState().project.costCategories.at(-1)).toEqual({ id: 'c7', name: 'Logistika' })
  })
})

describe('řádky zdrojů a nákladů na činnosti (fáze 6b)', () => {
  const oneTime = { id: 'l1', kind: 'oneTime' as const, categoryId: 'cat-services', name: 'Záloha', amount: 100_000, timing: 'start' as const }

  it('přidat, upravit, smazat řádek = vždy jeden krok Zpět', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    const before = store.getState().past.length
    store.getState().addTaskLine(a, oneTime)
    store.getState().updateTaskLine(a, 'l1', { amount: 250_000, note: 'pozn.' })
    expect(store.getState().project.tasks[0]!.lines[0]).toMatchObject({ amount: 250_000, note: 'pozn.' })
    store.getState().updateTaskLine(a, 'l1', { note: undefined })
    expect('note' in store.getState().project.tasks[0]!.lines[0]!).toBe(false)
    store.getState().deleteTaskLine(a, 'l1')
    expect(store.getState().project.tasks[0]!.lines).toEqual([])
    expect(store.getState().past.length - before).toBe(4)
    store.getState().undo()
    expect(store.getState().project.tasks[0]!.lines).toHaveLength(1)
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })

  it('smazání kategorie s náhradou přesune i řádky činností', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    store.getState().addTaskLine(a, oneTime) // kategorie Služby
    store.getState().deleteCategory('cat-services', 'cat-reserve')
    expect(store.getState().project.tasks[0]!.lines[0]!.categoryId).toBe('cat-reserve')
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })

  it('změna na milník odebere řádky, které milník mít nesmí (jeden krok Zpět)', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    store.getState().addTaskLine(a, oneTime)
    store.getState().addTaskLine(a, { id: 'l2', kind: 'recurring', categoryId: 'cat-services', name: 'Nájem', amount: 1, period: 'day' })
    const before = store.getState().past.length
    store.getState().updateTask(a, { kind: 'milestone' })
    expect(store.getState().project.tasks[0]!.lines.map((l) => l.id)).toEqual(['l1'])
    expect(store.getState().past.length - before).toBe(1)
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })

  it('změna profese pracovníka se propíše do řádků s tímto pracovníkem', () => {
    const store = newStore()
    store.getState().addCatalogItem('professions', { id: 'p1', name: 'Elektrikář', categoryId: 'cat-labor', capacityPerDay: 8 })
    store.getState().addCatalogItem('professions', { id: 'p2', name: 'Montér', categoryId: 'cat-labor', capacityPerDay: 8 })
    store.getState().addCatalogItem('workers', { id: 'w1', name: 'Jan', professionId: 'p1', capacityPerDay: 8 })
    const a = store.getState().addTask('A')
    store.getState().addTaskLine(a, { id: 'l9', kind: 'labor', categoryId: 'cat-labor', professionId: 'p1', workerId: 'w1', sharePct: 100 })
    store.getState().updateCatalogItem('workers', 'w1', { professionId: 'p2' })
    expect(store.getState().project.tasks[0]!.lines[0]).toMatchObject({ professionId: 'p2', workerId: 'w1' })
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })

  it('beze změny a u neexistujícího řádku se nic nezapíše', () => {
    const store = newStore()
    const a = store.getState().addTask('A')
    store.getState().addTaskLine(a, oneTime)
    const before = store.getState().past.length
    store.getState().updateTaskLine(a, 'l1', { amount: 100_000 })
    store.getState().updateTaskLine(a, 'nic', { amount: 1 })
    store.getState().deleteTaskLine(a, 'nic')
    store.getState().addTaskLine('nic', { ...oneTime, id: 'l2' })
    expect(store.getState().past.length).toBe(before)
  })
})

describe('limity rozpočtu (fáze 7, R-06)', () => {
  it('limit projektu a kategorie: nastavit, změnit, zrušit – každá změna jeden krok Zpět', () => {
    const store = newStore()
    const before = store.getState().past.length
    store.getState().setBudgetLimit(500_000_00)
    store.getState().setCategoryLimit('cat-material', 120_000_00)
    store.getState().setCategoryLimit('cat-labor', 300_000_00)
    store.getState().setCategoryLimit('cat-material', 150_000_00)
    expect(store.getState().project.budget).toEqual({
      limit: 500_000_00,
      categoryLimits: [
        { categoryId: 'cat-material', limit: 150_000_00 },
        { categoryId: 'cat-labor', limit: 300_000_00 },
      ],
    })
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
    store.getState().setCategoryLimit('cat-labor', null)
    store.getState().setBudgetLimit(null)
    expect(store.getState().project.budget).toEqual({ categoryLimits: [{ categoryId: 'cat-material', limit: 150_000_00 }] })
    store.getState().setCategoryLimit('cat-material', null)
    expect(store.getState().project.budget).toBeUndefined()
    expect(store.getState().past.length - before).toBe(7)
    store.getState().undo()
    expect(store.getState().project.budget?.categoryLimits).toHaveLength(1)
  })

  it('nesmyslné hodnoty a neznámá kategorie se nezapíšou', () => {
    const store = newStore()
    const before = store.getState().past.length
    store.getState().setBudgetLimit(0)
    store.getState().setBudgetLimit(-5)
    store.getState().setBudgetLimit(1.5)
    store.getState().setCategoryLimit('nic', 100)
    store.getState().setBudgetLimit(null) // už není nastavený
    expect(store.getState().past.length).toBe(before)
    expect(store.getState().project.budget).toBeUndefined()
  })

  it('smazání kategorie odstraní i její limit', () => {
    const store = newStore()
    store.getState().setCategoryLimit('cat-reserve', 10_000_00)
    store.getState().deleteCategory('cat-reserve', null)
    expect(store.getState().project.budget).toBeUndefined()
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })

  it('schéma: limit kladný, kategorie existující a jen jednou', () => {
    const base = newStore().getState().project
    const ok = { ...base, budget: { limit: 1, categoryLimits: [{ categoryId: 'cat-labor', limit: 5 }] } }
    expect(ProjectSchema.safeParse(ok).success).toBe(true)
    expect(ProjectSchema.safeParse({ ...base, budget: { limit: 0, categoryLimits: [] } }).success).toBe(false)
    expect(ProjectSchema.safeParse({ ...base, budget: { categoryLimits: [{ categoryId: 'nic', limit: 5 }] } }).success).toBe(false)
    const twice = { categoryId: 'cat-labor', limit: 5 }
    expect(ProjectSchema.safeParse({ ...base, budget: { categoryLimits: [twice, twice] } }).success).toBe(false)
  })
})

describe('název projektu (kritérium 12.1)', () => {
  it('přejmenuje projekt jedním krokem Zpět; mezery ořízne, prázdný a stejný název ignoruje', () => {
    const store = newStore()
    store.getState().renameProject('  Nová linka  ')
    expect(store.getState().project.name).toBe('Nová linka')
    expect(store.getState().past).toHaveLength(1)
    store.getState().renameProject('   ')
    store.getState().renameProject('Nová linka')
    expect(store.getState().past).toHaveLength(1)
    store.getState().renameProject('x'.repeat(250))
    expect(store.getState().project.name).toHaveLength(200)
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
    store.getState().undo()
    expect(store.getState().project.name).toBe('Nová linka')
  })
})

describe('vlastní pohledy analýzy (fáze 8, A-06)', () => {
  const config = { rows: ['category' as const], column: 'period' as const, metric: 'cost' as const, agg: 'sum' as const, period: 'month' as const, filters: { kind: ['labor'] } }

  it('uložit, změnit, přejmenovat, smazat – každá změna jeden krok Zpět; název je jedinečný', () => {
    const store = newStore()
    const before = store.getState().past.length
    const id = store.getState().saveView('  Mzdy po měsících  ', config)!
    const id2 = store.getState().saveView('mzdy po měsících', { ...config, metric: 'hours' })!
    expect(store.getState().project.views!.map((v) => v.name)).toEqual(['Mzdy po měsících', 'mzdy po měsících 2'])
    store.getState().updateView(id, { ...config, agg: 'avg' })
    expect(store.getState().project.views![0]!.config.agg).toBe('avg')
    store.getState().renameView(id2, 'Hodiny')
    store.getState().deleteView(id)
    expect(store.getState().project.views!.map((v) => [v.id, v.name])).toEqual([[id2, 'Hodiny']])
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
    store.getState().deleteView(id2)
    expect(store.getState().project.views).toBeUndefined()
    expect(store.getState().past.length - before).toBe(6)
    store.getState().undo()
    expect(store.getState().project.views).toHaveLength(1)
  })

  it('prázdný název, neznámý pohled, nic nového = nic se nezapíše', () => {
    const store = newStore()
    const id = store.getState().saveView('A', config)!
    const before = store.getState().past.length
    expect(store.getState().saveView('   ', config)).toBeNull()
    store.getState().renameView(id, '  ')
    store.getState().renameView(id, 'A')
    store.getState().renameView('nic', 'B')
    store.getState().updateView(id, config)
    store.getState().deleteView('nic')
    expect(store.getState().past.length).toBe(before)
  })

  it('schéma: nepovinné; neznámá dimenze, 3 úrovně řádků nebo 51 pohledů neprojde', () => {
    const base = newStore().getState().project
    const view = (c: object) => ({ ...base, views: [{ id: 'v', name: 'V', config: { ...config, ...c } }] })
    expect(ProjectSchema.safeParse(view({})).success).toBe(true)
    expect(ProjectSchema.safeParse(view({ rows: ['kouzlo'] })).success).toBe(false)
    expect(ProjectSchema.safeParse(view({ rows: ['phase', 'kind', 'tag'] })).success).toBe(false)
    expect(ProjectSchema.safeParse(view({ rows: [] })).success).toBe(false)
    expect(ProjectSchema.safeParse(view({ filters: { kouzlo: ['x'] } })).success).toBe(false)
    const many = Array.from({ length: 51 }, (_, i) => ({ id: `v${i}`, name: `V${i}`, config }))
    expect(ProjectSchema.safeParse({ ...base, views: many }).success).toBe(false)
  })
})

describe('baseline, skutečné náklady a datum stavu (fáze 9)', () => {
  const snapshot = (taskId: string) => ({
    savedAt: '2026-11-17',
    tasks: [{ taskId, parentId: null, name: 'A', kind: 'task' as const, start: '2026-11-16', finish: '2026-11-18', durationDays: 3, costStart: '2026-11-16', costs: [100, 100, 100] }],
  })

  it('baseline: uložit (nová je vybraná), přejmenovat, vybrat, smazat – každé jeden krok Zpět', () => {
    const store = newStore()
    const task = store.getState().addTask('A')
    const before = store.getState().past.length
    const b1 = store.getState().saveBaseline('  Schválený plán ', snapshot(task))!
    const b2 = store.getState().saveBaseline('schválený plán', snapshot(task))!
    let p = store.getState().project
    expect(p.baselines.map((b) => b.name)).toEqual(['Schválený plán', 'schválený plán 2'])
    expect(p.activeBaselineId).toBe(b2)
    store.getState().renameBaseline(b2, 'Po změně 1')
    store.getState().setActiveBaseline(b1)
    expect(store.getState().project.activeBaselineId).toBe(b1)
    // Smazání vybrané: vybere se poslední zbývající.
    store.getState().deleteBaseline(b1)
    p = store.getState().project
    expect(p.baselines.map((b) => [b.id, b.name])).toEqual([[b2, 'Po změně 1']])
    expect(p.activeBaselineId).toBe(b2)
    expect(ProjectSchema.safeParse(p).success).toBe(true)
    store.getState().deleteBaseline(b2)
    expect(store.getState().project.baselines).toEqual([])
    expect(store.getState().project.activeBaselineId).toBeUndefined()
    expect(store.getState().past.length - before).toBe(6)
    store.getState().undo()
    expect(store.getState().project.activeBaselineId).toBe(b2)
  })

  it('baseline: prázdný název, 11. baseline, neznámé ID ani nic nového se nezapíše', () => {
    const store = newStore()
    const task = store.getState().addTask('A')
    const id = store.getState().saveBaseline('B', snapshot(task))!
    const before = store.getState().past.length
    expect(store.getState().saveBaseline('  ', snapshot(task))).toBeNull()
    store.getState().renameBaseline(id, 'B')
    store.getState().renameBaseline('nic', 'C')
    store.getState().setActiveBaseline(id)
    store.getState().setActiveBaseline('nic')
    store.getState().deleteBaseline('nic')
    expect(store.getState().past.length).toBe(before)
    for (let i = 0; i < 9; i++) store.getState().saveBaseline(`B${i}`, snapshot(task))
    expect(store.getState().project.baselines).toHaveLength(10)
    expect(store.getState().saveBaseline('Navíc', snapshot(task))).toBeNull()
  })

  it('skutečné náklady: přidat, upravit, smazat – každé jeden krok Zpět; neplatné hodnoty se nezapíšou', () => {
    const store = newStore()
    const task = store.getState().addTask('A')
    const before = store.getState().past.length
    const a1 = store.getState().addActual(task, { date: '2026-11-20', amount: 1_500_00, note: '  faktura 12 ' })!
    const a2 = store.getState().addActual(task, { date: '2026-11-18', amount: 50_00 })!
    let actuals = store.getState().project.tasks[0]!.actuals!
    // Seřazené podle data; poznámka oříznutá.
    expect(actuals.map((a) => [a.id, a.date, a.amount, a.note])).toEqual([
      [a2, '2026-11-18', 5000, undefined],
      [a1, '2026-11-20', 150000, 'faktura 12'],
    ])
    store.getState().updateActual(task, a1, { amount: 2_000_00, note: '' })
    actuals = store.getState().project.tasks[0]!.actuals!
    expect(actuals[1]).toEqual({ id: a1, date: '2026-11-20', amount: 200000 })
    expect(store.getState().addActual(task, { date: '2026-02-30', amount: 1 })).toBeNull()
    expect(store.getState().addActual(task, { date: '2026-11-20', amount: -1 })).toBeNull()
    expect(store.getState().addActual(task, { date: '2026-11-20', amount: 1.5 })).toBeNull()
    expect(store.getState().addActual('nic', { date: '2026-11-20', amount: 1 })).toBeNull()
    store.getState().updateActual(task, a1, { amount: 200000 })
    store.getState().deleteActual(task, a2)
    store.getState().deleteActual(task, a1)
    expect(store.getState().project.tasks[0]!.actuals).toBeUndefined()
    expect(store.getState().past.length - before).toBe(5)
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
  })

  it('kopie činnosti skutečné náklady nepřebírá (jsou to opravdu utracené peníze)', () => {
    const store = newStore()
    const task = store.getState().addTask('A')
    store.getState().addActual(task, { date: '2026-11-20', amount: 100 })
    const copy = store.getState().duplicateTask(task, ' (kopie)')!
    expect(store.getState().project.tasks.find((t) => t.id === copy)!.actuals).toBeUndefined()
  })

  it('datum stavu: nastavit, zrušit (= dnes), neplatné se nezapíše', () => {
    const store = newStore()
    store.getState().setStatusDate('2026-12-31')
    expect(store.getState().project.statusDate).toBe('2026-12-31')
    const before = store.getState().past.length
    store.getState().setStatusDate('2026-12-31')
    store.getState().setStatusDate('31.12.2026')
    expect(store.getState().past.length).toBe(before)
    store.getState().setStatusDate(null)
    expect(store.getState().project.statusDate).toBeUndefined()
  })

  it('schéma: starší soubor bez nových polí projde; chybná baseline nebo odkaz neprojde', () => {
    const store = newStore()
    const task = store.getState().addTask('A')
    store.getState().saveBaseline('B', snapshot(task))
    const base = store.getState().project
    const b = base.baselines[0]!
    expect(ProjectSchema.safeParse(base).success).toBe(true)
    expect(ProjectSchema.safeParse({ ...base, activeBaselineId: 'nic' }).success).toBe(false)
    expect(ProjectSchema.safeParse({ ...base, statusDate: '2026-13-01' }).success).toBe(false)
    const withTask = (patch: object) => ({ ...base, baselines: [{ ...b, tasks: [{ ...b.tasks[0]!, ...patch }] }] })
    expect(ProjectSchema.safeParse(withTask({ finish: '2026-11-01' })).success).toBe(false)
    expect(ProjectSchema.safeParse(withTask({ costs: [1.5] })).success).toBe(false)
    expect(ProjectSchema.safeParse(withTask({ costs: new Array(3661).fill(0) })).success).toBe(false)
    expect(ProjectSchema.safeParse({ ...base, baselines: [{ ...b, tasks: [b.tasks[0]!, b.tasks[0]!] }] }).success).toBe(false)
    const many = Array.from({ length: 11 }, (_, i) => ({ ...b, id: `b${i}` }))
    expect(ProjectSchema.safeParse({ ...base, baselines: many, activeBaselineId: 'b0' }).success).toBe(false)
    const actual = (a: object) => ({ ...base, tasks: base.tasks.map((t) => ({ ...t, actuals: [{ id: 'a', date: '2026-11-20', amount: 100, ...a }] })) })
    expect(ProjectSchema.safeParse(actual({})).success).toBe(true)
    expect(ProjectSchema.safeParse(actual({ amount: -5 })).success).toBe(false)
    expect(ProjectSchema.safeParse(actual({ note: 'x'.repeat(501) })).success).toBe(false)
  })
})

describe('myšlenková mapa (fáze 12)', () => {
  it('uložení mapy je jeden krok Zpět a projekt zůstane platný', () => {
    const store = newStore()
    const map = { nodes: [{ id: 'r', parentId: null, order: 0, text: 'Test' }] }
    store.getState().setMindMap(map)
    expect(store.getState().project.mindMap).toBe(map)
    expect(ProjectSchema.safeParse(store.getState().project).success).toBe(true)
    store.getState().undo()
    expect(store.getState().project.mindMap).toBeUndefined()
  })
})
