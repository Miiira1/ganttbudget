/**
 * Popisky klíčů dimenzí kontingenční tabulky (fáze 8): názvy z databáze, WBS + název činnosti,
 * text štítku, druh nákladu, období. Klíč NONE = „(neuvedeno)“.
 */
import type { TFunction } from 'i18next'
import type { Facts } from '../../model/facts'
import { NONE, type PivotDim, type PivotPeriod } from '../../model/pivot'
import type { DayRange } from '../../model/periods'
import type { Project } from '../../model/schema'
import { periodLabel } from '../load/loadCells'

export function makeDimLabel(project: Project, facts: Facts, wbs: Map<string, string>, periods: DayRange[], period: PivotPeriod, t: TFunction, lang: string) {
  const name = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? id
  return (dim: PivotDim, key: string): string => {
    if (key === NONE) return t('analysis.none')
    switch (dim) {
      case 'phase':
      case 'task': {
        const task = project.tasks.find((x) => x.id === key)
        return task ? `${wbs.get(key) ?? ''} ${task.name}`.trim() : key
      }
      case 'category':
        return name(project.costCategories, key)
      case 'profession':
        return name(project.professions, key)
      case 'department':
        return name(project.departments, key)
      case 'tag':
        return facts.tagLabels.get(key) ?? key
      case 'kind':
        return t(`table.costParts.${key}`)
      case 'resource': {
        const [type, ...rest] = key.split(':')
        const id = rest.join(':')
        if (type === 'worker') return name(project.workers, id)
        if (type === 'profession') return t('analysis.anyOfProfession', { name: name(project.professions, id) })
        if (type === 'machine') return name(project.machines, id)
        if (type === 'material') return name(project.materials, id)
        return id
      }
      case 'period': {
        const p = periods.find((x) => String(x.startDay) === key)
        if (!p) return key
        const l = periodLabel(p, period, t, lang)
        return `${l.top} ${l.bottom}`
      }
    }
  }
}
