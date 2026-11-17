import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '../../i18n/languages'
import { EV_TERMS, GLOSSARY_TERMS } from './glossary'

/** Hodnota překladu podle klíče "a.b.c" (nebo undefined). */
const lookup = (translation: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], translation)

describe('slovníček pojmů', () => {
  it('pojmy se neopakují', () => {
    expect(new Set(GLOSSARY_TERMS).size).toBe(GLOSSARY_TERMS.length)
  })

  it.each(LANGUAGES)('v jazyce $code má každý pojem název a vysvětlení', (language) => {
    for (const term of GLOSSARY_TERMS) {
      expect(lookup(language.translation, `glossary.terms.${term}.name`), term).toEqual(expect.any(String))
      expect(lookup(language.translation, `glossary.terms.${term}.text`), term).toEqual(expect.any(String))
    }
    for (const term of EV_TERMS) {
      for (const part of ['name', 'text', 'formula']) expect(lookup(language.translation, `tracking.terms.${term}.${part}`), term).toEqual(expect.any(String))
    }
  })

  it('slovníček v překladech nemá pojmy navíc (zapomenuté po přejmenování)', () => {
    const terms = Object.keys(lookup(LANGUAGES[0]!.translation, 'glossary.terms') as object)
    expect(terms.sort()).toEqual([...GLOSSARY_TERMS].sort())
  })
})
