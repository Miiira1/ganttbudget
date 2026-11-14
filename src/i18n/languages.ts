/**
 * Seznam jazyků aplikace.
 * PŘIDÁNÍ JAZYKA: zkopírujte locales/en.json pod novým názvem (např. de.json),
 * přeložte texty a přidejte jeden řádek do pole LANGUAGES níže.
 */
import cs from './locales/cs.json'
import en from './locales/en.json'

/** Každý překladový soubor musí mít část "meta" s názvem jazyka a národním prostředím. */
export type Translation = { meta: { languageName: string; locale: string } } & Record<string, unknown>

export interface LanguageDefinition {
  code: string
  translation: Translation
}

export const LANGUAGES: LanguageDefinition[] = [
  { code: 'cs', translation: cs },
  { code: 'en', translation: en },
]

export const DEFAULT_LANGUAGE = 'cs'

/** Kód národního prostředí pro formát data a čísel (např. "cs-CZ"). */
export function localeFor(languageCode: string): string {
  return LANGUAGES.find((l) => l.code === languageCode)?.translation.meta.locale ?? languageCode
}
