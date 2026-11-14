/**
 * Tabulka činností (F-01, textová část).
 * Ve fázi 1 se termíny a předchůdci ještě nepočítají – ukazují „—“.
 */
import { useTranslation } from 'react-i18next'
import { TASK_KINDS, type Task, type TaskKind } from '../model/schema'
import { projectStore, useProject } from '../store/useProject'
import { NumberCell, TextCell } from './EditableCells'

const th = 'sticky top-0 z-10 border-b border-slate-300 bg-slate-100 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
const td = 'border-b border-slate-200 px-1 py-0.5 align-middle dark:border-slate-700/70'

const kindRowClass: Record<TaskKind, string> = {
  task: '',
  phase: 'bg-slate-50 font-semibold dark:bg-slate-800/50',
  milestone: '',
}

function NotComputed() {
  const { t } = useTranslation()
  return (
    <span className="px-1.5 text-slate-400 dark:text-slate-500" title={t('table.notComputedHint')}>
      {t('table.notComputed')}
    </span>
  )
}

function TaskRow({ task, number }: { task: Task; number: number }) {
  const { t } = useTranslation()
  const { updateTask, deleteTask } = projectStore.getState()
  const label = (field: string) => t('table.fieldLabel', { field: t(field), number })

  return (
    <tr data-task-id={task.id} className={`hover:bg-blue-50/60 dark:hover:bg-slate-800 ${kindRowClass[task.kind]}`}>
      <td className={`${td} px-2 text-right tabular-nums text-slate-500`}>{number}</td>
      <td className={`${td} min-w-64`}>
        <div className="flex items-center gap-1">
          {task.kind === 'milestone' && (
            <span aria-hidden="true" className="pl-1 text-amber-600 dark:text-amber-400">
              ◆
            </span>
          )}
          <TextCell
            value={task.name}
            label={label('table.name')}
            className={task.kind === 'phase' ? 'font-semibold' : ''}
            onCommit={(name) => {
              const trimmed = name.trim()
              if (trimmed === '') {
                window.alert(t('table.invalidName'))
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
          title={t(`kind.${task.kind}Hint`)}
          value={task.kind}
          onChange={(e) => updateTask(task.id, { kind: e.target.value as TaskKind })}
          className="w-full rounded border border-transparent bg-transparent px-1 py-1 font-normal hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:hover:border-slate-600 dark:[&>option]:bg-slate-800"
        >
          {TASK_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`kind.${kind}`)}
            </option>
          ))}
        </select>
      </td>
      <td className={td}>
        <NotComputed />
      </td>
      <td className={td}>
        <NotComputed />
      </td>
      <td className={`${td} w-24`}>
        {task.kind === 'phase' ? (
          <span className="block px-1.5 text-right text-slate-400" title={t('table.phaseDurationHint')}>
            {t('table.notComputed')}
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
      <td className={td}>
        <NotComputed />
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
          onClick={() => {
            if (window.confirm(t('table.confirmDelete', { name: task.name }))) deleteTask(task.id)
          }}
          className="rounded px-2 py-1 text-slate-500 hover:bg-red-100 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 dark:hover:bg-red-900/40 dark:hover:text-red-300"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </td>
    </tr>
  )
}

export function TaskTable({ onAddTask, onLoadSample }: { onAddTask: () => void; onLoadSample: () => void }) {
  const { t } = useTranslation()
  const tasks = useProject((s) => s.project.tasks)
  // Ve fázi 1 jsou všechny položky na jedné úrovni – stačí seřadit podle pořadí.
  const rows = [...tasks].sort((a, b) => a.order - b.order)

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
        <tr>
          <th scope="col" className={`${th} w-10 text-right`}>
            {t('table.rowNumber')}
          </th>
          <th scope="col" className={th}>
            {t('table.name')}
          </th>
          <th scope="col" className={`${th} w-32`}>
            {t('table.kind')}
          </th>
          <th scope="col" className={`${th} w-24`}>
            {t('table.start')}
          </th>
          <th scope="col" className={`${th} w-24`}>
            {t('table.finish')}
          </th>
          <th scope="col" className={`${th} text-right`} title={t('table.durationHint')}>
            {t('table.duration')}
          </th>
          <th scope="col" className={`${th} w-28`}>
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
        {rows.map((task, index) => (
          <TaskRow key={task.id} task={task} number={index + 1} />
        ))}
      </tbody>
    </table>
  )
}
