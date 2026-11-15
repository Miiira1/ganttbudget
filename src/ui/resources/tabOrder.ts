/**
 * Pořadí podzáložek obrazovky Zdroje, které si uživatel může změnit (tažením nebo Alt+Shift+←/→).
 * Pamatuje si ho prohlížeč (ne projekt). Uložená hodnota se před použitím zkontroluje –
 * podvržená nebo stará data aplikaci nerozbijí. Testy: tabOrder.test.ts.
 */

/** Text z prohlížeče → platné pořadí: jen známé záložky, bez opakování, chybějící na konec. */
export function parseTabOrder<T extends string>(saved: string | null, all: readonly T[]): T[] {
  let parsed: unknown = null
  try {
    parsed = saved === null ? null : JSON.parse(saved)
  } catch {
    parsed = null
  }
  const order: T[] = []
  if (Array.isArray(parsed)) {
    for (const id of parsed) if ((all as readonly unknown[]).includes(id) && !order.includes(id as T)) order.push(id as T)
  }
  for (const id of all) if (!order.includes(id)) order.push(id)
  return order
}

/** Přesune záložku na pozici `index` (v pořadí po přesunu). */
export function moveTab<T extends string>(order: readonly T[], id: T | string, index: number): T[] {
  if (!order.includes(id as T)) return [...order]
  const rest = order.filter((x) => x !== id)
  const at = Math.max(0, Math.min(rest.length, index))
  return [...rest.slice(0, at), id as T, ...rest.slice(at)]
}
