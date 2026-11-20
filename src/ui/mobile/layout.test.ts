import { describe, expect, it } from 'vitest'
import { effectiveLayout, isMobileScreen, MOBILE_SCREEN_QUERY, MOBILE_VIEWS, mobileView } from './layout'

describe('mobilní verze – rozvržení a pohledy', () => {
  it('na úzkém displeji mobilní verze, pokud si uživatel nevybral plnou', () => {
    expect(effectiveLayout(true, 'auto')).toBe('mobile')
    expect(effectiveLayout(true, 'full')).toBe('full')
    expect(effectiveLayout(false, 'auto')).toBe('full')
    expect(effectiveLayout(false, 'full')).toBe('full')
  })

  it('mobilní displej: úzký, nebo nízký a ovládaný prstem – telefon na šířku (audit U6)', () => {
    expect(isMobileScreen({ width: 390, height: 844, coarse: true })).toBe(true) // telefon na výšku
    expect(isMobileScreen({ width: 844, height: 390, coarse: true })).toBe(true) // telefon na šířku
    expect(isMobileScreen({ width: 1024, height: 768, coarse: true })).toBe(false) // tablet na šířku
    expect(isMobileScreen({ width: 1366, height: 480, coarse: false })).toBe(false) // nízké okno s myší
    expect(MOBILE_SCREEN_QUERY).toBe('(max-width: 767px), (max-height: 500px) and (pointer: coarse)')
  })

  it('na telefonu: Plán, Náklady, Sledování, Analýza, Mapa', () => {
    expect(MOBILE_VIEWS).toEqual(['plan', 'costs', 'tracking', 'analysis', 'mindmap'])
  })

  it('pohled, který na telefonu není (Zdroje, Vytížení), se ukáže jako Plán', () => {
    expect(mobileView('resources')).toBe('plan')
    expect(mobileView('load')).toBe('plan')
    expect(mobileView('costs')).toBe('costs')
    expect(mobileView('mindmap')).toBe('mindmap')
  })
})
