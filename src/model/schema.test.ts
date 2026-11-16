import { describe, expect, it } from 'vitest'
import { createEmptyProject, createTask, ProjectSchema, SCHEMA_VERSION, type Project, type TaskKind } from './schema'
import { createDefaultRateCalc } from './rates'
import { isValidIsoDate, todayIso } from './dates'

function validProject(): Project {
  const project = createEmptyProject({ name: 'Test', language: 'cs', startDate: '2026-11-16' })
  project.tasks = [
    createTask({ id: 'a', name: 'Analýza', order: 0, durationDays: 5 }),
    createTask({ id: 'b', name: 'Podpis', order: 1, kind: 'milestone' }),
  ]
  return project
}

describe('schéma projektu', () => {
  it('přijme platný projekt', () => {
    expect(ProjectSchema.safeParse(validProject()).success).toBe(true)
  })

  it('přijme nový prázdný projekt', () => {
    expect(ProjectSchema.safeParse(createEmptyProject({ name: 'Nový', language: 'en' })).success).toBe(true)
  })

  it('odmítne zápornou délku', () => {
    const project = validProject()
    project.tasks[0]!.durationDays = -3
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne činnost bez názvu (i jen s mezerami)', () => {
    const project = validProject()
    project.tasks[0]!.name = '   '
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne milník s nenulovou délkou', () => {
    const project = validProject()
    project.tasks[1]!.durationDays = 2
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne % hotovo mimo 0–100', () => {
    const project = validProject()
    project.tasks[0]!.percentComplete = 120
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne duplicitní ID činností', () => {
    const project = validProject()
    project.tasks[1]!.id = 'a'
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne vazbu na neexistující činnost', () => {
    const project = validProject()
    project.tasks[1]!.dependencies = [{ predecessorId: 'xyz', type: 'FS', lagDays: 0 }]
    expect(ProjectSchema.safeParse(project).success).toBe(false)
  })

  it('odmítne neplatné datum a jinou verzi formátu', () => {
    expect(ProjectSchema.safeParse({ ...validProject(), startDate: '2026-02-30' }).success).toBe(false)
    expect(ProjectSchema.safeParse({ ...validProject(), schemaVersion: 99 }).success).toBe(false)
  })

  it('odmítne kalendář bez pracovních dnů a odstávku s koncem před začátkem', () => {
    const noDays = validProject()
    noDays.calendar.workingWeekdays = []
    expect(ProjectSchema.safeParse(noDays).success).toBe(false)
    const badRange = validProject()
    badRange.calendar.customHolidays = [{ start: '2026-12-31', end: '2026-12-21', name: 'x' }]
    expect(ProjectSchema.safeParse(badRange).success).toBe(false)
  })

  it('odmítne nesmyslná data (ne objekt projektu)', () => {
    expect(ProjectSchema.safeParse('ahoj').success).toBe(false)
    expect(ProjectSchema.safeParse({}).success).toBe(false)
  })
})

/** Kódy chyb, které schéma ohlásí (pro přehledné porovnání v testech). */
function issueCodes(project: unknown): string[] {
  const result = ProjectSchema.safeParse(project)
  return result.success ? [] : result.error.issues.map((i) => i.message)
}

