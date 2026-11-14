/**
 * Tabulka činností (F-01, textová část).
 * Začátek a konec počítá plánovací jádro (engine/schedule.ts) z délky, předchůdců a kalendáře.
 * Řádky jsou ve stromovém pořadí (model/hierarchy.ts): název je odsazený podle úrovně, WBS číslo vedle.
 */
import { useMemo, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { formatIsoDate } from '../i18n/format'
import { formatPredecessors, parsePredecessors, resolvePredecessors, rowNumbers, type PredecessorError } from '../model/predecessors'
import {
  depthMap,
  descendantIds,
  dropPositionAt,
  MAX_DEPTH,
  moveTo,
  wbsNumbers,
  type DropPosition,
} from '../model/hierarchy'
import { TASK_KINDS, type Project, type Task, type TaskKind } from '../model/schema'
import type { ScheduledTask } from '../engine/schedule'
import { HEADER_HEIGHT, ROW_HEIGHT } from '../gantt/geometry'
import { projectStore, useProject, useSchedule } from '../store/useProject'
import { NumberCell, TextCell } from './EditableCells'
import { showNotice } from './notice'
import { useSelectedId, useViewState, useVisibleRows } from './viewState'

// Výška hlavičky a řádků je pevná a stejná jako v grafu (gantt/geometry.ts), aby řádky lícovaly.
const th = 'sticky top-0 z-10 whitespace-nowrap border-b border-slate-300 bg-slate-100 px-2 py-0 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
const td = 'border-b border-slate-200 px-1 py-0 align-middle whitespace-nowrap dark:border-slate-700/70'

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
    <span className={`block whitespace-nowrap px-1.5 tabular-nums ${date ? '' : 'text-slate-400 dark:text-slate-500'}`} title={hint}>
      {date ? formatIsoDate(date, i18n.language) : t('table.notComputed')}
    </span>
  )
}

/** O kolik pixelů se název odsadí za každou úroveň stromu. */
const INDENT_PX = 18

interface TaskRowProps {
  task: Task
  number: number
  /** Úroveň ve stromu (0 = nejvyšší). */
  depth: number
  wbs: string
  dates: ScheduledTask
  inCycle: boolean
  /** Má fáze podřízené položky (pak jde sbalit)? */
  hasChildren: boolean
  collapsed: boolean
  /** Je řádek vybraný (zvýrazněný)? */
  selected: boolean
  /** Přetahování řádků (F-05): sdílený stav z tabulky. */
  drag: RowDragHandlers
}

/** Kam by přetahovaný řádek dopadl, pokud je právě nad tímto řádkem (jinak null). */
type DropIndicator = DropPosition | null

interface RowDragHandlers {
  draggingId: string | null
  indicatorFor: (taskId: string) => DropIndicator
  onDragStart: (taskId: string, event: DragEvent<HTMLElement>) => void
  onDragOver: (task: Task, event: DragEvent<HTMLTableRowElement>) => void
  onDrop: (event: DragEvent<HTMLTableRowElement>) => void
  onDragEnd: () => void
}

/** Ukazatel místa vložení: čára nad / pod řádkem, nebo rámeček „dovnitř fáze“. */
const INDICATOR_SHADOW: Record<DropPosition, string> = {
  before: 'inset 0 3px 0 0 rgb(37 99 235)',
  after: 'inset 0 -3px 0 0 rgb(37 99 235)',
  inside: 'inset 0 0 0 2px rgb(37 99 235)',
}

/** Vybraný řádek: modré pozadí a pruh vlevo (barva není jediným nositelem informace – U-06). */
const selectedRowClass = 'bg-blue-100 shadow-[inset_3px_0_0_0_rgb(37_99_235)] dark:bg-blue-900/40'

/** Tlačítko ▸/▾ pro sbalení a rozbalení fáze; u ostatních řádků jen stejně široké místo. */
function CollapseToggle({ task, hasChildren, collapsed }: { task: Task; hasChildren: boolean; collapsed: boolean }) {
  const { t } = useTranslation()
  const toggle = useViewState((s) => s.toggleCollapsed)
  if (!hasChildren) return <span aria-hidden="true" className="inline-block w-5 shrink-0" />
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={t(collapsed ? 'table.expand' : 'table.collapse', { name: task.name })}
      title={t(collapsed ? 'table.expandHint' : 'table.collapseHint')}
      onClick={() => toggle(task.id)}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700"
    >
      <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
    </button>
  )
}

