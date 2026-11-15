/**
 * Překlad podle českého souboru pro testy (klíč „a.b.c“ → text), aby vzorový projekt
 * v testech vypadal stejně jako v aplikaci (např. jednotka „ks“, ne dlouhý klíč).
 * V aplikaci se nepoužívá.
 */
import cs from '../i18n/locales/cs.json'

export function translateCs(key: string): string {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], cs)
  if (typeof value !== 'string') throw new Error(`Chybí překlad ${key}`)
  return value
}