describe('schéma projektu – strom a vazby (fáze 5: soubor zvenku)', () => {
  /** Projekt ze seznamu [id, nadřazená, typ]. */
  function tree(items: [string, string | null, TaskKind][]): Project {
    const project = createEmptyProject({ name: 'Test', language: 'cs', startDate: '2026-11-16' })
    project.tasks = items.map(([id, parentId, kind], order) => ({ ...createTask({ id, name: id, order, kind }), parentId }))
    return project
  }

  it('přijme platný strom fází', () => {
    expect(issueCodes(tree([['F', null, 'phase'], ['A', 'F', 'task'], ['G', 'F', 'phase'], ['B', 'G', 'task']]))).toEqual([])
  })

  it('podřízené položky smí mít jen fáze', () => {
    expect(issueCodes(tree([['A', null, 'task'], ['B', 'A', 'task']]))).toContain('parentNotPhase')
  })

  it('kruh v nadřazených (A pod B, B pod A)', () => {
    expect(issueCodes(tree([['A', 'B', 'phase'], ['B', 'A', 'phase']]))).toContain('parentCycle')
  })

  it('nejvýš 6 úrovní', () => {
    const items: [string, string | null, TaskKind][] = [
      ['F1', null, 'phase'],
      ['F2', 'F1', 'phase'],
      ['F3', 'F2', 'phase'],
      ['F4', 'F3', 'phase'],
      ['F5', 'F4', 'phase'],
      ['F6', 'F5', 'phase'],
    ]
    expect(issueCodes(tree(items))).toEqual([]) // 6 úrovní je v pořádku
    expect(issueCodes(tree([...items, ['A', 'F6', 'task']]))).toContain('tooDeep')
  })

  it('vazba sama na sebe, dvakrát na stejnou činnost a vazby fází se odmítnou', () => {
    const self = tree([['A', null, 'task']])
    self.tasks[0]!.dependencies = [{ predecessorId: 'A', type: 'FS', lagDays: 0 }]
    expect(issueCodes(self)).toContain('selfDependency')

    const twice = tree([['A', null, 'task'], ['B', null, 'task']])
    twice.tasks[1]!.dependencies = [
      { predecessorId: 'A', type: 'FS', lagDays: 0 },
      { predecessorId: 'A', type: 'SS', lagDays: 0 },
    ]
    expect(issueCodes(twice)).toContain('duplicateDependency')

    const phase = tree([['F', null, 'phase'], ['A', null, 'task']])
    phase.tasks[1]!.dependencies = [{ predecessorId: 'F', type: 'FS', lagDays: 0 }]
    expect(issueCodes(phase)).toContain('phaseDependency')
    phase.tasks[1]!.dependencies = []
    phase.tasks[0]!.dependencies = [{ predecessorId: 'A', type: 'FS', lagDays: 0 }]
    expect(issueCodes(phase)).toContain('phaseDependency')
  })
})

