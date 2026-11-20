import { describe, expect, it } from 'vitest'
import { currencyLabel, currencyVariants, formatHours, formatPercent } from './format'

/** Mezery z Intl jsou nezlomitelné – pro porovnání je nahradíme obyčejnými. */
const plain = (text: string) => text.replace(/[  ]/g, ' ')

describe('procenta a hodiny podle jazyka (audit U14)', () => {
  it('procenta: česky s mezerou, anglicky bez', () => {
    expect(plain(formatPercent(50, 'cs'))).toBe('50 %')
    expect(formatPercent(50, 'en')).toBe('50%')
    expect(plain(formatPercent(12.5, 'cs', 1))).toBe('12,5 %')
    expect(formatPercent(250, 'en')).toBe('250%')
  })

  it('hodiny: desetinná čárka / tečka podle jazyka, jednotka h', () => {
    expect(plain(formatHours(7.5, 'cs'))).toBe('7,5 h')
    expect(plain(formatHours(7.5, 'en'))).toBe('7.5 h')
    expect(plain(formatHours(1200, 'cs'))).toBe('1 200 h')
  })
})

describe('měna v hlavičkách exportu (audit U3)', () => {
  it('koruny jako „Kč“, ostatní kódem', () => {
    expect(currencyLabel('CZK')).toBe('Kč')
    expect(currencyLabel('EUR')).toBe('EUR')
  })

  it('pro import se rozpoznají všechny podoby hlavičky, i starší „Kč“', () => {
    const variants = currencyVariants('Částka {{currency}}')
    for (const v of ['Částka Kč', 'Částka CZK', 'Částka EUR', 'Částka USD', 'Částka PLN']) expect(variants).toContain(v)
    expect(currencyVariants('Název')).toEqual(['Název'])
  })
})
