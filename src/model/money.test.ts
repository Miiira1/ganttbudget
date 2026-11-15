import { describe, expect, it } from 'vitest'
import { formatAmount, formatMoney, parseMoney } from './money'

/** Mezery v číslech z Intl jsou nezlomitelné – pro porovnání je nahradíme obyčejnými. */
const plain = (text: string) => text.replace(/[  ]/g, ' ')

describe('peníze: haléře → text', () => {
  it('česky s mezerami mezi tisíci, čárkou a značkou měny', () => {
    expect(plain(formatMoney(123_450, 'CZK', 'cs'))).toBe('1 234,50 Kč')
    expect(plain(formatMoney(0, 'CZK', 'cs'))).toBe('0,00 Kč')
  })

  it('anglicky a v jiné měně', () => {
    expect(plain(formatMoney(123_450, 'EUR', 'en'))).toBe('€1,234.50')
  })

  it('bez značky měny (pro pole k úpravě) – a jde přečíst zpátky', () => {
    expect(plain(formatAmount(123_450, 'cs'))).toBe('1 234,50')
    expect(plain(formatAmount(123_450, 'en'))).toBe('1,234.50')
    for (const lang of ['cs', 'en']) expect(parseMoney(formatAmount(98_765_432, lang))).toBe(98_765_432)
  })
})

describe('peníze: zadaný text → haléře (celé číslo, nikdy float)', () => {
  it('celé částky a desetinná čárka i tečka', () => {
    expect(parseMoney('1234')).toBe(123_400)
    expect(parseMoney('1234,5')).toBe(123_450)
    expect(parseMoney('1234.56')).toBe(123_456)
    expect(parseMoney('0,1')).toBe(10)
  })

  it('oddělovače tisíců (mezera, nezlomitelná mezera, tečka, čárka) a značka měny', () => {
    expect(parseMoney('1 234,50 Kč')).toBe(123_450)
    expect(parseMoney('1 234,50')).toBe(123_450)
    expect(parseMoney('1.234.567,89')).toBe(123_456_789)
    expect(parseMoney('1,234,567.89')).toBe(123_456_789)
    expect(parseMoney('€1,234.50')).toBe(123_450)
    expect(parseMoney('1,234')).toBe(123_400) // tři číslice za jediným oddělovačem = tisíce
  })

  it('přesnost: žádné chyby zaokrouhlení', () => {
    expect(parseMoney('0,29')).toBe(29)
    expect(parseMoney('1,15')).toBe(115)
    expect(parseMoney('9999999,99')).toBe(999_999_999)
  })

  it('nesmysly, záporné a víc než 2 desetinná místa → null', () => {
    for (const bad of ['', '   ', 'abc', '-5', '1,234,5', '1,2,3', '12,345.6.7', '1e5', '0,125']) {
      expect(parseMoney(bad), bad).toBeNull()
    }
  })

  it('příliš velká částka → null', () => {
    expect(parseMoney('100000000000')).toBeNull() // víc než 10 miliard
  })
})
