import { describe, expect, it } from 'vitest'
import { isMacPlatform, shortcutLabel } from './shortcutLabel'

describe('zápis klávesové zkratky podle systému (audit U23)', () => {
  it('Windows / Linux: Ctrl beze změny', () => {
    expect(shortcutLabel('Ctrl+Shift+S', false)).toBe('Ctrl+Shift+S')
  })

  it('Mac: ⌘ místo Ctrl', () => {
    expect(shortcutLabel('Ctrl+S', true)).toBe('⌘S')
    expect(shortcutLabel('Ctrl+Shift+S', true)).toBe('⌘⇧S')
    expect(shortcutLabel('Ctrl+Shift+Z', true)).toBe('⌘⇧Z')
    expect(shortcutLabel('F1', true)).toBe('F1')
  })

  it('pozná Mac podle údajů prohlížeče', () => {
    expect(isMacPlatform('MacIntel')).toBe(true)
    expect(isMacPlatform('iPad')).toBe(true)
    expect(isMacPlatform('Win32')).toBe(false)
    expect(isMacPlatform('Linux x86_64')).toBe(false)
  })
})
