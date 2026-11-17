/**
 * Tabulka činností (F-01, textová část).
 * Začátek a konec počítá plánovací jádro (engine/schedule.ts) z délky, předchůdců a kalendáře.
 * Řádky jsou ve stromovém pořadí (model/hierarchy.ts): název je odsazený podle úrovně, WBS číslo vedle.
 */
import { memo, useMemo, useRef, useState, type DragEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { cachedT } from '../i18n/cachedT'
import { formatIsoDate } from '../i18n/format'
import {
  formatPredecessorsWith,
  parsePredecessors,
  resolvePredecessors,
  rowNumbers,
  type PredecessorError,
} from '../model/predecessors'
import {
  depthMap,
  dropPositionAt,
  MAX_DEPTH,
  moveManyTo,
  selectionRoots,
  wbsNumbers,
  type DropPosition,
} from '../model/hierarchy'
import { TASK_KINDS, type Task, type TaskKind } from '../model/schema'
import { EMPTY_SCHEDULED, type ScheduledTask } from '../engine/schedule'
import { ROW_HEIGHT } from '../gantt/geometry'
import { getSchedule, projectStore, useCosts, usePercents, useProject, useSchedule } from '../store/useProject'
import { formatMoney } from '../model/money'
import { milestoneAllows } from '../model/catalogs'
import { LazyDateCell, NumberCell, TextCell } from './EditableCells'
import { createWorkCalendar, isoToDay } from '../engine/calendar'
import { durationForFinish } from '../gantt/drag'
import { isValidIsoDate } from '../model/dates'
import { showNotice } from './notice'
import { confirmAndDelete } from './structureCommands'
import { TableColumns, TableHeader, useTableWidth } from './TableHeader'
import { isTouchLike, recentLongPress, watchLongPress, type LongPressWatch } from './longPress'
import { currentSelection, finishPlainClick, selectWithModifiers, useSelectedIds, useViewState, useVisibleRows } from './viewState'

/** Hlídání dlouhého stisku prstem na řádku (13c) – najednou se drží jen jeden řádek. */
let rowLongPress: LongPressWatch | null = null

// Výška řádků je pevná a stejná jako v grafu (gantt/geometry.ts), aby řádky lícovaly.
// Šířky sloupců nastavuje uživatel (TableHeader.tsx); co se do buňky nevejde, ořízne se.
const td = 'overflow-hidden border-b border-slate-200 px-1 py-0 align-middle whitespace-nowrap dark:border-slate-700/70'

const kindRowClass: Record<TaskKind, string> = {
  task: '',
  phase: 'bg-slate-50 font-semibold dark:bg-slate-800/50',
  milestone: '',
}

/** Text chyby zápisu předchůdců pro uživatele. */
function predecessorErrorText(t: TFunction, error: PredecessorError): string {
  const text =
    error.code === 'cycle'
      ? t('predecessorError.cycle', { path: error.rows.join(' → ') })
      : t(`predecessorError.${error.code}`, error)
  return `${text} ${t('predecessorError.restored')}`
}

function DateCell({ date, hint }: { date: string | null; hint: string }) {
  const { i18n, t } = useTranslation()
  return (
    <span className={`block whitespace-nowrap px-1.5 tabular-nums ${date ? '' : 'text-slate-500 dark:text-slate-400'}`} title={hint}>
      {date ? formatIsoDate(date, i18n.language) : t('table.notComputed')}
    </span>
  )
}

/** O kolik pixelů se název odsadí za každou úroveň stromu. */
const INDENT_PX = 18

/**
 * Údaje jednoho řádku. Jsou to jen jednoduché hodnoty (texty, čísla) a neměnné objekty,
 * aby se řádek překreslil, jen když se změní jeho vlastní údaje (React.memo) – s 300 řádky
 * to výrazně zrychlí každou změnu (viz měření ve fázi 4b).
 */
interface TaskRowProps {
  task: Task
  number: number
  /** Úroveň ve stromu (0 = nejvyšší). */
  depth: number
  wbs: string
  /** Spočítaný začátek / konec ("YYYY-MM-DD" nebo null) a u fáze spočítaná délka. */
  start: string | null
  finish: string | null
  computedDuration: number | null
  inCycle: boolean
  /** Omezení „začít nejdříve“ teď neplatí, protože vazba dovolí začít až později. */
  constraintIgnored: boolean
  /** Text sloupce Předchůdci, např. "2; 5+3". */
  predecessorsText: string
  /** Celková a volná rezerva v pracovních dnech (null = nejde spočítat) a příznak kritické cesty. */
  totalSlack: number | null
  freeSlack: number | null
  critical: boolean
  /** Náklad položky v haléřích (u fáze včetně podřízených) a jeho rozpad – jednotlivá čísla, aby fungovalo memo. */
  costTotal: number
  /** % hotovo k zobrazení (u fáze spočítané z činností). */
  percent: number
  costLabor: number
  costMachines: number
  costMaterial: number
  costOther: number
  /** Má fáze podřízené položky (pak jde sbalit)? */
  hasChildren: boolean
  collapsed: boolean
  /** Je řádek vybraný (zvýrazněný)? */
  selected: boolean
  /** Kam by přetahovaný řádek dopadl, pokud je právě nad tímto řádkem. */
  dropIndicator: DropPosition | null
  /** Táhne se právě tento řádek? */
  dragging: boolean
  /** Obsluha přetahování – stále stejný objekt (nemění se mezi překresleními). */
  drag: RowDragHandlers
}

interface RowDragHandlers {
  onDragStart: (taskId: string, event: DragEvent<HTMLElement>) => void
  onDragOver: (task: Task, event: DragEvent<HTMLTableRowElement>) => void
  onDrop: (event: DragEvent<HTMLTableRowElement>) => void
  onDragEnd: () => void
}

/** Ukazatel místa vložení: čára nad / pod řádkem, nebo rámeček „dovnitř fáze“. */
const INDICATOR_SHADOW: Record<DropPosition, string> = {
  // Barva interakce značky (tyrkysová, ve tmavém vzhledu jasnější) – dříve modrá mimo značku.
  before: 'inset 0 3px 0 0 var(--focus-color)',
  after: 'inset 0 -3px 0 0 var(--focus-color)',
  inside: 'inset 0 0 0 2px var(--focus-color)',
}

/** Vybraný řádek: modré pozadí a pruh vlevo (barva není jediným nositelem informace – U-06). */
const selectedRowClass =
  'bg-miro-turquoise-light/60 shadow-[inset_3px_0_0_0_#0e7490] dark:bg-miro-turquoise/15 dark:shadow-[inset_3px_0_0_0_#3bdaff]'

/**
 * Ikona 📌: činnost má omezení „začít nejdříve k datu“ (nastavené tažením nebo v tabulce).
 * Kliknutím se omezení zruší (jeden krok Zpět). Když teď platí vazba (je později), ikona je bledší
 * a bublina to vysvětlí.
 */
function ConstraintPin({ task, ignored }: { task: Task; ignored: boolean }) {
  const { t: translate, i18n } = useTranslation()
  const t = (key: string, options?: Record<string, string | number>) => cachedT(translate, i18n.language, key, options)
  if (!task.constraintStart) return null
  const date = formatIsoDate(task.constraintStart, i18n.language)
  return (
    <button
      type="button"
      title={t(ignored ? 'table.constraintIgnored' : 'table.constraint', { date })}
      aria-label={t('table.constraintClear', { date, name: task.name })}
      onClick={() => projectStore.getState().setTaskTiming(task.id, { constraintStart: null })}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-slate-700 ${
        ignored ? 'opacity-40' : ''
      }`}
    >
      <span aria-hidden="true">📌</span>
    </button>
  )
}

/** Tlačítko ▸/▾ pro sbalení a rozbalení fáze; u ostatních řádků jen stejně široké místo. */
function CollapseToggle({ task, hasChildren, collapsed }: { task: Task; hasChildren: boolean; collapsed: boolean }) {
  const { t: translate, i18n } = useTranslation()
  const t = (key: string, options?: Record<string, string | number>) => cachedT(translate, i18n.language, key, options)
  const toggle = useViewState((s) => s.toggleCollapsed)
  if (!hasChildren) return <span aria-hidden="true" className="inline-block w-5 shrink-0" />
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={t(collapsed ? 'table.expand' : 'table.collapse', { name: task.name })}
      title={t(collapsed ? 'table.expandHint' : 'table.collapseHint')}
      onClick={() => toggle(task.id)}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-slate-700"
    >
      <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
    </button>
  )
}

const TaskRow = memo(function TaskRow(props: TaskRowProps) {
  const { task, number, depth, wbs, start, finish, computedDuration, inCycle, predecessorsText } = props
  const { hasChildren, collapsed, selected, dropIndicator: indicator, dragging, drag, constraintIgnored } = props
  const { costTotal, costLabor, costMachines, costMaterial, costOther } = props
  const { totalSlack, freeSlack, critical, percent } = props
  const { t: translate, i18n } = useTranslation()
  // Hotové texty z paměti (13c – výkon): 300 řádků × desítky překladů zdržovalo překreslení.
  const t = (key: string, options?: Record<string, string | number>) => cachedT(translate, i18n.language, key, options)
  const select = useViewState((s) => s.select)
  // Řádek nesleduje celý projekt (jinak by se překresloval při každé změně kdekoli);
  // aktuální projekt si vezme až ve chvíli, kdy ho opravdu potřebuje.
  const { updateTask, setDependencies } = projectStore.getState()
  const label = (field: string) => t('table.fieldLabel', { field: t(field), number })
  const isPhase = task.kind === 'phase'
  const datesHint = isPhase ? t('table.phaseDatesHint') : t('table.datesHint')

  /** Začátek z tabulky = omezení „začít nejdříve“ (stejně jako posun úsečky); prázdné pole ho zruší. */
  function commitStart(value: string): boolean | void {
    const store = projectStore.getState()
    if (value === '') {
      store.setTaskTiming(task.id, { constraintStart: null })
      return
    }
    if (!isValidIsoDate(value)) {
      showNotice(t('table.invalidDate'))
      return false
    }
    store.setTaskTiming(task.id, { constraintStart: value })
    if (getSchedule(projectStore.getState().project).constraintOverridden.has(task.id)) {
      showNotice(t('gantt.constraintOverridden', { name: task.name }))
    }
  }

  /** Konec z tabulky přepočítá délku (pracovní dny od začátku do konce). */
  function commitFinish(value: string): boolean | void {
    if (!start || !isValidIsoDate(value)) {
      showNotice(t('table.invalidDate'))
      return false
    }
    const project = projectStore.getState().project
    const duration = durationForFinish(createWorkCalendar(project.calendar), isoToDay(start), isoToDay(value))
    if (duration === null) {
      showNotice(t('table.finishBeforeStart', { start: formatIsoDate(start, i18n.language) }))
      return false
    }
    projectStore.getState().setTaskTiming(task.id, { durationDays: duration })
  }

  // Před smazáním fáze řekne, kolik podřízených položek zmizí s ní (N-08).
  const handleDelete = () => confirmAndDelete(task.id, translate)

  return (
    <tr
      data-task-id={task.id}
      style={{ height: ROW_HEIGHT, boxShadow: indicator ? INDICATOR_SHADOW[indicator] : undefined }}
      // Kliknutí do řádku nebo do jeho pole řádek vybere (s ním pracují Odsadit, Nahoru…).
      // Ctrl+klik přidá / odebere řádek z výběru, Shift+klik vybere rozsah – a nezačne psaní do pole.
      // Na dotykovém displeji: podržet prst ½ s = přidat / odebrat řádek z výběru (místo Ctrl+klik).
      onFocus={() => {
        if (!recentLongPress() && !useViewState.getState().selectedIds.has(task.id)) select(task.id)
      }}
      onMouseDown={(e) => {
        if (e.button === 0 && selectWithModifiers(e, task.id)) e.preventDefault()
      }}
      onClick={(e) => {
        if (!recentLongPress()) finishPlainClick(e, task.id)
      }}
      onPointerDown={(e) => {
        rowLongPress?.cancel()
        rowLongPress = isTouchLike(e) ? watchLongPress(e.clientX, e.clientY, () => useViewState.getState().toggleSelect(task.id)) : null
      }}
      onPointerMove={(e) => rowLongPress?.move(e.clientX, e.clientY)}
      onPointerUp={() => rowLongPress?.cancel()}
      onPointerCancel={() => rowLongPress?.cancel()}
      onContextMenu={(e) => {
        if (recentLongPress()) e.preventDefault() // po dlouhém stisku neotvírat nabídku prohlížeče
      }}
      onDragOver={(e) => drag.onDragOver(task, e)}
      onDrop={drag.onDrop}
      className={`${selected ? selectedRowClass : `hover:bg-miro-turquoise-light/30 dark:hover:bg-slate-800 ${kindRowClass[task.kind]}`} ${
        dragging ? 'opacity-50' : ''
      }`}
    >
      <td className={`${td} px-1 text-right tabular-nums text-slate-500`}>
        <span className="flex items-center justify-between gap-1">
          {/* Úchyt pro přetažení řádku myší. Z klávesnice se řádky přesouvají Alt+Shift+šipkami. */}
          <span
            draggable
            aria-hidden="true"
            title={t('table.dragHint')}
            onDragStart={(e) => drag.onDragStart(task.id, e)}
            onDragEnd={drag.onDragEnd}
            className="cursor-grab select-none px-0.5 text-slate-500 hover:text-slate-700 active:cursor-grabbing dark:text-slate-400 dark:hover:text-slate-200"
          >
            ⠿
          </span>
          {number}
        </span>
      </td>
      <td className={`${td} px-2 tabular-nums text-slate-500`}>{wbs}</td>
      <td className={`${td}`}>
        <div className="flex items-center gap-1" style={{ paddingLeft: depth * INDENT_PX }}>
          <CollapseToggle task={task} hasChildren={hasChildren} collapsed={collapsed} />
          {task.kind === 'milestone' && (
            <span aria-hidden="true" className="pl-1 text-miro-graphite dark:text-slate-200">
              ◆
            </span>
          )}
          <TextCell
            value={task.name}
            label={label('table.name')}
            className={isPhase ? 'font-semibold' : ''}
            onCommit={(name) => {
              const trimmed = name.trim()
              if (trimmed === '') {
                showNotice(t('table.invalidName'))
                return false
              }
              updateTask(task.id, { name: trimmed })
            }}
          />
          <ConstraintPin task={task} ignored={constraintIgnored} />
        </div>
      </td>
      <td className={`${td}`}>
        <select
          aria-label={label('table.kind')}
          title={hasChildren ? t('table.kindLockedHint') : t(`kind.${task.kind}Hint`)}
          value={task.kind}
          onChange={(e) => {
            const kind = e.target.value as TaskKind
            // Milník smí mít jen jednorázový náklad a materiál – ostatní řádky by se odebraly (N-08).
            const removed = kind === 'milestone' ? task.lines.filter((l) => !milestoneAllows(l)).length : 0
            if (removed > 0 && !window.confirm(t('table.confirmMilestoneLines', { count: removed }))) {
              e.target.value = task.kind
              return
            }
            updateTask(task.id, { kind })
          }}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-normal hover:border-slate-300 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/40 dark:hover:border-slate-600 dark:[&>option]:bg-slate-800"
        >
          {TASK_KINDS.map((kind) => (
            // Fáze s činnostmi musí zůstat fází – ostatní volby jsou zašedlé.
            <option key={kind} value={kind} disabled={hasChildren && kind !== 'phase'}>
              {t(`kind.${kind}`)}
            </option>
          ))}
        </select>
      </td>
      {inCycle ? (
        <td colSpan={2} className={td}>
          <span className="block px-1.5 font-medium text-red-700 dark:text-red-400" title={t('table.cycleHint')}>
            <span aria-hidden="true">⚠ </span>
            {t('table.cycle')}
            <span className="sr-only">: {t('table.cycleHint')}</span>
          </span>
        </td>
      ) : isPhase ? (
        // Fáze: termíny se počítají z jejích činností, jen pro čtení.
        <>
          <td className={td}>
            <DateCell date={start} hint={datesHint} />
          </td>
          <td className={td}>
            <DateCell date={finish} hint={datesHint} />
          </td>
        </>
      ) : (
        <>
          <td className={td}>
            <LazyDateCell
              value={start ?? ''}
              display={start ? formatIsoDate(start, i18n.language) : ''}
              label={label('table.start')}
              title={t('table.startHint')}
              onCommit={commitStart}
            />
          </td>
          <td className={td}>
            <LazyDateCell
              value={finish ?? ''}
              display={finish ? formatIsoDate(finish, i18n.language) : ''}
              label={label('table.finish')}
              title={task.kind === 'milestone' ? t('table.milestoneFinishHint') : t('table.finishHint')}
              disabled={task.kind === 'milestone'}
              onCommit={commitFinish}
            />
          </td>
        </>
      )}
      <td className={`${td}`}>
        {isPhase ? (
          <span className="block px-1.5 text-right tabular-nums" title={t('table.phaseDurationHint')}>
            {computedDuration ?? t('table.notComputed')}
          </span>
        ) : (
          <NumberCell
            value={task.durationDays}
            label={label('table.duration')}
            title={t('table.durationHint')}
            min={0}
            max={10000}
            disabled={task.kind === 'milestone'}
            onCommit={(durationDays) => updateTask(task.id, { durationDays })}
          />
        )}
      </td>
      <td className={`${td} px-2 text-right tabular-nums`}>
        {totalSlack !== null && (
          <span
            title={t('table.slackCell', { total: totalSlack, free: freeSlack ?? 0 })}
            className={critical ? 'rounded bg-miro-yellow-light px-1.5 font-semibold text-miro-graphite dark:bg-miro-yellow/20 dark:text-miro-yellow-light' : 'text-slate-600 dark:text-slate-300'}
          >
            {totalSlack}
          </span>
        )}
      </td>
      <td className={`${td}`}>
        {isPhase ? (
          <span className="block px-1.5 text-slate-500" title={t('table.phasePredecessorsHint')}>
            {t('table.notComputed')}
          </span>
        ) : (
          <TextCell
            value={predecessorsText}
            label={label('table.predecessors')}
            title={t('table.predecessorsHint')}
            className="tabular-nums"
            onCommit={(text) => {
              const parsed = parsePredecessors(text)
              const project = projectStore.getState().project
              const resolved = parsed.ok ? resolvePredecessors(project, task.id, parsed.items) : parsed
              if (!resolved.ok) {
                showNotice(predecessorErrorText(translate, resolved.error))
                return false
              }
              setDependencies(task.id, resolved.dependencies)
            }}
          />
        )}
      </td>
      <td className={`${td}`}>
        {task.kind === 'milestone' ? (
          <label className="flex h-full items-center justify-end gap-1.5 px-2" title={t('table.milestoneDoneHint')}>
            <input
              type="checkbox"
              aria-label={label('table.milestoneDone')}
              checked={task.percentComplete >= 100}
              onChange={(e) => updateTask(task.id, { percentComplete: e.target.checked ? 100 : 0 })}
              className="h-4 w-4 accent-miro-turquoise-dark"
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">{t('table.milestoneDone')}</span>
          </label>
        ) : (
          <NumberCell
            value={isPhase ? percent : task.percentComplete}
            label={label('table.percentComplete')}
            min={0}
            max={100}
            disabled={isPhase}
            title={isPhase ? t('table.percentComputed') : undefined}
            onCommit={(percentComplete) => updateTask(task.id, { percentComplete })}
          />
        )}
      </td>
      <td className={`${td} px-2 text-right tabular-nums ${isPhase ? 'font-semibold' : ''}`}>
        {costTotal > 0 && (
          <CostAmount
            total={costTotal}
            parts={{ labor: costLabor, machines: costMachines, material: costMaterial, other: costOther }}
            withChildren={isPhase}
          />
        )}
      </td>
      <td className={`${td}`}>
        <TextCell value={task.notes} label={label('table.notes')} onCommit={(notes) => updateTask(task.id, { notes })} />
      </td>
      <td className={`${td} text-center`}>
        <button
          type="button"
          aria-label={t('table.deleteRow', { number, name: task.name })}
          title={t('table.delete')}
          onClick={handleDelete}
          className="rounded px-2 py-1 text-slate-500 hover:bg-red-100 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 dark:hover:bg-red-900/40 dark:hover:text-red-300"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </td>
    </tr>
  )
})

const NO_DATES: ScheduledTask = EMPTY_SCHEDULED

/** Právě přetahované řádky (jeden, nebo celý výběr) a kam by dopadly. */
interface DragState {
  /** Tažené řádky v pořadí řádků (s vybranou fází jdou i její položky). */
  ids: string[]
  targetId: string | null
  position: DropPosition | null
  /** Jde řádek na toto místo pustit (např. ne do vlastní fáze)? */
  valid: boolean
}

/**
 * Přetahování řádků myší (vestavěné HTML5 Drag and Drop, bez knihovny).
 * Platnost místa ověří stejná funkce, která přesun provede (model/hierarchy.ts → moveManyTo),
 * jen „naprázdno“. Esc tažení zruší (prohlížeč pak pošle dragend bez drop).
 */
function useRowDrag(): { drag: DragState | null; handlers: RowDragHandlers } {
  const { t } = useTranslation()
  const [drag, setDragState] = useState<DragState | null>(null)
  const select = useViewState((s) => s.select)
  // Obsluha se vytvoří jen jednou; aktuální stav tažení čte z ref (proměnné, která přežívá překreslení).
  const dragRef = useRef<DragState | null>(null)
  const setDrag = (next: DragState | null) => {
    dragRef.current = next
    setDragState(next)
  }
  const tRef = useRef(t)
  tRef.current = t

  // Prázdný seznam závislostí: objekt vznikne jen jednou (všechno proměnlivé čte přes ref nebo úložiště).
  const handlers = useMemo<RowDragHandlers>(() => createDragHandlers(dragRef, setDrag, select, tRef), [])
  return { drag, handlers }
}

function createDragHandlers(
  dragRef: RefObject<DragState | null>,
  setDrag: (next: DragState | null) => void,
  select: (id: string | null) => void,
  tRef: RefObject<TFunction>,
): RowDragHandlers {
  return {
    onDragStart(taskId, event) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', taskId) // Firefox bez dat tažení nespustí
      const row = event.currentTarget.closest('tr')
      if (row) event.dataTransfer.setDragImage(row, 16, ROW_HEIGHT / 2)
      // Řádek z hromadného výběru táhne celý výběr; jinak jen sám sebe.
      const { selectedIds } = useViewState.getState()
      let ids = [taskId]
      if (selectedIds.has(taskId) && selectedIds.size > 1) {
        const project = projectStore.getState().project
        ids = selectionRoots(project, currentSelection(project))
      } else select(taskId)
      setDrag({ ids, targetId: null, position: null, valid: false })
    },
    onDragOver(task, event) {
      const drag = dragRef.current
      if (!drag) return
      const box = event.currentTarget.getBoundingClientRect()
      const position = dropPositionAt(event.clientY - box.top, box.height, task.kind === 'phase')
      let { valid } = drag
      if (drag.targetId !== task.id || drag.position !== position) {
        valid = moveManyTo(projectStore.getState().project, drag.ids, task.id, position).ok
        setDrag({ ...drag, targetId: task.id, position, valid })
      }
      if (valid) {
        event.preventDefault() // povolí puštění
        event.dataTransfer.dropEffect = 'move'
      }
    },
    onDrop(event) {
      event.preventDefault()
      const drag = dragRef.current
      if (drag?.valid && drag.targetId && drag.position) {
        const error = projectStore.getState().moveTasks(drag.ids, drag.targetId, drag.position)
        if (error) showNotice(tRef.current(`structure.error.${error}`, { max: MAX_DEPTH }))
      }
      setDrag(null)
    },
    onDragEnd: () => setDrag(null),
  }
}

export function TaskTable({
  onAddTask,
  onLoadSample,
  onWizard,
  onNewProject,
}: {
  onAddTask: () => void
  onLoadSample: () => void
  /** Úvodní obrazovka prázdného plánu (fáze 10): průvodce a okno Nový projekt (šablony). */
  onWizard: () => void
  onNewProject: () => void
}) {
  const { t } = useTranslation()
  const project = useProject((s) => s.project)
  const result = useSchedule()
  const costs = useCosts()
  const percents = usePercents()
  // Čísla řádků se počítají ze všech řádků (i skrytých), aby se sbalením neměnila.
  const numbers = useMemo(() => rowNumbers(project), [project])
  const rows = useVisibleRows(project)
  const collapsed = useViewState((s) => s.collapsed)
  const selectedIds = useSelectedIds(project)
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const depths = useMemo(() => depthMap(project), [project])
  const wbs = useMemo(() => wbsNumbers(project), [project])
  const parents = useMemo(() => new Set(project.tasks.map((task) => task.parentId)), [project])
  const { drag, handlers } = useRowDrag()
  const tableWidth = useTableWidth()

  if (rows.length === 0) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
        <h2 className="text-lg font-semibold">{t('table.emptyTitle')}</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{t('table.emptyText')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onWizard} className="btn-primary">
            {t('table.startWizard')}
          </button>
          <button type="button" onClick={onNewProject} className="btn-secondary">
            {t('table.fromTemplate')}
          </button>
          <button type="button" onClick={onAddTask} className="btn-secondary">
            {t('toolbar.addTask')}
          </button>
          <button type="button" onClick={onLoadSample} className="btn-secondary">
            {t('toolbar.loadSample')}
          </button>
        </div>
      </div>
    )
  }

  return (
    // Pevné rozvržení: šířky sloupců určuje <colgroup> podle nastavení uživatele (TableHeader.tsx).
    <table className="table-fixed border-collapse text-sm" style={{ width: tableWidth }}>
      <caption className="sr-only">{t('table.caption')}</caption>
      <TableColumns />
      <TableHeader />
      <tbody>
        {rows.map((task) => {
          const dates = result.tasks.get(task.id) ?? NO_DATES
          return (
            <TaskRow
              key={task.id}
              task={task}
              number={numbers.get(task.id) ?? 0}
              depth={depths.get(task.id) ?? 0}
              wbs={wbs.get(task.id) ?? ''}
              start={dates.start}
              finish={dates.finish}
              computedDuration={task.kind === 'phase' ? dates.durationDays : null}
              inCycle={result.cycleTaskIds.has(task.id)}
              constraintIgnored={result.constraintOverridden.has(task.id)}
              predecessorsText={formatPredecessorsWith(numbers, task)}
              totalSlack={dates.totalSlack}
              freeSlack={dates.freeSlack}
              critical={dates.critical}
              costTotal={costs.byTask.get(task.id)?.total.total ?? 0}
              percent={percents.get(task.id) ?? task.percentComplete}
              costLabor={costs.byTask.get(task.id)?.total.labor ?? 0}
              costMachines={costs.byTask.get(task.id)?.total.machines ?? 0}
              costMaterial={costs.byTask.get(task.id)?.total.material ?? 0}
              costOther={costs.byTask.get(task.id)?.total.other ?? 0}
              hasChildren={parents.has(task.id)}
              collapsed={collapsed.has(task.id)}
              selected={selectedSet.has(task.id)}
              dropIndicator={drag?.valid && drag.targetId === task.id ? drag.position : null}
              dragging={drag?.ids.includes(task.id) ?? false}
              drag={handlers}
            />
          )
        })}
      </tbody>
      {/* Prázdný řádek navíc – v grafu je pod plánem pruh pro novou činnost tažením; výšky musí sedět. */}
      <tfoot aria-hidden="true">
        <tr style={{ height: ROW_HEIGHT }}>
          <td colSpan={99} />
        </tr>
      </tfoot>
    </table>
  )
}

/** Náklad v buňce tabulky; bublina ukáže rozpad na práci, stroje, materiál a ostatní. */
function CostAmount(props: { total: number; parts: Record<'labor' | 'machines' | 'material' | 'other', number>; withChildren: boolean }) {
  const { t, i18n } = useTranslation()
  const currency = useProject((s) => s.project.currency)
  const money = (h: number) => formatMoney(h, currency, i18n.language)
  const lines = (['labor', 'machines', 'material', 'other'] as const)
    .filter((k) => props.parts[k] > 0)
    .map((k) => `${t(`table.costParts.${k}`)}: ${money(props.parts[k])}`)
  const title = [props.withChildren ? t('table.costWithChildren') : null, ...lines].filter(Boolean).join('\n')
  return (
    <span title={title} className="block truncate">
      {money(props.total)}
    </span>
  )
}
