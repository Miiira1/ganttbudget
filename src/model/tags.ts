/**
 * Volné štítky řádků (fáze 7, R-03) – čisté funkce, testy v tags.test.ts.
 * Štítek je krátký text („dotace“, „etapa 1“); velikost písmen se při porovnání nerozlišuje.
 */
import { MAX_LINE_TAGS, MAX_TAG_LENGTH, nameKey, type Project } from './schema'

/** Upraví zadané štítky: ořízne, zkrátí na 30 znaků, vyhodí prázdné a opakované, nejvýš 10. */
export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of raw) {
    const tag = value.trim().slice(0, MAX_TAG_LENGTH).trim()
    if (tag === '' || seen.has(nameKey(tag))) continue
    seen.add(nameKey(tag))
    result.push(tag)
    if (result.length === MAX_LINE_TAGS) break
  }
  return result
}

/** Všechny štítky použité v projektu (pro nápovědu), seřazené podle abecedy, bez opakování. */
export function allTags(project: Project): string[] {
  const byKey = new Map<string, string>()
  for (const task of project.tasks) for (const line of task.lines) for (const tag of line.tags ?? []) if (!byKey.has(nameKey(tag))) byKey.set(nameKey(tag), tag)
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'cs', { sensitivity: 'base' }))
}
