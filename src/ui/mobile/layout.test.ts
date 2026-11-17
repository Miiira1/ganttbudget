import { describe, expect, it } from 'vitest'
import { effectiveLayout, MOBILE_VIEWS, mobileView } from './layout'

describe('mobilní verze – rozvržení a pohledy', () => {
  it('na úzkém displeji mobilní verze, pokud si uživatel nevybral plnou', () => {
    expect(effectiveLayout(true, 'auto')).toBe('mobile')
    expect(effectiveLayout(true, 'full')).toBe('full')
    expect(effectiveLayout(false, 'auto')).toBe('full')
    expect(effectiveLayout(false, 'full')).toBe('full')
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
