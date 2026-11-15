/**
 * Výchozí kategorie nákladů (R-03) pro nový projekt a pro převod starších souborů.
 * Názvy jsou v jazyce projektu (z překladových souborů); neznámý jazyk → anglicky.
 * ID jsou pevná („cat-material“…), aby šly odkazovat ze vzorových dat a testů.
 */
import cs from '../i18n/locales/cs.json'
import en from '../i18n/locales/en.json'

export const DEFAULT_CATEGORY_KEYS = ['material', 'labor', 'services', 'investment', 'overhead', 'reserve'] as const
export type DefaultCategoryKey = (typeof DEFAULT_CATEGORY_KEYS)[number]

const NAMES: Record<string, Record<DefaultCategoryKey, string>> = {
  cs: cs.resources.defaultCategories,
  en: en.resources.defaultCategories,
}

export const defaultCategoryId = (key: DefaultCategoryKey) => `cat-${key}`

export function createDefaultCategories(language: string): { id: string; name: string }[] {
  const names = NAMES[language] ?? NAMES.en!
  return DEFAULT_CATEGORY_KEYS.map((key) => ({ id: defaultCategoryId(key), name: names[key] }))
}
