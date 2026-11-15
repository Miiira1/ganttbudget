/**
 * Obrazovka „Zdroje“ (fáze 6a, Z-01): databáze (číselníky) projektu v podzáložkách.
 * Každá změna je jeden krok Zpět. Vybranou podzáložku i pořadí podzáložek si pamatuje prohlížeč;
 * pořadí jde změnit tažením záložky myší nebo klávesami Alt+Shift+←/→ (tabOrder.ts).
 */
import { useMemo, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { categoryUsage, departmentUsage, professionUsage, uniqueName } from '../../model/catalogs'
import { defaultCategoryId } from '../../model/defaultCategories'
import { formatMoney } from '../../model/money'
import { effectiveWorkerRate, professionRate, workingDaysInYear } from '../../model/rates'
import type { Category, Department, Machine, Material, Profession, Worker } from '../../model/schema'
import { projectStore, useProject } from '../../store/useProject'
import { showNotice } from '../notice'
import { loadPreference, savePreference } from '../preferences'
import { CatalogTable, type CatalogColumn } from './CatalogTable'
import { CapacityCell, CategorySelect, LazySelect, MoneyCell, NameCell, OptionalTextCell, RequiredTextCell } from './catalogCells'
import { RateDialog, type RateTarget } from './RateDialog'
import { DeleteCategoryDialog } from './DeleteCategoryDialog'
import { moveTab, parseTabOrder } from './tabOrder'

/** Podzáložky ve výchozím pořadí. */
const TABS = ['professions', 'workers', 'departments', 'machines', 'materials', 'costCategories'] as const
type Tab = (typeof TABS)[number]

const newId = () => crypto.randomUUID()

/** Tažená záložka a kam by se vložila (index v pořadí po přesunu). */
interface TabDrag {
  id: Tab
  index: number | null
}

export function ResourcesView() {
  const { t } = useTranslation()
  const [tab, setTabState] = useState<Tab>(() => {
    const saved = loadPreference('resourcesTab')
    return (TABS as readonly string[]).includes(saved ?? '') ? (saved as Tab) : TABS[0]
  })
  const setTab = (next: Tab) => {
    setTabState(next)
    savePreference('resourcesTab', next)
  }
  const [order, setOrderState] = useState<Tab[]>(() => parseTabOrder(loadPreference('resourcesTabOrder'), TABS))
  const setOrder = (next: Tab[]) => {
    setOrderState(next)
    savePreference('resourcesTabOrder', JSON.stringify(next))
  }
  const isDefaultOrder = order.every((id, i) => id === TABS[i])
  const [drag, setDrag] = useState<TabDrag | null>(null)

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: Tab) {
    const index = order.indexOf(id)
    // Alt+Shift+←/→: posunout záložku (stejné zkratky jako přesun řádků v plánu).
    if (event.altKey && event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault()
      event.stopPropagation()
      setOrder(moveTab(order, id, index + (event.key === 'ArrowRight' ? 1 : -1)))
      requestAnimationFrame(() => document.getElementById(`resources-tab-${id}`)?.focus())
      return
    }
    // Šipky vlevo / vpravo mezi záložkami (vzor WAI-ARIA Tabs).
    const next =
      event.key === 'ArrowRight' ? order[(index + 1) % order.length] : event.key === 'ArrowLeft' ? order[(index - 1 + order.length) % order.length] : null
    if (!next) return
    event.preventDefault()
    setTab(next)
    document.getElementById(`resources-tab-${next}`)?.focus()
  }

  // --- Tažení záložky myší (vestavěné HTML5 Drag and Drop) ---
  function onDragOver(event: DragEvent<HTMLButtonElement>, over: Tab) {
    if (!drag) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const box = event.currentTarget.getBoundingClientRect()
    const before = event.clientX < box.left + box.width / 2
    // Index v pořadí BEZ tažené záložky (tak ho čeká moveTab).
    const rest = order.filter((x) => x !== drag.id)
    const index = rest.indexOf(over) + (before ? 0 : 1)
    if (over === drag.id) return setDrag({ ...drag, index: null })
    if (index !== drag.index) setDrag({ ...drag, index })
  }
  function onDrop(event: DragEvent) {
    event.preventDefault()
    if (drag && drag.index !== null) setOrder(moveTab(order, drag.id, drag.index))
    setDrag(null)
  }
  /** Kde se kreslí značka vložení: před záložkou s tímto indexem v pořadí bez tažené. */
  const markerBefore = (id: Tab) => {
    if (!drag || drag.index === null || id === drag.id) return false
    return order.filter((x) => x !== drag.id).indexOf(id) === drag.index
  }
  const markerAtEnd = drag !== null && drag.index !== null && drag.index >= order.length - 1

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end gap-2 border-b border-slate-200 px-4 pt-2 dark:border-slate-700">
        <div role="tablist" aria-label={t('resources.tabsLabel')} className="flex gap-1" onDrop={onDrop} onDragOver={(e) => drag && e.preventDefault()}>
          {order.map((id) => (
            <button
              key={id}
              id={`resources-tab-${id}`}
              type="button"
              role="tab"
              draggable
              aria-selected={tab === id}
              aria-controls="resources-panel"
              tabIndex={tab === id ? 0 : -1}
              title={t('resources.tabMoveHint')}
              onClick={() => setTab(id)}
              onKeyDown={(e) => onTabKeyDown(e, id)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', id) // Firefox bez dat tažení nespustí
                setDrag({ id, index: null })
              }}
              onDragOver={(e) => onDragOver(e, id)}
              onDragEnd={() => setDrag(null)}
              className={`-mb-px rounded-t-md border px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                tab === id
                  ? 'border-slate-200 border-b-white bg-white text-blue-700 dark:border-slate-700 dark:border-b-slate-900 dark:bg-slate-900 dark:text-blue-300'
                  : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              } ${drag?.id === id ? 'opacity-50' : ''} ${markerBefore(id) ? 'shadow-[inset_3px_0_0_0_rgb(37_99_235)]' : ''} ${
                markerAtEnd && id === order.filter((x) => x !== drag?.id).at(-1) ? 'shadow-[inset_-3px_0_0_0_rgb(37_99_235)]' : ''
              }`}
            >
              {t(`resources.tabs.${id}`)}
            </button>
          ))}
        </div>
        {!isDefaultOrder && (
          <button
            type="button"
            onClick={() => setOrder([...TABS])}
            title={t('resources.resetTabOrderHint')}
            className="mb-1 ml-auto rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <span aria-hidden="true">↺ </span>
            {t('resources.resetTabOrder')}
          </button>
        )}
      </div>
      <div id="resources-panel" role="tabpanel" aria-labelledby={`resources-tab-${tab}`} className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <p className="mb-3 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{t(`resources.intro.${tab}`)}</p>
        {tab === 'professions' && <ProfessionsTable />}
        {tab === 'workers' && <WorkersTable />}
        {tab === 'departments' && <DepartmentsTable />}
        {tab === 'machines' && <MachinesTable />}
        {tab === 'materials' && <MaterialsTable />}
        {tab === 'costCategories' && <CategoriesTable />}
      </div>
    </div>
  )
}

