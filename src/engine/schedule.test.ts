import { describe, expect, it } from 'vitest'
import { schedule } from './schedule'
import { createEmptyProject, createTask, type Project, type Task, type TaskKind } from '../model/schema'

/** Pomocník: činnost s FS vazbami ve tvaru [id předchůdce, prodleva]. */
function task(id: string, durationDays: number, preds: [string, number][] = [], kind: TaskKind = 'task'): Task {
  return {
    ...createTask({ id, name: id, order: 0, kind, durationDays }),
    dependencies: preds.map(([predecessorId, lagDays]) => ({ predecessorId, type: 'FS', lagDays })),
  }
}

/** Projekt začínající v pondělí 16. 11. 2026 (úterý 17. 11. je státní svátek). */
function project(tasks: Task[], patch: Partial<Project> = {}): Project {
  const p = createEmptyProject({ name: 'Test', language: 'cs', startDate: '2026-11-16' })
  return { ...p, ...patch, tasks: tasks.map((t, order) => ({ ...t, order })) }
}

function dates(p: Project, id: string) {
  const t = schedule(p).tasks.get(id)
  return [t?.start, t?.finish]
}

describe('plánovací jádro – základ', () => {
  it('činnost bez předchůdců začíná prvním pracovním dnem projektu', () => {
    // 16. 11. Po, 17. 11. svátek → 3 dny = Po, St, Čt
    expect(dates(project([task('A', 3)]), 'A')).toEqual(['2026-11-16', '2026-11-19'])
  })

  it('začátek projektu o víkendu se posune na pondělí', () => {
    const p = project([task('A', 1)], { startDate: '2026-11-21' })
    expect(dates(p, 'A')).toEqual(['2026-11-23', '2026-11-23'])
  })

  it('činnost na 1 den začíná i končí tentýž den', () => {
    expect(dates(project([task('A', 1)]), 'A')).toEqual(['2026-11-16', '2026-11-16'])
  })
})

describe('vazba FS (konec → začátek)', () => {
  it('následník začne další pracovní den po konci předchůdce', () => {
    const p = project([task('A', 3), task('B', 2, [['A', 0]])])
    // A: Po 16.–Čt 19. → B: Pá 20., Po 23.
    expect(dates(p, 'B')).toEqual(['2026-11-20', '2026-11-23'])
  })

  it('řetězec tří činností přes víkend', () => {
    const p = project([task('A', 5), task('B', 5, [['A', 0]]), task('C', 1, [['B', 0]])])
    expect(dates(p, 'A')).toEqual(['2026-11-16', '2026-11-23'])
    expect(dates(p, 'B')).toEqual(['2026-11-24', '2026-11-30'])
    expect(dates(p, 'C')).toEqual(['2026-12-01', '2026-12-01'])
  })

  it('prodleva posune začátek o pracovní dny', () => {
    const p = project([task('A', 1), task('B', 1, [['A', 3]])])
    // A: Po 16. → bez prodlevy St 18.; +3 pracovní dny = Po 23.
    expect(dates(p, 'B')).toEqual(['2026-11-23', '2026-11-23'])
  })

  it('předstih (záporná prodleva) začne dřív, ale ne před začátkem projektu', () => {
    const p = project([task('A', 5), task('B', 1, [['A', -2]]), task('C', 1, [['A', -20]])])
    // A končí Po 23. → bez předstihu Út 24.; −2 = Pá 20.
    expect(dates(p, 'B')).toEqual(['2026-11-20', '2026-11-20'])
    expect(dates(p, 'C')).toEqual(['2026-11-16', '2026-11-16'])
  })

  it('víc předchůdců: rozhoduje ten, který skončí nejpozději', () => {
    const p = project([task('A', 2), task('B', 6), task('C', 1, [['A', 0], ['B', 0]])])
    // B: Po 16. + 6 dnů = Út 24. → C: St 25.
    expect(dates(p, 'C')).toEqual(['2026-11-25', '2026-11-25'])
  })

  it('pořadí řádků nehraje roli (následník může být nad předchůdcem)', () => {
    const p = project([task('B', 1, [['A', 0]]), task('A', 2)])
    expect(dates(p, 'B')).toEqual(['2026-11-19', '2026-11-19'])
  })

  it('respektuje vlastní odstávku v kalendáři', () => {
    const p = project([task('A', 25), task('B', 1, [['A', 0]])], {
      calendar: {
        workingWeekdays: [1, 2, 3, 4, 5],
        useCzechHolidays: true,
        customHolidays: [{ start: '2026-12-21', end: '2026-12-31', name: 'Odstávka' }],
        removedHolidays: [],
      },
    })
    // 25 pracovních dnů od 16. 11.: do Pá 18. 12. je jich 24, pak odstávka a 1. 1. → 25. den = Po 4. 1. 2027
    expect(dates(p, 'A')).toEqual(['2026-11-16', '2027-01-04'])
    expect(dates(p, 'B')).toEqual(['2027-01-05', '2027-01-05'])
  })
})

