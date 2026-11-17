/**
 * Odsazený text (osnova) ↔ myšlenková mapa (fáze 12, MM-03) – ČISTÉ FUNKCE s testy (outline.test.ts).
 *
 * parseOutline: řádky odsazené tabulátory nebo mezerami (jednotka = nejmenší použité odsazení,
 * tabulátor = 4 mezery). Odrážky (-, *, •, +, –), číslování (1., 1.2, 2.1), a)) a nadpisy (#) na začátku
 * řádku se odstraní, prázdné řádky přeskočí. Jediný řádek na nejvyšší úrovni = střední téma; víc takových
 * řádků se zabalí pod `rootText` (název projektu). Přeskočená úroveň (odsazení o víc než jeden stupeň)
 * se srovná na nejbližší možnou. Limity jako u mapy (500 uzlů, 6 úrovní, 200 znaků) – chyba s číslem řádku.
 * Vložený text se nikdy nevkládá jako HTML.
 *
 * mindMapToOutline: střední téma bez odsazení, ostatní uzly „- text“ odsazené dvěma mezerami na úroveň.
 */
import { childrenOf, rootOf } from './mindMap'
import { MAX_MIND_MAP_DEPTH, MAX_MIND_MAP_NODES, MAX_MIND_MAP_TEXT, type MindMap, type MindMapNode } from './schema'

/** Nejvíc neprázdných řádků (= uzlů mapy). */
export const MAX_OUTLINE_LINES = MAX_MIND_MAP_NODES
/** Nejvíc znaků vloženého textu (ochrana před obřím vložením). */
export const MAX_OUTLINE_CHARS = 200_000

export type OutlineErrorCode = 'empty' | 'tooLong' | 'tooDeep' | 'tooMany' | 'tooLarge'
export type OutlineResult = { ok: true; map: MindMap } | { ok: false; errors: { code: OutlineErrorCode; line: number }[] }

const TAB_WIDTH = 4
/** Odrážka, číslování nebo nadpis na začátku řádku. */
const MARKER = /^(?:#{1,6}|[-*•+–·]|\d+(?:\.\d+)*[.)]?|[a-zA-Z][.)])\s+/

export function parseOutline(text: string, rootText: string, newId: () => string): OutlineResult {
  if (text.length > MAX_OUTLINE_CHARS) return { ok: false, errors: [{ code: 'tooLarge', line: 0 }] }

  // 1) Neprázdné řádky: šířka odsazení a čistý text.
  const lines: { line: number; width: number; text: string; bulleted: boolean }[] = []
  text.split(/\r?\n/).forEach((raw, index) => {
    const indent = /^[ \t]*/.exec(raw)![0]
    let content = raw.slice(indent.length).trim()
    // Řádek s odrážkou nebo číslem (ne nadpis „#“) – rozhoduje, zda je první řádek nadpisem nad seznamem.
    const bulleted = MARKER.test(content) && !content.startsWith('#')
    // Odrážku odstranit i opakovaně („- 1. Text“), ale jen pokud po ní něco zbude.
    for (let guard = 0; guard < 3; guard++) {
      const stripped = content.replace(MARKER, '')
      if (stripped === content || stripped.trim() === '') break
      content = stripped.trim()
    }
    // Prázdný řádek nebo samotná odrážka („-“, „*“) se přeskočí.
    if (content === '' || (MARKER.test(`${content} `) && content.length <= 2)) return
    const width = [...indent].reduce((w, ch) => w + (ch === '\t' ? TAB_WIDTH : 1), 0)
    lines.push({ line: index + 1, width, text: content, bulleted })
  })
  if (lines.length === 0) return { ok: false, errors: [{ code: 'empty', line: 0 }] }

  // 2) Úrovně: jednotka = nejmenší nenulový rozdíl odsazení; nejmenší odsazení = úroveň 0.
  const minWidth = Math.min(...lines.map((l) => l.width))
  const deeper = lines.map((l) => l.width - minWidth).filter((w) => w > 0)
  const unit = deeper.length > 0 ? Math.min(...deeper) : 1
  const rawLevels = lines.map((l) => Math.round((l.width - minWidth) / unit))
  // Nadpis bez odrážky nad seznamem se stejným odsazením („Projekt“ a pod ním „- Příprava“) = střední téma.
  const laterTop = lines.slice(1).filter((_, i) => rawLevels[i + 1] === 0)
  if (!lines[0]!.bulleted && rawLevels[0] === 0 && laterTop.length > 0 && laterTop.every((l) => l.bulleted)) {
    for (let i = 1; i < rawLevels.length; i++) rawLevels[i]! += 1
  }
  const topCount = rawLevels.filter((level) => level === 0).length
  const wrap = topCount > 1 || rawLevels[0] !== 0
  const total = lines.length + (wrap ? 1 : 0)
  if (total > MAX_MIND_MAP_NODES) return { ok: false, errors: [{ code: 'tooMany', line: lines[MAX_MIND_MAP_NODES - (wrap ? 1 : 0)]?.line ?? 0 }] }

  // 3) Strom: každá úroveň nejvýš o jednu hlouběji než předchozí řádek.
  const nodes: MindMapNode[] = []
  const counters = new Map<string, number>()
  const stack: string[] = [] // stack[d] = ID posledního uzlu v hloubce d
  const push = (text: string, depth: number) => {
    const id = newId()
    const parentId = depth === 0 ? null : stack[depth - 1]!
    const order = parentId === null ? 0 : (counters.get(parentId) ?? 0)
    if (parentId !== null) counters.set(parentId, order + 1)
    nodes.push({ id, parentId, order, text })
    stack[depth] = id
    stack.length = depth + 1
  }
  if (wrap) push(rootText.trim().slice(0, MAX_MIND_MAP_TEXT) || '…', 0)
  let previous = wrap ? 0 : -1
  for (let i = 0; i < lines.length; i++) {
    const { line, text: content } = lines[i]!
    if (content.length > MAX_MIND_MAP_TEXT) return { ok: false, errors: [{ code: 'tooLong', line }] }
    let depth = rawLevels[i]! + (wrap ? 1 : 0)
    if (!wrap && i === 0) depth = 0
    else depth = Math.max(1, Math.min(depth, previous + 1))
    if (depth > MAX_MIND_MAP_DEPTH) return { ok: false, errors: [{ code: 'tooDeep', line }] }
    push(content, depth)
    previous = depth
  }
  return { ok: true, map: { nodes } }
}

export function mindMapToOutline(map: MindMap): string {
  const out: string[] = []
  const walk = (node: MindMapNode, depth: number) => {
    out.push(depth === 0 ? node.text : `${'  '.repeat(depth)}- ${node.text}`)
    for (const child of childrenOf(map, node.id)) walk(child, depth + 1)
  }
  walk(rootOf(map), 0)
  return out.join('\n') + '\n'
}
