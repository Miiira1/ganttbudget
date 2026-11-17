/**
 * Pohled „Mapa“ – myšlenková mapa (fáze 12, MM-01).
 *
 * Kreslí se jako SVG podle rozložení z model/mindMapLayout.ts; úpravy dělá model/mindMap.ts
 * a ukládají se do projektu přes setMindMap (každá úprava = jeden krok Zpět).
 * Projekt bez mapy ukáže výchozí mapu se středním tématem = název projektu; uloží se až první úpravou.
 *
 * Ovládání:
 *  - klávesnice (fokus na mapě): Tab = podřízený, Enter = sourozenec, F2 nebo psaní = přejmenovat,
 *    Delete = smazat, šipky = pohyb, mezerník = sbalit / rozbalit, Esc = zrušit přejmenování,
 *  - myš: klik = výběr, dvojklik = přejmenovat, kolečko = přiblížit, tažení pozadí = posun,
 *  - tlačítka v liště pro všechny akce (i dotyk).
 * Přístupnost: strom (role tree / treeitem, aria-level, aria-expanded), vybraný uzel přes
 * aria-activedescendant; text uzlů je vždy jen text (žádné HTML).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { addChild, addSibling, childrenOf, createMindMap, moveNode, nodeOf, removeNode, renameNode, rootOf, subtreeIds, toggleCollapsed, type MapResult } from '../../model/mindMap'
import { dropTarget, layoutMindMap, MIND_MAP_METRICS, navigate, type DropTarget, type LaidOutNode, type MindMapDirection } from '../../model/mindMapLayout'
import type { MindMap } from '../../model/schema'
import { useProject } from '../../store/useProject'
import { HelpTip } from '../help/HelpTip'
import { showNotice } from '../notice'
import { useElementSize } from '../useElementSize'
import { PlanFromMapDialog } from './PlanFromMapDialog'
import { OutlineDialog } from './OutlineDialog'
import { mindMapToOutline } from '../../model/outline'

/** Barvy hlavních větví (odstíny značky s kontrastem ≥ 3 : 1 ve světlém i tmavém vzhledu). */
const BRANCH_STROKES = ['stroke-[#0e7490] dark:stroke-[#3bdaff]', 'stroke-[#b38600] dark:stroke-[#d9a400]', 'stroke-[#4a4a47] dark:stroke-[#b2b1ab]']
const branchStroke = (branch: number) => BRANCH_STROKES[((branch % BRANCH_STROKES.length) + BRANCH_STROKES.length) % BRANCH_STROKES.length]!

const MIN_SCALE = 0.3
const MAX_SCALE = 2.5
const PADDING = 40
/** O kolik bodů se musí myš posunout, než stisknutí uzlu začne tažení. */
const DRAG_THRESHOLD = 5

type View = { cx: number; cy: number; scale: number }

