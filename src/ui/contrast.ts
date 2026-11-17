/**
 * Kontrast barev podle WCAG 2.1 (U-06, N-13; fáze 13d). ČISTÁ FUNKCE s testy.
 * Text musí mít aspoň 4,5 : 1, grafika (ikony, čáry, rámečky) aspoň 3 : 1.
 */

/** Relativní jas barvy "#rrggbb" (0 = černá, 1 = bílá). */
export function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const channel = (i: number) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

/** Poměr kontrastu dvou barev (1 až 21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** Barvy z CSS ve tvaru „--color-název: #rrggbb;“ → { název: '#rrggbb' }. */
export function colorTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const match of css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[match[1]!] = match[2]!.toLowerCase()
  return tokens
}