describe('data', () => {
  it('pozná platné a neplatné ISO dny', () => {
    expect(isValidIsoDate('2028-02-29')).toBe(true) // přestupný rok
    expect(isValidIsoDate('2027-02-29')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('14. 11. 2026')).toBe(false)
  })

  it('dnešek vrací ve formátu YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('databáze zdrojů (fáze 6a, formát v2)', () => {
  /** Projekt s vyplněnými číselníky. */
  function withCatalogs(): Project {
    const project = validProject()
    project.professions = [
      { id: 'p1', name: 'Programátor PLC', categoryId: 'cat-labor', capacityPerDay: 8, rateCalc: { ...createDefaultRateCalc(), monthlyWage: 6_000_000 } },
      { id: 'p2', name: 'Elektrikář', categoryId: 'cat-labor', capacityPerDay: 8, manualRate: 45_000 },
    ]
    project.workers = [
      { id: 'w1', name: 'Jan Novák', professionId: 'p1', capacityPerDay: 8 },
      { id: 'w2', name: 'Eva Malá', professionId: 'p2', capacityPerDay: 6, manualRate: 50_000 },
    ]
    project.machines = [{ id: 'm1', name: 'Jeřáb', categoryId: 'cat-services', rate: 150_000, rateUnit: 'hour', capacityPerDay: 8 }]
    project.materials = [
      { id: 'x1', name: 'Kabel CYKY 3×2,5', unit: 'm', unitPrice: 3_250, categoryId: 'cat-material' },
      { id: 'x2', name: 'Čidlo', unit: 'ks', unitPrice: 189_900, categoryId: 'cat-material', code: 'SNS-01', supplier: 'Elektro s.r.o.' },
    ]
    return project
  }
  const issues = (project: Project) => {
    const result = ProjectSchema.safeParse(project)
    return result.success ? [] : result.error.issues.map((i) => i.message)
  }

  it('verze formátu je 2', () => {
    expect(SCHEMA_VERSION).toBe(2)
  })

  it('nový projekt má výchozí kategorie nákladů podle jazyka a prázdné číselníky', () => {
    const cs = createEmptyProject({ name: 'Nový', language: 'cs' })
    expect(cs.costCategories.map((c) => c.name)).toEqual(['Materiál', 'Mzdy', 'Služby', 'Investice', 'Režie', 'Rezerva'])
    expect(createEmptyProject({ name: 'New', language: 'en' }).costCategories.map((c) => c.name)).toEqual([
      'Material',
      'Labour',
      'Services',
      'Investment',
      'Overhead',
      'Reserve',
    ])
    expect(createEmptyProject({ name: 'Nový', language: 'de' }).costCategories[0]!.name).toBe('Material') // neznámý jazyk → anglicky
    expect([cs.professions, cs.workers, cs.machines, cs.materials]).toEqual([[], [], [], []])
    expect(createTask({ id: 'a', name: 'A', order: 0 }).lines).toEqual([])
  })

  it('přijme platné číselníky', () => {
    expect(issues(withCatalogs())).toEqual([])
  })

  it('odkazy musí vést na existující profesi a kategorii', () => {
    const p = withCatalogs()
    p.workers[0]!.professionId = 'nic'
    p.materials[0]!.categoryId = 'nic'
    p.machines[0]!.categoryId = 'nic'
    p.professions[1]!.categoryId = 'nic'
    expect(issues(p).sort()).toEqual(['unknownCategory', 'unknownCategory', 'unknownCategory', 'unknownProfession'])
  })

  it('názvy v jednom číselníku jsou jedinečné (bez ohledu na velikost písmen a mezery), ID také', () => {
    const p = withCatalogs()
    p.materials[1]!.name = '  kabel cyky 3×2,5 '
    p.workers[1]!.id = 'w1'
    expect(issues(p).sort()).toEqual(['duplicateId', 'duplicateName'])
    const q = withCatalogs()
    q.materials[0]!.name = 'Elektrikář' // stejný název v JINÉM číselníku nevadí
    expect(issues(q)).toEqual([])
  })

  it('peníze jsou celá nezáporná čísla, kapacita 0,5–24 h', () => {
    for (const change of [
      (p: Project) => (p.materials[0]!.unitPrice = -1),
      (p: Project) => (p.materials[0]!.unitPrice = 10.5),
      (p: Project) => (p.professions[1]!.manualRate = -100),
      (p: Project) => (p.machines[0]!.rate = 1.5),
      (p: Project) => (p.workers[0]!.capacityPerDay = 0),
      (p: Project) => (p.workers[0]!.capacityPerDay = 25),
      (p: Project) => (p.professions[0]!.rateCalc!.monthlyWage = 100.5),
      (p: Project) => (p.professions[0]!.rateCalc!.productivityPct = 150),
      (p: Project) => (p.materials[0]!.unit = ''),
    ]) {
      const p = withCatalogs()
      change(p)
      expect(ProjectSchema.safeParse(p).success).toBe(false)
    }
  })

  it('střediska: pracovník smí mít středisko jen z číselníku; bez střediska je také v pořádku', () => {
    const p = withCatalogs()
    p.departments = [{ id: 'd1', name: 'Výroba', code: '120' }]
    p.workers[0]!.departmentId = 'd1'
    expect(issues(p)).toEqual([])
    p.workers[1]!.departmentId = 'nic'
    p.departments.push({ id: 'd2', name: ' výroba ' })
    expect(issues(p).sort()).toEqual(['duplicateName', 'unknownDepartment'])
  })

  it('nepřítomnosti pracovníka (fáze 6c): rozsahy od–do s poznámkou; konec před začátkem neprojde', () => {
    const p = withCatalogs()
    p.workers[0]!.absences = [
      { start: '2026-12-21', end: '2026-12-31', note: 'Dovolená' },
      { start: '2027-02-03', end: '2027-02-03' },
    ]
    expect(issues(p)).toEqual([])
    p.workers[0]!.absences!.push({ start: '2027-03-10', end: '2027-03-01' })
    expect(ProjectSchema.safeParse(p).success).toBe(false)
    const q = withCatalogs()
    q.workers[0]!.absences = [{ start: '2027-02-30', end: '2027-03-01' }]
    expect(ProjectSchema.safeParse(q).success).toBe(false)
  })

  it('jedna nepřítomnost trvá nejvýš 731 kalendářních dnů (ochrana proti zamrznutí podvrženým souborem)', () => {
    const p = withCatalogs()
    p.workers[0]!.absences = [{ start: '2026-01-01', end: '2028-01-01' }] // 731 dnů včetně obou krajů
    expect(issues(p)).toEqual([])
    p.workers[0]!.absences = [{ start: '2026-01-01', end: '2028-01-02' }] // 732 dnů
    const tooLong = ProjectSchema.safeParse(p)
    expect(tooLong.success === false && tooLong.error.issues.some((i) => i.message === 'absenceTooLong')).toBe(true)
    p.workers[0]!.absences = [{ start: '0001-01-01', end: '9999-12-31' }]
    expect(ProjectSchema.safeParse(p).success).toBe(false)
  })

  it('soubor bez číselníku středisek (rozpracovaná verze 2) se přečte s prázdným seznamem', () => {
    const { departments, ...withoutDepartments } = withCatalogs()
    void departments
    const result = ProjectSchema.safeParse(withoutDepartments)
    expect(result.success && result.data.departments).toEqual([])
  })

  describe('řádky zdrojů a nákladů na činnosti (fáze 6b)', () => {
    /** Projekt s jedním řádkem každého typu na činnosti „a“. */
    function withLines(): Project {
      const p = withCatalogs()
      p.tasks[0]!.lines = [
        { id: 'l1', kind: 'labor', categoryId: 'cat-labor', professionId: 'p1', workerId: 'w1', sharePct: 50 },
        { id: 'l2', kind: 'machine', categoryId: 'cat-services', machineId: 'm1', sharePct: 25 },
        { id: 'l3', kind: 'material', categoryId: 'cat-material', materialId: 'x1', quantity: 120.5 },
        { id: 'l4', kind: 'oneTime', categoryId: 'cat-services', name: 'Záloha', amount: 5_000_000, timing: 'date', date: '2026-11-20' },
        { id: 'l5', kind: 'recurring', categoryId: 'cat-services', name: 'Nájem', amount: 70_000, period: 'week', note: 'kontejner' },
      ]
      return p
    }

    it('přijme platné řádky všech pěti typů', () => {
      expect(issues(withLines())).toEqual([])
    })

    it('odkazy do databáze musí existovat; pracovník musí patřit k profesi řádku', () => {
      const p = withLines()
      const lines = p.tasks[0]!.lines as Record<string, unknown>[]
      lines[0]!.workerId = 'w2' // Eva je elektrikářka, řádek je na programátora
      lines[1]!.machineId = 'nic'
      lines[2]!.materialId = 'nic'
      lines[3]!.categoryId = 'nic'
      expect(issues(p).sort()).toEqual(['unknownCategory', 'unknownMachine', 'unknownMaterial', 'workerProfessionMismatch'])
      const q = withLines()
      ;(q.tasks[0]!.lines[0] as Record<string, unknown>).professionId = 'nic'
      expect(issues(q)).toContain('unknownProfession')
    })

    it('milník smí mít jen jednorázový náklad a materiál', () => {
      const p = withLines()
      p.tasks[1]!.lines = [p.tasks[0]!.lines[2]!, p.tasks[0]!.lines[3]!].map((l, i) => ({ ...l, id: `m${i}` }))
      expect(issues(p)).toEqual([])
      p.tasks[1]!.lines.push({ ...p.tasks[0]!.lines[0]!, id: 'm9' })
      expect(issues(p)).toEqual(['lineNotAllowed'])
    })

    it('ID řádků jsou v projektu jedinečná', () => {
      const p = withLines()
      p.tasks[1]!.lines = [{ ...p.tasks[0]!.lines[3]!, id: 'l1' }]
      expect(issues(p)).toEqual(['duplicateLineId'])
    })

    it('meze hodnot: % 1–100, množství kladné s nejvýš 3 desetinnými místy, částky v haléřích, datum u „k datu“', () => {
      for (const change of [
        (l: Record<string, unknown>[]) => (l[0]!.sharePct = 0),
        (l: Record<string, unknown>[]) => (l[0]!.sharePct = 101),
        (l: Record<string, unknown>[]) => (l[2]!.quantity = 0),
        (l: Record<string, unknown>[]) => (l[2]!.quantity = 1.2345),
        (l: Record<string, unknown>[]) => (l[2]!.unitPriceOverride = 10.5),
        (l: Record<string, unknown>[]) => (l[3]!.amount = -1),
        (l: Record<string, unknown>[]) => delete l[3]!.date,
        (l: Record<string, unknown>[]) => (l[4]!.period = 'year'),
        (l: Record<string, unknown>[]) => (l[4]!.name = ''),
        (l: Record<string, unknown>[]) => (l[0]!.kind = 'neznámý'),
      ]) {
        const p = withLines()
        change(p.tasks[0]!.lines as Record<string, unknown>[])
        expect(ProjectSchema.safeParse(p).success).toBe(false)
      }
    })
  })
})
