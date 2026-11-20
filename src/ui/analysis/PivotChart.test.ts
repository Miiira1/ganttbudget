import { describe, expect, it } from 'vitest'
import { frameFor } from './PivotChart'

describe('velikost čárového a skládaného grafu (přeblikávání při necelých rozměrech plochy)', () => {
  it('graf nikdy nepřesáhne plochu – ani o zlomek pixelu', () => {
    const columns = ['3. Q 2026', '4. Q 2026', '1. Q 2027', '2. Q 2027']
    // Plocha od nízké po vysokou, po desetinách pixelu (zvětšení stránky dává necelé rozměry).
    for (let height = 91; height <= 400; height += 0.1) {
      for (const width of [300.4, 393.7, 604.5]) {
        const frame = frameFor(columns, 500_000, { width, height })
        expect(frame.height).toBeLessThanOrEqual(height)
        expect(frame.width).toBeLessThanOrEqual(width)
      }
    }
  })

  it('na vysoké ploše výška narazí na strop (graf se nenatahuje donekonečna)', () => {
    expect(frameFor(['a'], 10, { width: 800, height: 1000 }).height).toBe(8 + 320 + 22)
  })
})
