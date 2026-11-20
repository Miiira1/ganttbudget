import { describe, expect, it } from 'vitest'
import { issueWhere } from './issueWhere'

describe('kde v souboru je chyba – lidsky, ne technická cesta (audit U2, N-09)', () => {
  it('položka seznamu: číslo od 1 (ne od 0)', () => {
    expect(issueWhere('tasks.3.durationDays')).toEqual({ key: 'task', number: 4 })
    expect(issueWhere('workers.0.name')).toEqual({ key: 'worker', number: 1 })
    expect(issueWhere('professions.12')).toEqual({ key: 'profession', number: 13 })
    expect(issueWhere('machines.1.rate')).toEqual({ key: 'machine', number: 2 })
    expect(issueWhere('materials.5.unitPrice')).toEqual({ key: 'material', number: 6 })
    expect(issueWhere('costCategories.2.name')).toEqual({ key: 'category', number: 3 })
    expect(issueWhere('departments.0.name')).toEqual({ key: 'department', number: 1 })
    expect(issueWhere('baselines.1.tasks.4.start')).toEqual({ key: 'baseline', number: 2 })
    expect(issueWhere('views.0.name')).toEqual({ key: 'view', number: 1 })
  })

  it('části projektu bez čísla', () => {
    expect(issueWhere('calendar.customHolidays.0.start')).toEqual({ key: 'calendar', number: null })
    expect(issueWhere('budget.categoryLimits.0.categoryId')).toEqual({ key: 'budget', number: null })
    expect(issueWhere('mindMap.nodes.3.text')).toEqual({ key: 'mindMap', number: null })
  })

  it('cokoli jiného (název, měna, datum začátku…) = nastavení projektu', () => {
    expect(issueWhere('startDate')).toEqual({ key: 'project', number: null })
    expect(issueWhere('')).toEqual({ key: 'project', number: null })
    expect(issueWhere('__proto__.x')).toEqual({ key: 'project', number: null })
  })
})