function TaskRow({ task, number, depth, wbs, dates, inCycle, hasChildren, collapsed, selected, drag }: TaskRowProps) {
  const { t } = useTranslation()
  const project = useProject((s) => s.project)
  const select = useViewState((s) => s.select)
  const { updateTask, deleteTask, setDependencies } = projectStore.getState()
  const label = (field: string) => t('table.fieldLabel', { field: t(field), number })
  const isPhase = task.kind === 'phase'
  const datesHint = isPhase ? t('table.phaseDatesHint') : t('table.datesHint')

  function handleDelete() {
    // Před smazáním fáze řekneme, kolik podřízených položek zmizí s ní (N-08).
    const children = descendantIds(project, task.id).size
    const question =
      children > 0
        ? t('table.confirmDeleteWithChildren', { name: task.name, count: children })
        : t('table.confirmDelete', { name: task.name })
    if (window.confirm(question)) deleteTask(task.id)
  }

  const indicator = drag.indicatorFor(task.id)

  return (
    <tr
      data-task-id={task.id}
      style={{ height: ROW_HEIGHT, boxShadow: indicator ? INDICATOR_SHADOW[indicator] : undefined }}
      // Kliknutí do řádku nebo do jeho pole řádek vybere (s ním pracují Odsadit, Nahoru…).
      onFocus={() => select(task.id)}
      onMouseDown={() => select(task.id)}
      onDragOver={(e) => drag.onDragOver(task, e)}
      onDrop={drag.onDrop}
      className={`${selected ? selectedRowClass : `hover:bg-blue-50/60 dark:hover:bg-slate-800 ${kindRowClass[task.kind]}`} ${
        drag.draggingId === task.id ? 'opacity-50' : ''
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
            className="cursor-grab select-none px-0.5 text-slate-400 hover:text-slate-700 active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-200"
          >
            ⠿
          </span>
          {number}
        </span>
      </td>
      <td className={`${td} px-2 tabular-nums text-slate-500`}>{wbs}</td>
      <td className={`${td} min-w-64`}>
        <div className="flex items-center gap-1" style={{ paddingLeft: depth * INDENT_PX }}>
          <CollapseToggle task={task} hasChildren={hasChildren} collapsed={collapsed} />
          {task.kind === 'milestone' && (
            <span aria-hidden="true" className="pl-1 text-amber-600 dark:text-amber-400">
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
        </div>
      </td>
      <td className={`${td} min-w-32`}>
        <select
          aria-label={label('table.kind')}
          title={hasChildren ? t('table.kindLockedHint') : t(`kind.${task.kind}Hint`)}
          value={task.kind}
          onChange={(e) => updateTask(task.id, { kind: e.target.value as TaskKind })}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-normal hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:hover:border-slate-600 dark:[&>option]:bg-slate-800"
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
      ) : (
        <>
          <td className={td}>
            <DateCell date={dates.start} hint={datesHint} />
          </td>
          <td className={td}>
            <DateCell date={dates.finish} hint={datesHint} />
          </td>
        </>
      )}
      <td className={`${td} w-24`}>
        {isPhase ? (
          <span className="block px-1.5 text-right tabular-nums" title={t('table.phaseDurationHint')}>
            {dates.durationDays ?? t('table.notComputed')}
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
      <td className={`${td} w-32`}>
        {isPhase ? (
          <span className="block px-1.5 text-slate-400" title={t('table.phasePredecessorsHint')}>
            {t('table.notComputed')}
          </span>
        ) : (
          <TextCell
            value={formatPredecessors(project, task)}
            label={label('table.predecessors')}
            title={t('table.predecessorsHint')}
            className="tabular-nums"
            onCommit={(text) => {
              const parsed = parsePredecessors(text)
              const resolved = parsed.ok ? resolvePredecessors(project, task.id, parsed.items) : parsed
              if (!resolved.ok) {
                showNotice(predecessorErrorText(t, resolved.error))
                return false
              }
              setDependencies(task.id, resolved.dependencies)
            }}
          />
        )}
      </td>
      <td className={`${td} w-20`}>
        <NumberCell
          value={task.percentComplete}
          label={label('table.percentComplete')}
          min={0}
          max={100}
          onCommit={(percentComplete) => updateTask(task.id, { percentComplete })}
        />
      </td>
      <td className={`${td} min-w-48`}>
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
}

const NO_DATES: ScheduledTask = { start: null, finish: null, durationDays: null }

/** Právě přetahovaný řádek a kam by dopadl. */
interface DragState {
  draggingId: string
  targetId: string | null
  position: DropPosition | null
  /** Jde řádek na toto místo pustit (např. ne do vlastní fáze)? */
  valid: boolean
}

/**
 * Přetahování řádků myší (vestavěné HTML5 Drag and Drop, bez knihovny).
 * Platnost místa ověří stejná funkce, která přesun provede (model/hierarchy.ts → moveTo),
 * jen „naprázdno“. Esc tažení zruší (prohlížeč pak pošle dragend bez drop).
 */
function useRowDrag(project: Project): RowDragHandlers {
  const { t } = useTranslation()
  const [drag, setDrag] = useState<DragState | null>(null)
  const select = useViewState((s) => s.select)

  return {
    draggingId: drag?.draggingId ?? null,
    indicatorFor: (taskId) => (drag?.valid && drag.targetId === taskId ? drag.position : null),
    onDragStart(taskId, event) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', taskId) // Firefox bez dat tažení nespustí
      const row = event.currentTarget.closest('tr')
      if (row) event.dataTransfer.setDragImage(row, 16, ROW_HEIGHT / 2)
      setDrag({ draggingId: taskId, targetId: null, position: null, valid: false })
      select(taskId)
    },
    onDragOver(task, event) {
      if (!drag) return
      const box = event.currentTarget.getBoundingClientRect()
      const position = dropPositionAt(event.clientY - box.top, box.height, task.kind === 'phase')
      let { valid } = drag
      if (drag.targetId !== task.id || drag.position !== position) {
        valid = moveTo(project, drag.draggingId, task.id, position).ok
        setDrag({ ...drag, targetId: task.id, position, valid })
      }
      if (valid) {
        event.preventDefault() // povolí puštění
        event.dataTransfer.dropEffect = 'move'
      }
    },
    onDrop(event) {
      event.preventDefault()
      if (drag?.valid && drag.targetId && drag.position) {
        const error = projectStore.getState().moveTask(drag.draggingId, drag.targetId, drag.position)
        if (error) showNotice(t(`structure.error.${error}`, { max: MAX_DEPTH }))
      }
      setDrag(null)
    },
    onDragEnd: () => setDrag(null),
  }
}

export function TaskTable({ onAddTask, onLoadSample }: { onAddTask: () => void; onLoadSample: () => void }) {
  const { t } = useTranslation()
  const project = useProject((s) => s.project)
  const result = useSchedule()
  // Čísla řádků se počítají ze všech řádků (i skrytých), aby se sbalením neměnila.
  const numbers = useMemo(() => rowNumbers(project), [project])
  const rows = useVisibleRows(project)
  const collapsed = useViewState((s) => s.collapsed)
  const selectedId = useSelectedId(project)
  const depths = useMemo(() => depthMap(project), [project])
  const wbs = useMemo(() => wbsNumbers(project), [project])
  const parents = useMemo(() => new Set(project.tasks.map((task) => task.parentId)), [project])
  const drag = useRowDrag(project)

  if (rows.length === 0) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
        <h2 className="text-lg font-semibold">{t('table.emptyTitle')}</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{t('table.emptyText')}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={onAddTask} className="btn-primary">
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
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{t('table.caption')}</caption>
      <thead>
        <tr style={{ height: HEADER_HEIGHT }}>
          <th scope="col" className={`${th} w-10 text-right`}>
            {t('table.rowNumber')}
          </th>
          <th scope="col" className={`${th} w-16`} title={t('table.wbsHint')}>
            {t('table.wbs')}
          </th>
          <th scope="col" className={th}>
            {t('table.name')}
          </th>
          <th scope="col" className={`${th} w-32`}>
            {t('table.kind')}
          </th>
          <th scope="col" className={`${th} w-28`} title={t('table.datesHint')}>
            {t('table.start')}
          </th>
          <th scope="col" className={`${th} w-28`} title={t('table.datesHint')}>
            {t('table.finish')}
          </th>
          <th scope="col" className={`${th} text-right`} title={t('table.durationHint')}>
            {t('table.duration')}
          </th>
          <th scope="col" className={th} title={t('table.predecessorsHint')}>
            {t('table.predecessors')}
          </th>
          <th scope="col" className={`${th} text-right`}>
            {t('table.percentComplete')}
          </th>
          <th scope="col" className={th}>
            {t('table.notes')}
          </th>
          <th scope="col" className={`${th} w-14 text-center`}>
            <span className="sr-only">{t('table.actions')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            number={numbers.get(task.id) ?? 0}
            hasChildren={parents.has(task.id)}
            collapsed={collapsed.has(task.id)}
            selected={task.id === selectedId}
            drag={drag}
            depth={depths.get(task.id) ?? 0}
            wbs={wbs.get(task.id) ?? ''}
            dates={result.tasks.get(task.id) ?? NO_DATES}
            inCycle={result.cycleTaskIds.has(task.id)}
          />
        ))}
      </tbody>
    </table>
  )
}
