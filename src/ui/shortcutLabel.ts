/**
 * Zápis klávesové zkratky podle systému (audit U23): na Macu se místo Ctrl tiskne ⌘ (Cmd)
 * a místo Shift ⇧ – aplikace obě klávesy přijímá (event.ctrlKey || event.metaKey).
 */

export function isMacPlatform(platform: string): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform)
}

/** Je to Mac? (Odhad z prohlížeče; bez prohlížeče – testy – ne.) */
export const IS_MAC = typeof navigator !== 'undefined' && isMacPlatform(navigator.platform || navigator.userAgent)

/** „Ctrl+Shift+S“ → na Macu „⌘⇧S“, jinde beze změny. */
export function shortcutLabel(shortcut: string, mac = IS_MAC): string {
  if (!mac) return shortcut
  return shortcut.replace(/Ctrl\+/g, '⌘').replace(/Shift\+/g, '⇧')
}