describe('milníky', () => {
  it('milník leží na dni konce předchůdce, následník začne další pracovní den', () => {
    const p = project([task('A', 2), task('M', 0, [['A', 0]], 'milestone'), task('B', 1, [['M', 0]])])
    // A: Po 16., St 18.
    expect(dates(p, 'M')).toEqual(['2026-11-18', '2026-11-18'])
    expect(dates(p, 'B')).toEqual(['2026-11-19', '2026-11-19'])
  })

  it('milník bez předchůdců je na začátku projektu a následník začne týž den', () => {
    const p = project([task('M', 0, [], 'milestone'), task('A', 1, [['M', 0]])])
    expect(dates(p, 'M')).toEqual(['2026-11-16', '2026-11-16'])
    expect(dates(p, 'A')).toEqual(['2026-11-16', '2026-11-16'])
  })

  it('milník po milníku na začátku projektu nespadne před začátek projektu', () => {
    const p = project([task('M1', 0, [], 'milestone'), task('M2', 0, [['M1', 0]], 'milestone')])
    expect(dates(p, 'M2')).toEqual(['2026-11-16', '2026-11-16'])
  })
})

describe('omezení „začít nejdříve k datu“ (fáze 4b)', () => {
  /** Činnost s omezením. */
  const constrained = (t: Task, constraintStart: string): Task => ({ ...t, constraintStart })

  it('činnost bez předchůdců začne k datu omezení', () => {
    expect(dates(project([constrained(task('A', 2), '2026-11-25')]), 'A')).toEqual(['2026-11-25', '2026-11-26'])
  })

  it('omezení o víkendu nebo ve svátek se posune na další pracovní den', () => {
    expect(dates(project([constrained(task('A', 1), '2026-11-21')]), 'A')).toEqual(['2026-11-23', '2026-11-23']) // So → Po
    expect(dates(project([constrained(task('B', 1), '2026-11-17')]), 'B')).toEqual(['2026-11-18', '2026-11-18']) // svátek → St
  })

  it('omezení později než vazba: platí omezení', () => {
    const p = project([task('A', 3), constrained(task('B', 1, [['A', 0]]), '2026-11-25')])
    // A: 16.–19. → podle vazby by B začala Pá 20.; omezení říká St 25.
    expect(dates(p, 'B')).toEqual(['2026-11-25', '2026-11-25'])
    expect(schedule(p).constraintOverridden.has('B')).toBe(false)
  })

  it('omezení dřív než vazba: platí vazba a jádro to oznámí', () => {
    const p = project([task('A', 3), constrained(task('B', 1, [['A', 0]]), '2026-11-16')])
    expect(dates(p, 'B')).toEqual(['2026-11-20', '2026-11-20'])
    expect([...schedule(p).constraintOverridden]).toEqual(['B'])
  })

  it('omezení před začátkem projektu se neuplatní (projekt začíná později)', () => {
    expect(dates(project([constrained(task('A', 1), '2026-11-01')]), 'A')).toEqual(['2026-11-16', '2026-11-16'])
  })

  it('milník s omezením leží na jeho dni, následník začne týž den', () => {
    const p = project([constrained(task('M', 0, [], 'milestone'), '2026-11-20'), task('B', 1, [['M', 0]])])
    expect(dates(p, 'M')).toEqual(['2026-11-20', '2026-11-20'])
    expect(dates(p, 'B')).toEqual(['2026-11-20', '2026-11-20'])
  })

  it('posunutá činnost posune i své následníky', () => {
    const p = project([constrained(task('A', 2), '2026-11-23'), task('B', 1, [['A', 0]])])
    // A: Po 23., Út 24. → B: St 25.
    expect(dates(p, 'B')).toEqual(['2026-11-25', '2026-11-25'])
  })
})

