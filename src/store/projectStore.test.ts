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
