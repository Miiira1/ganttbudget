import { describe, expect, it } from 'vitest'
import { allTags, normalizeTags } from './tags'
import { createEmptyProject, createTask, MAX_LINE_TAGS, ProjectSchema, type Project, type TaskLine } from './schema'

describe('úprava štítků řádku (fáze 7, R-03)', () => {
  it('ořízne mezery, vyhodí prázdné a duplicitní (bez ohledu na velikost písmen), zachová pořadí', () => {
    expect(normalizeTags(['  dotace ', '', 'Etapa 1', 'DOTACE', 'etapa 1 ', 'IT'])).toEqual(['dotace', 'Etapa 1', 'IT'])
  })

  it('štítek nejvýš 30 znaků, nejvýš 10 štítků', () => {
    expect(normalizeTags(['x'.repeat(40)])).toEqual(['x'.repeat(30)])
    const many = Array.from({ length: 15 }, (_, i) => `t${i}`)
    expect(normalizeTags(many)).toHaveLength(MAX_LINE_TAGS)
  })
})

function projectWith(lines: TaskLine[][]): Project {
  const p = createEmptyProject({ name: 'T', language: 'cs', startDate: '2026-11-16' })
  p.tasks = lines.map((l, i) => ({ ...createTask({ id: `t${i}`, name: `T${i}`, order: i }), lines: l }))
  return p
}
const oneTime = (id: string, tags?: string[]): TaskLine => ({
  id,
  kind: 'oneTime',
  categoryId: 'cat-services',
  name: 'Položka',
  amount: 100,
  timing: 'start',
  ...(tags ? { tags } : {}),
})

describe('štítky v projektu', () => {
  it('všechny použité štítky seřazené podle abecedy, bez opakování', () => {
    const p = projectWith([[oneTime('a', ['dotace', 'IT'])], [oneTime('b', ['Etapa 1', 'it']), oneTime('c')]])
    expect(allTags(p)).toEqual(['dotace', 'Etapa 1', 'IT'])
  })

  it('schéma: štítky jsou nepovinné; prázdný, dlouhý, duplicitní nebo 11. štítek neprojde', () => {
    expect(ProjectSchema.safeParse(projectWith([[oneTime('a', ['dotace'])]])).success).toBe(true)
    expect(ProjectSchema.safeParse(projectWith([[oneTime('a')]])).success).toBe(true)
    for (const bad of [[''], ['x'.repeat(31)], ['a', 'A'], Array.from({ length: 11 }, (_, i) => `t${i}`)]) {
      expect(ProjectSchema.safeParse(projectWith([[oneTime('a', bad)]])).success).toBe(false)
    }
  })
})