/** `onShowPlan` přepne na pohled Plán (po vytvoření plánu z mapy). */
export function MindMapView({ onShowPlan }: { onShowPlan: () => void }) {
  const { t } = useTranslation()
  const [planOpen, setPlanOpen] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const project = useProject((s) => s.project)
  const setMindMap = useProject((s) => s.setMindMap)
  // Bez uložené mapy výchozí mapa se středním tématem = název projektu (uloží se první úpravou).
  const map: MindMap = useMemo(() => project.mindMap ?? createMindMap(project.name, () => 'mm-root'), [project.mindMap, project.name])
  const layout = useMemo(() => layoutMindMap(map), [map])
  const treeId = useId()
  const nodeDomId = (id: string) => `${treeId}-${id}`

  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const svgRef = useRef<SVGSVGElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string>(() => rootOf(map).id)
  const [editing, setEditing] = useState<{ id: string; draft: string; selectAll: boolean } | null>(null)
  const [view, setView] = useState<View>({ cx: 0, cy: 0, scale: 1 })
  const pan = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)
  /** Stisknutí na uzlu (tažení ještě nezačalo). */
  const nodeDrag = useRef<{ id: string; startX: number; startY: number; pointerId: number } | null>(null)
  /** Probíhající tažení: poloha v souřadnicích mapy a cíl puštění. */
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; target: DropTarget | null } | null>(null)

  // Vybraný uzel mohl zmizet (Zpět, smazání, sbalení předka) – pak vybrat střední téma.
  const selected = layout.byId.get(selectedId) ?? layout.byId.get(rootOf(map).id)!
  useEffect(() => {
    if (!layout.byId.has(selectedId)) setSelectedId(rootOf(map).id)
  }, [layout, map, selectedId])

  // --- Zobrazení: viewBox podle středu a měřítka ---
  const vbW = size.width / view.scale
  const vbH = size.height / view.scale
  const vbX = view.cx - vbW / 2
  const vbY = view.cy - vbH / 2

  /** Vejde se celá mapa (nejvýš měřítko 1). */
  const fit = useCallback(() => {
    if (size.width === 0) return
    const b = layout.bounds
    const scale = Math.max(MIN_SCALE, Math.min(1, (size.width - 2 * PADDING) / (b.maxX - b.minX), (size.height - 2 * PADDING) / (b.maxY - b.minY)))
    setView({ cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, scale })
  }, [layout, size.width, size.height])

  // Po prvním změření velikosti mapu vycentrovat.
  const fitted = useRef(false)
  useEffect(() => {
    if (!fitted.current && size.width > 0) {
      fitted.current = true
      fit()
    }
  }, [fit, size.width])

  /** Posunout zobrazení, aby byl uzel celý vidět. */
  const reveal = useCallback(
    (node: LaidOutNode) => {
      setView((v) => {
        const w = size.width / v.scale
        const h = size.height / v.scale
        const left = v.cx - w / 2
        const top = v.cy - h / 2
        const m = 20 / v.scale
        let { cx, cy } = v
        if (node.x < left + m) cx -= left + m - node.x
        else if (node.x + node.width > left + w - m) cx += node.x + node.width - (left + w - m)
        if (node.y < top + m) cy -= top + m - node.y
        else if (node.y + node.height > top + h - m) cy += node.y + node.height - (top + h - m)
        return cx === v.cx && cy === v.cy ? v : { ...v, cx, cy }
      })
    },
    [size.width, size.height],
  )
  useEffect(() => reveal(selected), [selected, reveal])

  // --- Úpravy ---
  const newId = () => crypto.randomUUID()

  /** Mapa jako odsazený text do schránky (MM-03) – např. do Wordu nebo pro AI. */
  async function copyOutline() {
    try {
      await navigator.clipboard.writeText(mindMapToOutline(map))
      showNotice(t('mindMap.outline.copied'), 'info')
    } catch {
      showNotice(t('mindMap.outline.copyFailed'))
    }
  }

  /** Zapíše výsledek úpravy (jeden krok Zpět), nebo ukáže, proč nejde. */
  function apply(result: MapResult): string | null {
    if (!result.ok) {
      showNotice(t(`mindMap.errors.${result.reason}`))
      return null
    }
    setMindMap(result.map)
    return result.id ?? null
  }

  function startEdit(id: string, draft?: string) {
    const node = nodeOf(map, id)
    if (!node) return
    setEditing({ id, draft: draft ?? node.text, selectAll: draft === undefined })
  }

  /** Nový uzel s výchozím textem a hned přejmenování. */
  function add(kind: 'child' | 'sibling') {
    const root = selected.side === 'root'
    const result = kind === 'child' || root ? addChild(map, selected.id, t('mindMap.newNode'), newId) : addSibling(map, selected.id, t('mindMap.newNode'), newId)
    const id = apply(result)
    if (id) {
      setSelectedId(id)
      setEditing({ id, draft: t('mindMap.newNode'), selectAll: true })
    }
  }

  function remove() {
    const descendants = subtreeIds(map, selected.id).size - 1
    if (selected.side === 'root') return void showNotice(t('mindMap.errors.root'))
    if (descendants > 0 && !window.confirm(t('mindMap.confirmDelete', { name: selected.text, count: descendants }))) return
    const result = removeNode(map, selected.id)
    if (!result.ok) return void showNotice(t(`mindMap.errors.${result.reason}`))
    setMindMap(result.map)
    setSelectedId(selected.parentId ?? rootOf(map).id)
  }

  function toggle() {
    if (selected.childCount > 0) apply(toggleCollapsed(map, selected.id))
  }

  function commitEdit() {
    if (!editing) return
    const node = nodeOf(map, editing.id)
    setEditing(null)
    if (!node || editing.draft.trim() === node.text) return
    apply(renameNode(map, editing.id, editing.draft))
    containerRef.current?.focus()
  }

  function cancelEdit() {
    setEditing(null)
    containerRef.current?.focus()
  }

  useEffect(() => {
    if (!editing) return
    const input = inputRef.current
    if (!input) return
    input.focus()
    if (editing.selectAll) input.select()
    else input.setSelectionRange(input.value.length, input.value.length)
    // Jen při začátku přejmenování (ne při každém napsaném znaku).
  }, [editing?.id, editing?.selectAll])

  // --- Klávesnice ---
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Esc během tažení: tažení zrušit, nic se nepřesune.
    if (event.key === 'Escape' && drag) {
      event.preventDefault()
      cancelDrag()
      return
    }
    if (editing) return
    // Alt+Shift+↑/↓ = posunout uzel mezi sourozenci (stejně jako řádky v plánu).
    if (event.altKey && event.shiftKey && !event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      if (selected.parentId === null) return
      const siblings = childrenOf(map, selected.parentId).map((n) => n.id)
      const index = siblings.indexOf(selected.id) + (event.key === 'ArrowUp' ? -1 : 1)
      if (index >= 0 && index < siblings.length) apply(moveNode(map, selected.id, selected.parentId, index))
      return
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const arrows: Record<string, MindMapDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
    let handled = true
    if (arrows[event.key]) {
      const next = navigate(layout, selected.id, arrows[event.key]!)
      if (next) setSelectedId(next)
    } else if (event.key === 'Tab' && !event.shiftKey) add('child')
    else if (event.key === 'Enter') add('sibling')
    else if (event.key === 'F2') startEdit(selected.id)
    else if (event.key === 'Delete' || event.key === 'Backspace') remove()
    else if (event.key === ' ') toggle()
    else if (event.key === 'Home') setSelectedId(rootOf(map).id)
    else if (event.key.length === 1) startEdit(selected.id, event.key)
    else handled = false
    if (handled) event.preventDefault()
  }

  // --- Myš: tažení uzlu (přesun), posun pozadí a přiblížení kolečkem ---
  /** Bod obrazovky → souřadnice mapy. */
  function toMap(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: vbX + (clientX - rect.left) / view.scale, y: vbY + (clientY - rect.top) / view.scale }
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    const nodeElement = (event.target as Element).closest('[data-node-id]')
    if (nodeElement) {
      // Uzel: vybrat; tažení začne až po posunu o pár bodů (jinak je to obyčejný klik).
      const id = nodeElement.getAttribute('data-node-id')!
      setSelectedId(id)
      containerRef.current?.focus()
      if (layout.byId.get(id)?.side !== 'root') nodeDrag.current = { id, startX: event.clientX, startY: event.clientY, pointerId: event.pointerId }
      return
    }
    pan.current = { x: event.clientX, y: event.clientY, cx: view.cx, cy: view.cy }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const start = nodeDrag.current
    if (start) {
      if (!drag && Math.hypot(event.clientX - start.startX, event.clientY - start.startY) < DRAG_THRESHOLD) return
      if (!drag) event.currentTarget.setPointerCapture(start.pointerId)
      const point = toMap(event.clientX, event.clientY)
      setDrag({ id: start.id, ...point, target: dropTarget(map, layout, start.id, point.x, point.y) })
      return
    }
    const p = pan.current
    if (!p) return
    setView((v) => ({ ...v, cx: p.cx - (event.clientX - p.x) / v.scale, cy: p.cy - (event.clientY - p.y) / v.scale }))
  }
  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    if (drag?.target) {
      // Puštění na cíl = přesun (jeden krok Zpět); mimo uzly se nic nestane.
      apply(moveNode(map, drag.id, drag.target.parentId, drag.target.index))
    }
    nodeDrag.current = null
    setDrag(null)
    pan.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function cancelDrag() {
    nodeDrag.current = null
    setDrag(null)
  }
  function zoomAt(factor: number, clientX?: number, clientY?: number) {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect || clientX === undefined || clientY === undefined) return { ...v, scale }
      // Bod pod kurzorem zůstane na místě.
      const px = v.cx + (clientX - rect.left - rect.width / 2) / v.scale
      const py = v.cy + (clientY - rect.top - rect.height / 2) / v.scale
      return { scale, cx: px - (px - v.cx) * (v.scale / scale), cy: py - (py - v.cy) * (v.scale / scale) }
    })
  }
  function onWheel(event: WheelEvent<SVGSVGElement>) {
    zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX, event.clientY)
  }

  // Kolečko nad mapou nemá posouvat stránku (React posluchač kolečka je pasivní).
  const hasSvg = size.width > 0
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const prevent = (e: globalThis.WheelEvent) => e.preventDefault()
    svg.addEventListener('wheel', prevent, { passive: false })
    return () => svg.removeEventListener('wheel', prevent)
  }, [hasSvg])

  // --- Kreslení ---
  const M = MIND_MAP_METRICS
  const dragged = useMemo(() => (drag ? subtreeIds(map, drag.id) : new Set<string>()), [drag, map])
  const editingNode = editing ? layout.byId.get(editing.id) : undefined
  const toScreen = (x: number, y: number) => ({ left: (x - vbX) * view.scale, top: (y - vbY) * view.scale })
  const status = t('mindMap.selected', {
    name: selected.text,
    level: selected.depth,
    count: selected.childCount,
  })

  const button = 'btn-secondary'
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="toolbar" aria-label={t('mindMap.toolbar')} className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <button type="button" className={button} onClick={() => add('child')} title={t('mindMap.addChildHint')}>
          <span aria-hidden="true">＋</span> {t('mindMap.addChild')}
        </button>
        <button type="button" className={button} onClick={() => add('sibling')} disabled={selected.side === 'root'} title={t('mindMap.addSiblingHint')}>
          {t('mindMap.addSibling')}
        </button>
        <button type="button" className={button} onClick={() => startEdit(selected.id)} title={t('mindMap.renameHint')}>
          {t('mindMap.rename')}
        </button>
        <button type="button" className={button} onClick={remove} disabled={selected.side === 'root'} title={t('mindMap.deleteHint')}>
          {t('mindMap.delete')}
        </button>
        <button type="button" className={button} onClick={toggle} disabled={selected.childCount === 0} title={t('mindMap.toggleHint')}>
          {selected.collapsed ? t('mindMap.expand') : t('mindMap.collapse')}
        </button>
        <button type="button" className="btn-primary" onClick={() => setPlanOpen(true)} title={t('mindMap.plan.buttonHint')}>
          {t('mindMap.plan.button')}
        </button>
        <PlanFromMapDialog open={planOpen} map={map} onClose={() => setPlanOpen(false)} onDone={onShowPlan} />
        <button type="button" className={button} onClick={() => setOutlineOpen(true)} title={t('mindMap.outline.buttonHint')}>
          {t('mindMap.outline.button')}
        </button>
        <button type="button" className={button} onClick={() => void copyOutline()} title={t('mindMap.outline.copyHint')}>
          {t('mindMap.outline.copy')}
        </button>
        <OutlineDialog
          open={outlineOpen}
          currentNodes={map.nodes.length}
          onClose={() => setOutlineOpen(false)}
          onReplaced={() => {
            // Nová mapa: znovu vycentrovat (vybraný uzel se sám vrátí na střední téma).
            fitted.current = false
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className={button} onClick={() => zoomAt(1 / 1.2)} aria-label={t('mindMap.zoomOut')} title={t('mindMap.zoomOut')}>
            <span aria-hidden="true">−</span>
          </button>
          <button type="button" className={button} onClick={() => zoomAt(1.2)} aria-label={t('mindMap.zoomIn')} title={t('mindMap.zoomIn')}>
            <span aria-hidden="true">＋</span>
          </button>
          <button type="button" className={button} onClick={fit} title={t('mindMap.fitHint')}>
            {t('mindMap.fit')}
          </button>
          <HelpTip term="mindMap" />
        </div>
      </div>
      <p className="border-b border-slate-200 px-4 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">{t('mindMap.keysHint')}</p>

      <div
        ref={containerRef}
        role="tree"
        tabIndex={0}
        aria-label={t('mindMap.label')}
        aria-activedescendant={nodeDomId(selected.id)}
        onKeyDown={onKeyDown}
        className="relative min-h-0 flex-1 overflow-hidden bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus dark:bg-slate-950"
      >
        {size.width > 0 && (
          <svg
            ref={svgRef}
            // Pro čtečky „průhledné“: položky stromu (uzly) patří přímo do stromu na obalu (13d – přístupnost).
            role="none"
            width={size.width}
            height={size.height}
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            className="block cursor-grab touch-none select-none active:cursor-grabbing"
          >
            {layout.edges.map((e) => {
              const mx = (e.x1 + e.x2) / 2
              const depth = layout.byId.get(e.toId)?.depth ?? 2
              return (
                <path
                  key={e.toId}
                  d={`M${e.x1} ${e.y1}C${mx} ${e.y1} ${mx} ${e.y2} ${e.x2} ${e.y2}`}
                  fill="none"
                  strokeWidth={depth === 1 ? 2.5 : 1.5}
                  strokeLinecap="round"
                  className={branchStroke(e.branch)}
                  aria-hidden="true"
                />
              )
            })}
            {layout.nodes.map((n) => {
              const isRoot = n.side === 'root'
              const isSelected = n.id === selected.id
              const lineHeight = isRoot ? M.rootLineHeight : M.lineHeight
              return (
                <g
                  key={n.id}
                  id={nodeDomId(n.id)}
                  data-node-id={n.id}
                  role="treeitem"
                  aria-level={n.depth + 1}
                  aria-selected={isSelected}
                  aria-expanded={n.childCount > 0 ? !n.collapsed : undefined}
                  aria-label={n.text}
                  onDoubleClick={() => startEdit(n.id)}
                  // Tažená větev je během tažení poloprůhledná.
                  className={`cursor-pointer ${dragged.has(n.id) ? 'opacity-35' : ''}`}
                >
                  {isSelected && (
                    <rect x={n.x - 4} y={n.y - 4} width={n.width + 8} height={n.height + 8} rx={12} fill="none" strokeWidth={2.5} className="stroke-[#0e7490] dark:stroke-[#3bdaff]" />
                  )}
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                    rx={isRoot ? 10 : 8}
                    strokeWidth={isRoot ? 0 : n.depth === 1 ? 2 : 1.2}
                    className={isRoot ? 'fill-miro-graphite dark:fill-miro-paper' : `fill-white dark:fill-slate-800 ${branchStroke(n.branch)}`}
                  />
                  <text
                    x={n.x + n.width / 2}
                    y={n.y + M.padY + lineHeight * 0.75}
                    textAnchor="middle"
                    className={isRoot ? 'fill-miro-paper text-base font-semibold dark:fill-miro-graphite' : `fill-slate-900 text-sm dark:fill-slate-100 ${n.depth === 1 ? 'font-semibold' : ''}`}
                  >
                    {n.lines.map((line, i) => (
                      <tspan key={i} x={n.x + n.width / 2} dy={i === 0 ? 0 : lineHeight}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                  {n.collapsed && (
                    // Sbalená větev: kolečko s počtem skrytých podřízených na vnějším okraji.
                    <g
                      onClick={(e) => {
                        e.stopPropagation()
                        apply(toggleCollapsed(map, n.id))
                      }}
                    >
                      <circle cx={n.side === 'left' ? n.x - 12 : n.x + n.width + 12} cy={n.y + n.height / 2} r={10} strokeWidth={1.5} className={`fill-white dark:fill-slate-800 ${branchStroke(n.branch)}`} />
                      <text x={n.side === 'left' ? n.x - 12 : n.x + n.width + 12} y={n.y + n.height / 2 + 4} textAnchor="middle" className="fill-slate-900 text-[10px] font-semibold dark:fill-slate-100">
                        +{childrenOf(map, n.id).length}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
            {drag && <DragPreview drag={drag} layout={layout} />}
          </svg>
        )}

        {editing && editingNode && (
          <input
            ref={inputRef}
            type="text"
            value={editing.draft}
            maxLength={250}
            aria-label={t('mindMap.renameLabel')}
            onChange={(e) => setEditing({ ...editing, draft: e.target.value, selectAll: false })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitEdit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                cancelEdit()
              }
              e.stopPropagation()
            }}
            onBlur={commitEdit}
            className="absolute rounded-md border-2 border-focus bg-white px-2 text-sm text-slate-900 shadow-lg focus:outline-none dark:bg-slate-800 dark:text-slate-100"
            style={{
              ...toScreen(editingNode.x, editingNode.y + editingNode.height / 2),
              width: Math.max(180, editingNode.width * view.scale),
              transform: 'translateY(-50%)',
            }}
          />
        )}

        <p className="sr-only" aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  )
}

/**
 * Náhled tažení: cíl puštění (tyrkysový čárkovaný rámeček = dovnitř, čára nad / pod uzlem = před / za)
 * a u kurzoru jmenovka taženého uzlu.
 */
function DragPreview({ drag, layout }: { drag: { id: string; x: number; y: number; target: DropTarget | null }; layout: ReturnType<typeof layoutMindMap> }) {
  const node = layout.byId.get(drag.id)
  const target = drag.target ? layout.byId.get(drag.target.targetId) : undefined
  const accent = 'stroke-[#0e7490] dark:stroke-[#3bdaff]'
  return (
    <g pointerEvents="none" aria-hidden="true">
      {target && drag.target?.mode === 'inside' && (
        <rect x={target.x - 6} y={target.y - 6} width={target.width + 12} height={target.height + 12} rx={12} fill="none" strokeWidth={2.5} strokeDasharray="6 4" className={accent} />
      )}
      {target && drag.target && drag.target.mode !== 'inside' && (
        <line
          x1={target.x - 8}
          x2={target.x + target.width + 8}
          y1={drag.target.mode === 'before' ? target.y - 6 : target.y + target.height + 6}
          y2={drag.target.mode === 'before' ? target.y - 6 : target.y + target.height + 6}
          strokeWidth={3}
          strokeLinecap="round"
          className={accent}
        />
      )}
      {node && (
        <g opacity={0.85}>
          <rect x={drag.x + 10} y={drag.y + 10} width={Math.min(node.width, 220)} height={26} rx={6} strokeWidth={1.5} className={`fill-white dark:fill-slate-800 ${accent}`} />
          <text x={drag.x + 18} y={drag.y + 27} className="fill-slate-900 text-xs dark:fill-slate-100">
            {node.text.length > 28 ? `${node.text.slice(0, 27)}…` : node.text}
          </text>
        </g>
      )}
    </g>
  )
}