describe('fáze (sumární řádky)', () => {
  it('fáze bez činností nemá termín', () => {
    expect(dates(project([task('F', 0, [], 'phase')]), 'F')).toEqual([null, null])
  })

  it('fáze s podřízenými činnostmi trvá od prvního začátku do posledního konce', () => {
    const tasks = [
      task('F', 0, [], 'phase'),
      { ...task('A', 2), parentId: 'F' },
      { ...task('B', 3, [['A', 0]]), parentId: 'F' },
      task('C', 1, [['F', 0]]),
    ]
    const p = project(tasks)
    // A: 16.–18., B: 19.–23. → F: 16.–23.; C navazuje na fázi: Út 24.
    expect(dates(p, 'F')).toEqual(['2026-11-16', '2026-11-23'])
    expect(dates(p, 'C')).toEqual(['2026-11-24', '2026-11-24'])
  })

  it('délka fáze = pracovní dny od jejího začátku do konce; činnost a milník mají svou délku', () => {
    const tasks = [
      task('F', 0, [], 'phase'),
      { ...task('A', 2), parentId: 'F' },
      { ...task('B', 3, [['A', 0]]), parentId: 'F' },
      { ...task('M', 0, [['B', 0]], 'milestone'), parentId: 'F' },
      task('E', 0, [], 'phase'), // prázdná fáze
    ]
    const result = schedule(project(tasks))
    // F: Po 16.–Po 23. 11. = 16., 18., 19., 20., 23. (17. svátek, 21.–22. víkend) = 5 dní
    expect(result.tasks.get('F')?.durationDays).toBe(5)
    expect(result.tasks.get('A')?.durationDays).toBe(2)
    expect(result.tasks.get('M')?.durationDays).toBe(0)
    expect(result.tasks.get('E')?.durationDays).toBeNull()
  })

  it('vnořené fáze: nadřazená fáze zahrne termíny podfází', () => {
    const tasks = [
      task('F', 0, [], 'phase'),
      { ...task('G', 0, [], 'phase'), parentId: 'F' },
      { ...task('A', 2), parentId: 'G' },
      { ...task('B', 1, [['A', 0]]), parentId: 'F' },
    ]
    const p = project(tasks)
    expect(dates(p, 'G')).toEqual(['2026-11-16', '2026-11-18'])
    expect(dates(p, 'F')).toEqual(['2026-11-16', '2026-11-19'])
  })
})

describe('chyby a celkové výsledky', () => {
  it('zacyklené vazby se označí, ostatní činnosti se spočítají', () => {
    const p = project([task('A', 1, [['B', 0]]), task('B', 1, [['A', 0]]), task('C', 2)])
    const result = schedule(p)
    expect([...result.cycleTaskIds].sort()).toEqual(['A', 'B'])
    expect(result.tasks.get('A')).toEqual({ start: null, finish: null, durationDays: null })
    expect(dates(p, 'C')).toEqual(['2026-11-16', '2026-11-18'])
  })

  it('činnost čekající na zacyklené činnosti také nejde spočítat', () => {
    const p = project([task('A', 1, [['B', 0]]), task('B', 1, [['A', 0]]), task('D', 1, [['B', 0]])])
    expect(schedule(p).cycleTaskIds.has('D')).toBe(true)
  })

  it('vazba na neexistující činnost se ignoruje', () => {
    const p = project([task('A', 1, [['neni', 0]])])
    expect(dates(p, 'A')).toEqual(['2026-11-16', '2026-11-16'])
  })

  it('konec projektu = nejpozdější konec činnosti', () => {
    const p = project([task('A', 2), task('B', 5)])
    expect(schedule(p).projectFinish).toBe('2026-11-23')
    expect(schedule(project([])).projectFinish).toBeNull()
  })

  it('kalendář bez pracovních dnů vrátí chybu místo zamrznutí', () => {
    const p = project([task('A', 1)], {
      calendar: { workingWeekdays: [], useCzechHolidays: false, customHolidays: [], removedHolidays: [] },
    })
    const result = schedule(p)
    expect(result.error).toBe('noWorkingDays')
    expect(result.tasks.get('A')).toEqual({ start: null, finish: null, durationDays: null })
  })

  it('výpočet nemění vstupní projekt (čistá funkce)', () => {
    const p = project([task('A', 2), task('B', 1, [['A', 0]])])
    const copy = structuredClone(p)
    schedule(p)
    expect(p).toEqual(copy)
  })

  it('300 navazujících činností spočítá do 100 ms (N-02)', () => {
    const tasks = Array.from({ length: 300 }, (_, i) => task(`T${i}`, 5, i > 0 ? [[`T${i - 1}`, 0]] : []))
    const p = project(tasks)
    schedule(p) // zahřátí
    const t0 = performance.now()
    const result = schedule(p)
    expect(performance.now() - t0).toBeLessThan(100)
    expect(result.tasks.get('T299')?.finish).not.toBeNull()
  })
})