/** Smazat po potvrzení (N-08); jde vrátit Ctrl+Z. */
function confirmDelete(name: string, run: () => void, t: TFunction) {
  if (window.confirm(t('resources.confirmDelete', { name }))) run()
}

function MaterialsTable() {
  const { t } = useTranslation()
  const materials = useProject((s) => s.project.materials)
  const currency = useProject((s) => s.project.currency)
  const [focusId, setFocusId] = useState<string | null>(null)
  const label = (field: string, item: Material) => t('resources.fieldLabel', { field: t(`resources.columns.${field}`), name: item.name })

  const columns = useMemo<CatalogColumn<Material>[]>(
    () => [
    { key: 'name', header: t('resources.columns.name'), cell: (m) => <NameCell catalog="materials" item={m} label={label('name', m)} /> },
    { key: 'code', header: t('resources.columns.code'), width: '8rem', cell: (m) => <OptionalTextCell catalog="materials" id={m.id} field="code" value={m.code} label={label('code', m)} maxLength={50} /> },
    { key: 'unit', header: t('resources.columns.unit'), width: '6rem', cell: (m) => <RequiredTextCell catalog="materials" id={m.id} field="unit" value={m.unit} label={label('unit', m)} maxLength={20} /> },
    {
      key: 'unitPrice',
      header: t('resources.columns.unitPrice', { currency }),
      width: '10rem',
      align: 'right',
      cell: (m) => <MoneyCell catalog="materials" id={m.id} field="unitPrice" value={m.unitPrice} label={label('unitPrice', m)} />,
    },
    { key: 'category', header: t('resources.columns.category'), width: '10rem', cell: (m) => <CategorySelect catalog="materials" id={m.id} value={m.categoryId} label={label('category', m)} /> },
    { key: 'supplier', header: t('resources.columns.supplier'), width: '12rem', cell: (m) => <OptionalTextCell catalog="materials" id={m.id} field="supplier" value={m.supplier} label={label('supplier', m)} maxLength={200} /> },
    ],
    // Sloupce se mění jen s těmito údaji (label a pomocné funkce závisí jen na t).
    [t, currency],
  )

  function add() {
    const { project, addCatalogItem } = projectStore.getState()
    const categoryId = project.costCategories.find((c) => c.id === defaultCategoryId('material'))?.id ?? project.costCategories[0]?.id
    if (!categoryId) return showNotice(t('resources.error.noCategory'))
    const id = newId()
    const name = uniqueName(t('resources.newName.materials'), project.materials.map((m) => m.name))
    addCatalogItem('materials', { id, name, unit: t('resources.defaultUnit'), unitPrice: 0, categoryId })
    setFocusId(id)
  }

  return (
    <CatalogTable
      caption={t('resources.tabs.materials')}
      items={materials}
      columns={columns}
      addLabel={t('resources.add.materials')}
      emptyText={t('resources.empty.materials')}
      onAdd={add}
      onDelete={(m) => confirmDelete(m.name, () => projectStore.getState().deleteCatalogItem('materials', m.id), t)}
      focusId={focusId}
    />
  )
}

