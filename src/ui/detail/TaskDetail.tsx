/**
 * Panel „Detail činnosti“ (fáze 6b, Z-02, R-01, R-02): řádky zdrojů a nákladů vybrané položky.
 * Každý řádek = jeden zdroj nebo náklad; u každého hodiny a náklad (model/costs.ts).
 * Každá změna je jeden krok Zpět. Text od uživatele se zobrazuje jen jako text.
 */
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { formatNumber } from '../../i18n/format'
import type { LineCost } from '../../model/costs'
import { defaultCategoryId } from '../../model/defaultCategories'
import { formatAmount, formatMoney, parseMoney } from '../../model/money'
import { MILESTONE_LINE_KINDS, type Project, type Task, type TaskLine, type TaskLineKind } from '../../model/schema'
import { projectStore, useCosts, useProject, useSchedule } from '../../store/useProject'
import { DateInputCell, TextCell } from '../EditableCells'
import { showNotice } from '../notice'
import { LazySelect, parseDecimal } from '../resources/catalogCells'
import { useSelectedId } from '../viewState'

/** Typy řádků v pořadí tlačítek „Přidat“. */
const ADDABLE: TaskLineKind[] = ['labor', 'machine', 'material', 'oneTime', 'recurring']

const newId = () => crypto.randomUUID()
const update = (taskId: string, lineId: string, patch: Record<string, unknown>) => projectStore.getState().updateTaskLine(taskId, lineId, patch)

/** Smí položka tohoto druhu mít řádek tohoto typu? (milník jen jednorázový náklad a materiál) */
export function lineAllowed(task: Task, kind: TaskLineKind): boolean {
  return task.kind !== 'milestone' || (MILESTONE_LINE_KINDS as readonly string[]).includes(kind)
}

/** Nový řádek s rozumnými výchozími hodnotami; null = v databázi chybí potřebný zdroj (s hláškou). */
function newLine(kind: TaskLineKind, project: Project, t: TFunction): TaskLine | null {
  if (kind === 'labor') {
    const profession = project.professions[0]
    if (!profession) return (showNotice(t('detail.error.noProfession')), null)
    return { id: newId(), kind, categoryId: profession.categoryId, professionId: profession.id, sharePct: 100 }
  }
  if (kind === 'machine') {
    const machine = project.machines[0]
    if (!machine) return (showNotice(t('detail.error.noMachine')), null)
    return { id: newId(), kind, categoryId: machine.categoryId, machineId: machine.id, sharePct: 100 }
  }
  if (kind === 'material') {
    const material = project.materials[0]
    if (!material) return (showNotice(t('detail.error.noMaterial')), null)
    return { id: newId(), kind, categoryId: material.categoryId, materialId: material.id, quantity: 1 }
  }
  // Jednorázový a průběžný náklad: výchozí kategorie Služby (nebo první, která je).
  const categoryId = project.costCategories.find((c) => c.id === defaultCategoryId('services'))?.id ?? project.costCategories[0]?.id
  if (!categoryId) return (showNotice(t('resources.error.noCategory')), null)
  if (kind === 'oneTime') return { id: newId(), kind, categoryId, name: t('detail.newName.oneTime'), amount: 0, timing: 'start' }
  return { id: newId(), kind, categoryId, name: t('detail.newName.recurring'), amount: 0, period: 'month' }
}

