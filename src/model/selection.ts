/**
 * Výběr více řádků (Ctrl / Shift) – čisté pomocné funkce, testy v selection.test.ts.
 * Které řádky výběr opravdu obsahuje (bez podřízených vybrané fáze) řeší selectionRoots v hierarchy.ts.
 */

/** Shift+klik: řádky od kotvy (posledního kliknutého) po kliknutý, v pořadí, jak jsou vidět. */
export function rangeIds(rows: readonly { id: string }[], anchorId: string | null, targetId: string): string[] {
  const from = rows.findIndex((r) => r.id === anchorId)
  const to = rows.findIndex((r) => r.id === targetId)
  if (from < 0 || to < 0) return [targetId]
  const [start, end] = from <= to ? [from, to] : [to, from]
  return rows.slice(start, end + 1).map((r) => r.id)
}

/** Ctrl+klik: přidá řádek do výběru, nebo ho z něj odebere. */
export function toggleId(ids: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(ids)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}