function CategoriesTable() {
  const { t } = useTranslation()
  const categories = useProject((s) => s.project.costCategories)
  const project = useProject((s) => s.project)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const columns = useMemo<CatalogColumn<Category>[]>(
    () => [
    {
      key: 'name',
      header: t('resources.columns.name'),
      cell: (c) => <NameCell catalog="costCategories" item={c} label={t('resources.fieldLabel', { field: t('resources.columns.name'), name: c.name })} />,
    },
    {
      key: 'usage',
      header: t('resources.columns.usage'),
      width: '12rem',
      align: 'right',
      cell: (c) => <span className="px-1.5 tabular-nums text-slate-600 dark:text-slate-400">{t('resources.usageCount', { count: categoryUsage(project, c.id).total })}</span>,
    },
    ],
    // Sloupce se mění jen s těmito údaji (label a pomocné funkce závisí jen na t).
    [t, project],
  )

  function add() {
    const { project: current, addCatalogItem } = projectStore.getState()
    const id = newId()
    addCatalogItem('costCategories', { id, name: uniqueName(t('resources.newName.costCategories'), current.costCategories.map((c) => c.name)) })
    setFocusId(id)
  }

  function remove(category: Category) {
    // Používanou kategorii jde smazat jen s výběrem náhradní (dialog); nepoužívanou po potvrzení.
    if (categoryUsage(projectStore.getState().project, category.id).total > 0) return setDeleting(category)
    confirmDelete(category.name, () => projectStore.getState().deleteCategory(category.id, null), t)
  }

  return (
    <div className="max-w-xl">
      <CatalogTable
        caption={t('resources.tabs.costCategories')}
        items={categories}
        columns={columns}
        addLabel={t('resources.add.costCategories')}
        emptyText={t('resources.empty.costCategories')}
        onAdd={add}
        onDelete={remove}
        focusId={focusId}
      />
      <DeleteCategoryDialog category={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}

/** Fond pracovních dnů pro kalkulace: rok začátku projektu podle kalendáře projektu. */
function useFundDays(): number {
  const calendar = useProject((s) => s.project.calendar)
  const startDate = useProject((s) => s.project.startDate)
  const year = Number(startDate.slice(0, 4))
  return useMemo(() => workingDaysInYear(calendar, year), [calendar, year])
}

/** Kolik pracovníků má každá hodnota údaje (profese, středisko) – spočítá se jednou pro celou tabulku. */
function countBy(workers: Worker[], field: 'professionId' | 'departmentId'): Map<string, number> {
  const counts = new Map<string, number>()
  for (const w of workers) {
    const key = w[field]
    if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** Tlačítko se sazbou: ukáže platnou sazbu a odkud je; kliknutím se otevře dialog sazby. */
function RateButton(props: { rate: number | null; source: string; label: string; onClick: () => void }) {
  const { t, i18n } = useTranslation()
  const currency = useProject((s) => s.project.currency)
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.label}
      title={t('resources.rateHint')}
      className="flex w-full items-center justify-end gap-2 rounded px-1.5 py-0.5 text-right tabular-nums hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700"
    >
      {props.source !== 'none' && <span className="text-xs text-slate-500 dark:text-slate-400">{t(`resources.rateSource.${props.source}`)}</span>}
      <span className={props.rate === null ? 'text-amber-700 dark:text-amber-400' : 'font-medium'}>
        {props.rate === null ? t('resources.noRate') : `${formatMoney(props.rate, currency, i18n.language)} / h`}
      </span>
      <span aria-hidden="true" className="text-slate-400">✎</span>
    </button>
  )
}

function ProfessionsTable() {
  const { t } = useTranslation()
  const professions = useProject((s) => s.project.professions)
  const workers = useProject((s) => s.project.workers)
  const workerCounts = useMemo(() => countBy(workers, 'professionId'), [workers])
  const fundDays = useFundDays()
  const [focusId, setFocusId] = useState<string | null>(null)
  const [rateTarget, setRateTarget] = useState<RateTarget | null>(null)
  const label = (field: string, item: Profession) => t('resources.fieldLabel', { field: t(`resources.columns.${field}`), name: item.name })

  const columns = useMemo<CatalogColumn<Profession>[]>(
    () => [
    { key: 'name', header: t('resources.columns.name'), cell: (p) => <NameCell catalog="professions" item={p} label={label('name', p)} /> },
    { key: 'category', header: t('resources.columns.category'), width: '10rem', cell: (p) => <CategorySelect catalog="professions" id={p.id} value={p.categoryId} label={label('category', p)} /> },
    { key: 'capacity', header: t('resources.columns.capacity'), width: '7rem', align: 'right', cell: (p) => <CapacityCell catalog="professions" id={p.id} value={p.capacityPerDay} label={label('capacity', p)} /> },
    {
      key: 'rate',
      header: t('resources.columns.rate'),
      width: '15rem',
      align: 'right',
      cell: (p) => (
        <RateButton
          rate={professionRate(p, fundDays)}
          source={p.manualRate !== undefined ? 'manual' : p.rateCalc ? 'calc' : 'none'}
          label={label('rate', p)}
          onClick={() => setRateTarget({ catalog: 'professions', id: p.id })}
        />
      ),
    },
    {
      key: 'workers',
      header: t('resources.columns.workers'),
      width: '7rem',
      align: 'right',
      cell: (p) => <span className="px-1.5 tabular-nums text-slate-600 dark:text-slate-400">{workerCounts.get(p.id) ?? 0}</span>,
    },
    ],
    // Sloupce se mění jen s těmito údaji (label a pomocné funkce závisí jen na t).
    [t, fundDays, workerCounts],
  )

  function add() {
    const { project, addCatalogItem } = projectStore.getState()
    const categoryId = project.costCategories.find((c) => c.id === defaultCategoryId('labor'))?.id ?? project.costCategories[0]?.id
    if (!categoryId) return showNotice(t('resources.error.noCategory'))
    const id = newId()
    const name = uniqueName(t('resources.newName.professions'), project.professions.map((p) => p.name))
    addCatalogItem('professions', { id, name, categoryId, capacityPerDay: 8 })
    setFocusId(id)
  }

  function remove(profession: Profession) {
    const names = professionUsage(projectStore.getState().project, profession.id)
    if (names.length > 0) {
      return showNotice(t('resources.error.professionInUse', { name: profession.name, count: names.length, examples: names.slice(0, 3).join(', ') }))
    }
    confirmDelete(profession.name, () => projectStore.getState().deleteCatalogItem('professions', profession.id), t)
  }

  return (
    <>
      <CatalogTable
        caption={t('resources.tabs.professions')}
        items={professions}
        columns={columns}
        addLabel={t('resources.add.professions')}
        emptyText={t('resources.empty.professions')}
        onAdd={add}
        onDelete={remove}
        focusId={focusId}
      />
      <RateDialog target={rateTarget} onClose={() => setRateTarget(null)} />
    </>
  )
}

function WorkersTable() {
  const { t } = useTranslation()
  const workers = useProject((s) => s.project.workers)
  const professions = useProject((s) => s.project.professions)
  const departments = useProject((s) => s.project.departments)
  const fundDays = useFundDays()
  const [focusId, setFocusId] = useState<string | null>(null)
  const [rateTarget, setRateTarget] = useState<RateTarget | null>(null)
  const label = (field: string, item: Worker) => t('resources.fieldLabel', { field: t(`resources.columns.${field}`), name: item.name })
  const byId = useMemo(() => new Map(professions.map((p) => [p.id, p])), [professions])
  const professionOptions = useMemo(() => professions.map((p) => ({ value: p.id, label: p.name })), [professions])
  const departmentOptions = useMemo(
    () => [{ value: '', label: t('resources.noDepartment') }, ...departments.map((d) => ({ value: d.id, label: d.code ? `${d.code} – ${d.name}` : d.name }))],
    [departments, t],
  )

  const columns = useMemo<CatalogColumn<Worker>[]>(
    () => [
    { key: 'name', header: t('resources.columns.workerName'), cell: (w) => <NameCell catalog="workers" item={w} label={label('workerName', w)} /> },
    {
      key: 'profession',
      header: t('resources.columns.profession'),
      width: '13rem',
      cell: (w) => (
        <LazySelect
          label={label('profession', w)}
          value={w.professionId}
          options={professionOptions}
          onChange={(value) => projectStore.getState().updateCatalogItem('workers', w.id, { professionId: value })}
        />
      ),
    },
    {
      key: 'department',
      header: t('resources.columns.department'),
      width: '12rem',
      cell: (w) => (
        <LazySelect
          label={label('department', w)}
          value={w.departmentId ?? ''}
          options={departmentOptions}
          onChange={(value) => projectStore.getState().updateCatalogItem('workers', w.id, { departmentId: value === '' ? undefined : value })}
        />
      ),
    },
    { key: 'capacity', header: t('resources.columns.capacity'), width: '7rem', align: 'right', cell: (w) => <CapacityCell catalog="workers" id={w.id} value={w.capacityPerDay} label={label('capacity', w)} /> },
    {
      key: 'rate',
      header: t('resources.columns.rate'),
      width: '16rem',
      align: 'right',
      cell: (w) => {
        const { rate, source } = effectiveWorkerRate(w, byId.get(w.professionId) ?? {}, fundDays)
        return <RateButton rate={rate} source={source} label={label('rate', w)} onClick={() => setRateTarget({ catalog: 'workers', id: w.id })} />
      },
    },
    ],
    // Sloupce se mění jen s těmito údaji (label a pomocné funkce závisí jen na t).
    [t, byId, professionOptions, departmentOptions, fundDays],
  )

  function add() {
    const { project, addCatalogItem } = projectStore.getState()
    const profession = project.professions[0]
    if (!profession) return showNotice(t('resources.error.noProfession'))
    const id = newId()
    const name = uniqueName(t('resources.newName.workers'), project.workers.map((w) => w.name))
    addCatalogItem('workers', { id, name, professionId: profession.id, capacityPerDay: profession.capacityPerDay })
    setFocusId(id)
  }

  return (
    <>
      <CatalogTable
        caption={t('resources.tabs.workers')}
        items={workers}
        columns={columns}
        addLabel={t('resources.add.workers')}
        emptyText={t(professions.length === 0 ? 'resources.empty.workersNoProfession' : 'resources.empty.workers')}
        onAdd={add}
        onDelete={(w) => confirmDelete(w.name, () => projectStore.getState().deleteCatalogItem('workers', w.id), t)}
        focusId={focusId}
      />
      <RateDialog target={rateTarget} onClose={() => setRateTarget(null)} />
    </>
  )
}

function MachinesTable() {
  const { t } = useTranslation()
  const machines = useProject((s) => s.project.machines)
  const currency = useProject((s) => s.project.currency)
  const [focusId, setFocusId] = useState<string | null>(null)
  const label = (field: string, item: Machine) => t('resources.fieldLabel', { field: t(`resources.columns.${field}`), name: item.name })

  const columns = useMemo<CatalogColumn<Machine>[]>(
    () => [
    { key: 'name', header: t('resources.columns.name'), cell: (m) => <NameCell catalog="machines" item={m} label={label('name', m)} /> },
    { key: 'category', header: t('resources.columns.category'), width: '10rem', cell: (m) => <CategorySelect catalog="machines" id={m.id} value={m.categoryId} label={label('category', m)} /> },
    {
      key: 'machineRate',
      header: t('resources.columns.machineRate', { currency }),
      width: '10rem',
      align: 'right',
      cell: (m) => <MoneyCell catalog="machines" id={m.id} field="rate" value={m.rate} label={label('machineRate', m)} />,
    },
    {
      key: 'rateUnit',
      header: t('resources.columns.rateUnit'),
      width: '8rem',
      cell: (m) => (
        <select
          aria-label={label('rateUnit', m)}
          className="field-select w-full"
          value={m.rateUnit}
          onChange={(e) => projectStore.getState().updateCatalogItem('machines', m.id, { rateUnit: e.target.value as Machine['rateUnit'] })}
        >
          <option value="hour">{t('resources.rateUnit.hour', { currency })}</option>
          <option value="day">{t('resources.rateUnit.day', { currency })}</option>
        </select>
      ),
    },
    { key: 'capacity', header: t('resources.columns.capacity'), width: '7rem', align: 'right', cell: (m) => <CapacityCell catalog="machines" id={m.id} value={m.capacityPerDay} label={label('capacity', m)} /> },
    ],
    // Sloupce se mění jen s těmito údaji (label a pomocné funkce závisí jen na t).
    [t, currency],
  )

  function add() {
    const { project, addCatalogItem } = projectStore.getState()
    const categoryId = project.costCategories.find((c) => c.id === defaultCategoryId('services'))?.id ?? project.costCategories[0]?.id
    if (!categoryId) return showNotice(t('resources.error.noCategory'))
    const id = newId()
    const name = uniqueName(t('resources.newName.machines'), project.machines.map((m) => m.name))
    addCatalogItem('machines', { id, name, categoryId, rate: 0, rateUnit: 'hour', capacityPerDay: 8 })
    setFocusId(id)
  }

  return (
    <CatalogTable
      caption={t('resources.tabs.machines')}
      items={machines}
      columns={columns}
      addLabel={t('resources.add.machines')}
      emptyText={t('resources.empty.machines')}
      onAdd={add}
      onDelete={(m) => confirmDelete(m.name, () => projectStore.getState().deleteCatalogItem('machines', m.id), t)}
      focusId={focusId}
    />
  )
}

function DepartmentsTable() {
  const { t } = useTranslation()
  const departments = useProject((s) => s.project.departments)
  const workers = useProject((s) => s.project.workers)
  const workerCounts = useMemo(() => countBy(workers, 'departmentId'), [workers])
  const [focusId, setFocusId] = useState<string | null>(null)
  const label = (field: string, item: Department) => t('resources.fieldLabel', { field: t(`resources.columns.${field}`), name: item.name })

  const columns = useMemo<CatalogColumn<Department>[]>(
    () => [
    { key: 'code', header: t('resources.columns.code'), width: '8rem', cell: (d) => <OptionalTextCell catalog="departments" id={d.id} field="code" value={d.code} label={label('code', d)} maxLength={50} /> },
    { key: 'name', header: t('resources.columns.name'), cell: (d) => <NameCell catalog="departments" item={d} label={label('name', d)} /> },
    {
      key: 'workers',
      header: t('resources.columns.workers'),
      width: '7rem',
      align: 'right',
      cell: (d) => <span className="px-1.5 tabular-nums text-slate-600 dark:text-slate-400">{workerCounts.get(d.id) ?? 0}</span>,
    },
    ],
    // Sloupce se mění jen s těmito údaji (label a pomocné funkce závisí jen na t).
    [t, workerCounts],
  )

  function add() {
    const { project, addCatalogItem } = projectStore.getState()
    const id = newId()
    addCatalogItem('departments', { id, name: uniqueName(t('resources.newName.departments'), project.departments.map((d) => d.name)) })
    setFocusId(id)
  }

  function remove(department: Department) {
    const names = departmentUsage(projectStore.getState().project, department.id)
    if (names.length > 0) {
      return showNotice(t('resources.error.departmentInUse', { name: department.name, count: names.length, examples: names.slice(0, 3).join(', ') }))
    }
    confirmDelete(department.name, () => projectStore.getState().deleteCatalogItem('departments', department.id), t)
  }

  return (
    <div className="max-w-2xl">
      <CatalogTable
        caption={t('resources.tabs.departments')}
        items={departments}
        columns={columns}
        addLabel={t('resources.add.departments')}
        emptyText={t('resources.empty.departments')}
        onAdd={add}
        onDelete={remove}
        focusId={focusId}
      />
    </div>
  )
}