/** Záhlaví panelu: název vybrané položky, délka, náklad a tlačítka pro přidání řádku. */
export function TaskDetailHeader() {
  const { t, i18n } = useTranslation()
  const project = useProject((s) => s.project)
  const selectedId = useSelectedId(project)
  const task = project.tasks.find((x) => x.id === selectedId)
  const costs = useCosts()
  const dates = useSchedule().tasks.get(selectedId ?? '')
  const money = (h: number) => formatMoney(h, project.currency, i18n.language)

  if (!task) return <p className="text-sm text-slate-500 dark:text-slate-400">{t('detail.noSelection')}</p>
  const cost = costs.byTask.get(task.id)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <h2 className="min-w-0 truncate font-semibold">{task.name}</h2>
      <span className="text-slate-500 dark:text-slate-400">
        {t(`kind.${task.kind}`)} · {t('detail.days', { count: dates?.durationDays ?? 0 })}
      </span>
      {cost && (
        <span className="tabular-nums">
          {t('detail.cost')}: <strong>{money(cost.own.total)}</strong>
          {task.kind === 'phase' && cost.total.total !== cost.own.total && (
            <span className="text-slate-500 dark:text-slate-400"> · {t('detail.costWithChildren', { amount: money(cost.total.total) })}</span>
          )}
        </span>
      )}
      <div role="group" aria-label={t('detail.addLabel')} className="ml-auto flex flex-wrap gap-1">
        {ADDABLE.map((kind) => {
          const allowed = lineAllowed(task, kind)
          return (
            <button
              key={kind}
              type="button"
              className="btn-secondary !py-0.5"
              disabled={!allowed}
              title={allowed ? t(`detail.addHint.${kind}`) : t('detail.notForMilestone')}
              onClick={() => {
                const line = newLine(kind, projectStore.getState().project, t)
                if (line) projectStore.getState().addTaskLine(task.id, line)
              }}
            >
              <span aria-hidden="true">＋</span> {t(`detail.kind.${kind}`)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Tělo panelu: tabulka řádků vybrané položky. */
export function TaskDetailBody() {
  const { t } = useTranslation()
  const project = useProject((s) => s.project)
  const selectedId = useSelectedId(project)
  const task = project.tasks.find((x) => x.id === selectedId)
  const costs = useCosts()
  if (!task) return null
  if (task.lines.length === 0) return <p className="py-2 text-sm text-slate-500 dark:text-slate-400">{t('detail.empty')}</p>

  const th = 'border-b border-slate-300 px-1.5 py-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:text-slate-300'
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">{t('detail.caption', { name: task.name })}</caption>
      <colgroup>
        <col style={{ width: '7rem' }} />
        <col />
        <col style={{ width: '7rem' }} />
        <col style={{ width: '6rem' }} />
        <col style={{ width: '9rem' }} />
        <col style={{ width: '9rem' }} />
        <col style={{ width: '12rem' }} />
        <col style={{ width: '2.5rem' }} />
      </colgroup>
      <thead>
        <tr>
          <th className={th}>{t('detail.columns.kind')}</th>
          <th className={th}>{t('detail.columns.resource')}</th>
          <th className={`${th} text-right`}>{t('detail.columns.amount')}</th>
          <th className={`${th} text-right`}>{t('detail.columns.hours')}</th>
          <th className={th}>{t('detail.columns.category')}</th>
          <th className={`${th} text-right`}>{t('detail.columns.cost')}</th>
          <th className={th}>{t('detail.columns.note')}</th>
          <th className={th}>
            <span className="sr-only">{t('resources.delete')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {task.lines.map((line) => (
          <LineRow key={line.id} taskId={task.id} line={line} cost={costs.lines.get(line.id)} />
        ))}
      </tbody>
    </table>
  )
}

const LineRow = memo(function LineRow({ taskId, line, cost }: { taskId: string; line: TaskLine; cost: LineCost | undefined }) {
  const { t, i18n } = useTranslation()
  const currency = useProject((s) => s.project.currency)
  const label = (field: string) => t('detail.fieldLabel', { field: t(`detail.columns.${field}`), kind: t(`detail.kind.${line.kind}`) })
  return (
    <tr className="border-b border-slate-200 align-middle dark:border-slate-700">
      <td className="px-1.5 py-0.5 text-slate-600 dark:text-slate-300">{t(`detail.kind.${line.kind}`)}</td>
      <td className="px-1 py-0.5">
        <ResourceCell taskId={taskId} line={line} label={label('resource')} />
      </td>
      <td className="px-1 py-0.5 text-right">
        <AmountCell taskId={taskId} line={line} label={label('amount')} />
      </td>
      <td className="px-1.5 py-0.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
        {cost?.hours != null ? `${formatNumber(Math.round(cost.hours * 10) / 10, i18n.language)} h` : ''}
      </td>
      <td className="px-1 py-0.5">
        <LineCategory taskId={taskId} line={line} label={label('category')} />
      </td>
      <td className="px-1.5 py-0.5 text-right tabular-nums font-medium">
        {cost && formatMoney(cost.amount, currency, i18n.language)}
        {cost?.warning === 'noRate' && (
          <span className="ml-1 text-amber-600 dark:text-amber-400" title={t('detail.warning.noRate')} aria-label={t('detail.warning.noRate')}>
            ⚠
          </span>
        )}
      </td>
      <td className="px-1 py-0.5">
        <TextCell
          value={line.note ?? ''}
          label={label('note')}
          onCommit={(raw) => {
            const note = raw.trim()
            if (note.length > 500) return (showNotice(t('resources.error.tooLong', { max: 500 })), false)
            update(taskId, line.id, { note: note === '' ? undefined : note })
          }}
        />
      </td>
      <td className="px-1 text-center">
        <button
          type="button"
          onClick={() => projectStore.getState().deleteTaskLine(taskId, line.id)}
          aria-label={t('detail.deleteLine', { kind: t(`detail.kind.${line.kind}`) })}
          title={t('detail.deleteLineHint')}
          className="rounded px-1.5 text-slate-400 hover:bg-red-100 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950 dark:hover:text-red-300"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </td>
    </tr>
  )
})

/** Výběr zdroje: člověk = profese + (volitelně) pracovník té profese; stroj = stroj. */
function ResourceCell({ taskId, line, label }: { taskId: string; line: TaskLine; label: string }) {
  const { t } = useTranslation()
  const professions = useProject((s) => s.project.professions)
  const workers = useProject((s) => s.project.workers)
  const machines = useProject((s) => s.project.machines)
  const professionOptions = useMemo(() => professions.map((p) => ({ value: p.id, label: p.name })), [professions])
  const machineOptions = useMemo(() => machines.map((m) => ({ value: m.id, label: m.name })), [machines])

  if (line.kind === 'labor') {
    const workerOptions = [
      { value: '', label: t('detail.anyWorker') },
      ...workers.filter((w) => w.professionId === line.professionId).map((w) => ({ value: w.id, label: w.name })),
    ]
    return (
      <div className="grid grid-cols-2 gap-1">
        <LazySelect
          label={`${label} – ${t('resources.columns.profession')}`}
          value={line.professionId}
          options={professionOptions}
          onChange={(professionId) => {
            const category = professions.find((p) => p.id === professionId)?.categoryId
            // Pracovník jiné profese už k řádku nepatří.
            update(taskId, line.id, { professionId, workerId: undefined, ...(category ? { categoryId: category } : {}) })
          }}
        />
        <LazySelect
          label={`${label} – ${t('resources.columns.workerName')}`}
          value={line.workerId ?? ''}
          options={workerOptions}
          onChange={(workerId) => update(taskId, line.id, { workerId: workerId === '' ? undefined : workerId })}
        />
      </div>
    )
  }
  if (line.kind === 'machine') {
    return (
      <LazySelect
        label={label}
        value={line.machineId}
        options={machineOptions}
        onChange={(machineId) => {
          const category = machines.find((m) => m.id === machineId)?.categoryId
          update(taskId, line.id, { machineId, ...(category ? { categoryId: category } : {}) })
        }}
      />
    )
  }
  if (line.kind === 'material') return <MaterialCell taskId={taskId} line={line} label={label} />
  return (
    <div className="grid grid-cols-2 gap-1">
      <TextCell
        value={line.name}
        label={`${label} – ${t('detail.name')}`}
        onCommit={(raw) => {
          const name = raw.trim()
          if (name === '' || name.length > 200) return (showNotice(t('resources.error.requiredShort', { max: 200 })), false)
          update(taskId, line.id, { name })
        }}
      />
      {line.kind === 'oneTime' ? <TimingCell taskId={taskId} line={line} label={label} /> : <PeriodCell taskId={taskId} line={line} label={label} />}
    </div>
  )
}

/** Materiál z databáze + nepovinná přepsaná cena (prázdné pole = cena z databáze). */
function MaterialCell({ taskId, line, label }: { taskId: string; line: Extract<TaskLine, { kind: 'material' }>; label: string }) {
  const { t, i18n } = useTranslation()
  const materials = useProject((s) => s.project.materials)
  const options = useMemo(() => materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` })), [materials])
  const material = materials.find((m) => m.id === line.materialId)
  return (
    <div className="grid grid-cols-[1fr_8rem] gap-1">
      <LazySelect
        label={label}
        value={line.materialId}
        options={options}
        onChange={(materialId) => {
          const category = materials.find((m) => m.id === materialId)?.categoryId
          update(taskId, line.id, { materialId, ...(category ? { categoryId: category } : {}) })
        }}
      />
      <TextCell
        value={line.unitPriceOverride === undefined ? '' : formatAmount(line.unitPriceOverride, i18n.language)}
        label={`${label} – ${t('detail.priceOverride')}`}
        className="text-right tabular-nums placeholder:text-slate-400"
        title={t('detail.priceOverrideHint', { price: material ? formatAmount(material.unitPrice, i18n.language) : '' })}
        onCommit={(raw) => {
          if (raw.trim() === '') return void update(taskId, line.id, { unitPriceOverride: undefined })
          const value = parseMoney(raw)
          if (value === null) return (showNotice(t('resources.error.invalidMoney')), false)
          update(taskId, line.id, { unitPriceOverride: value })
        }}
      />
    </div>
  )
}

/** Kdy nastane jednorázový náklad: začátek, konec, nebo pevné datum. */
function TimingCell({ taskId, line, label }: { taskId: string; line: Extract<TaskLine, { kind: 'oneTime' }>; label: string }) {
  const { t } = useTranslation()
  const options = useMemo(() => (['start', 'end', 'date'] as const).map((v) => ({ value: v, label: t(`detail.timing.${v}`) })), [t])
  const startDate = useProject((s) => s.project.startDate)
  return (
    <div className="flex gap-1">
      <LazySelect
        label={`${label} – ${t('detail.when')}`}
        value={line.timing}
        options={options}
        onChange={(timing) =>
          update(taskId, line.id, timing === 'date' ? { timing, date: line.date ?? startDate } : { timing, date: undefined })
        }
      />
      {line.timing === 'date' && (
        <DateInputCell
          value={line.date ?? ''}
          label={`${label} – ${t('detail.date')}`}
          onCommit={(value) => {
            if (value === '') return (showNotice(t('table.invalidDate')), false)
            update(taskId, line.id, { date: value })
          }}
        />
      )}
    </div>
  )
}

/** Období průběžného nákladu: za pracovní den, kalendářní týden, měsíc. */
function PeriodCell({ taskId, line, label }: { taskId: string; line: Extract<TaskLine, { kind: 'recurring' }>; label: string }) {
  const { t } = useTranslation()
  const options = useMemo(() => (['day', 'week', 'month'] as const).map((v) => ({ value: v, label: t(`detail.period.${v}`) })), [t])
  return <LazySelect label={`${label} – ${t('detail.periodLabel')}`} value={line.period} options={options} onChange={(period) => update(taskId, line.id, { period })} />
}

/** Sloupec Množství: % u člověka a stroje, množství a jednotka u materiálu, částka u nákladů. */
function AmountCell({ taskId, line, label }: { taskId: string; line: TaskLine; label: string }) {
  const { t, i18n } = useTranslation()
  const unit = useProject((s) => (line.kind === 'material' ? s.project.materials.find((m) => m.id === line.materialId)?.unit : undefined))
  if (line.kind === 'labor' || line.kind === 'machine') return <ShareCell taskId={taskId} line={line} label={label} />
  if (line.kind === 'material') {
    return (
      <div className="flex items-center gap-1">
        <TextCell
          value={formatNumber(line.quantity, i18n.language)}
          label={label}
          className="text-right tabular-nums"
          onCommit={(raw) => {
            const value = parseDecimal(raw)
            if (value === null || value <= 0 || value > 1_000_000_000 || Math.abs(Math.round(value * 1000) - value * 1000) > 1e-6) {
              return (showNotice(t('detail.error.invalidQuantity')), false)
            }
            update(taskId, line.id, { quantity: value })
          }}
        />
        <span className="w-8 shrink-0 truncate text-left text-slate-500 dark:text-slate-400">{unit}</span>
      </div>
    )
  }
  return (
    <TextCell
      value={formatAmount(line.amount, i18n.language)}
      label={label}
      className="text-right tabular-nums"
      onCommit={(raw) => {
        const value = parseMoney(raw)
        if (value === null) return (showNotice(t('resources.error.invalidMoney')), false)
        update(taskId, line.id, { amount: value })
      }}
    />
  )
}

/** % zapojení / využití (1–100). */
function ShareCell({ taskId, line, label }: { taskId: string; line: Extract<TaskLine, { sharePct: number }>; label: string }) {
  const { t, i18n } = useTranslation()
  return (
    <div className="flex items-center gap-1">
      <TextCell
        value={formatNumber(line.sharePct, i18n.language)}
        label={label}
        className="text-right tabular-nums"
        onCommit={(raw) => {
          const value = parseDecimal(raw.replace('%', ''))
          if (value === null || value < 1 || value > 100) return (showNotice(t('detail.error.invalidShare')), false)
          update(taskId, line.id, { sharePct: value })
        }}
      />
      <span className="text-slate-500 dark:text-slate-400">%</span>
    </div>
  )
}

/** Kategorie nákladů řádku. */
function LineCategory({ taskId, line, label }: { taskId: string; line: TaskLine; label: string }) {
  const categories = useProject((s) => s.project.costCategories)
  const options = useMemo(() => categories.map((c) => ({ value: c.id, label: c.name })), [categories])
  return <LazySelect label={label} value={line.categoryId} options={options} onChange={(categoryId) => update(taskId, line.id, { categoryId })} />
}
