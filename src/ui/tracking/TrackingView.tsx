/**
 * Pohled Sledování (fáze 9, A-05, G-08): plán vs. skutečnost a Earned Value.
 *  - správa baseline: uložit snímek plánu, vybrat ke srovnání, přejmenovat, smazat (každé = krok Zpět),
 *  - datum stavu (prázdné = dnes), ke kterému se počítá PV, EV a AC,
 *  - dlaždice BAC, PV, EV, AC, SPI, CPI, EAC, VAC; u každé ⓘ s vysvětlením pojmu (U-03)
 *    a krátký výukový box „Jak číst Earned Value“,
 *  - graf PV / AC / EV po týdnech, měsících nebo čtvrtletích a tabulka činností s exportem.
 * Výpočet je v model/earnedValue.ts; tady se jen zobrazuje.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isoToDay } from '../../engine/calendar'
import { formatIsoDate } from '../../i18n/format'
import { evCurves, sampleCurves } from '../../model/earnedValue'
import { wbsNumbers } from '../../model/hierarchy'
import { splitPeriods } from '../../model/periods'
import { activeBaseline, createBaseline } from '../../model/baseline'
import { isValidIsoDate, todayIso } from '../../model/dates'
import { formatMoney } from '../../model/money'
import { BaselineSchema } from '../../model/schema'
import { getCostTimeline, getSchedule, projectStore, useEarnedValue, useProject } from '../../store/useProject'
import { periodLabel } from '../load/loadCells'
import { Kpi } from '../Kpi'
import { loadPreference, savePreference } from '../preferences'
import { Segmented } from '../Segmented'
import { TrackingChart } from './TrackingChart'
import { TrackingTable } from './TrackingTable'
import { exportTracking } from './trackingActions'
import { NameDialog } from '../NameDialog'
import { showNotice } from '../notice'

const TERMS = ['bac', 'pv', 'ev', 'ac', 'spi', 'cpi', 'eac', 'vac'] as const
type Term = (typeof TERMS)[number]
/** Pod touto hodnotou indexu je to opravdový problém (červeně), mezi ní a 1 jen „mírně“. */
const INDEX_ALERT = 0.95
const UNITS = ['week', 'month', 'quarter'] as const
type Unit = (typeof UNITS)[number]

export function TrackingView() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const project = useProject((s) => s.project)
  const ev = useEarnedValue()
  const baseline = activeBaseline(project)
  const [naming, setNaming] = useState<{ mode: 'save' | 'rename'; name: string } | null>(null)
  const [explain, setExplain] = useState<Term | null>(null)
  const store = projectStore.getState()
  const today = todayIso()
  const statusIso = project.statusDate ?? today
  const date = (iso: string) => formatIsoDate(iso, lang)
  const [unit, setUnitState] = useState<Unit>(() => UNITS.find((u) => u === loadPreference('trackingUnit')) ?? 'month')
  const setUnit = (next: Unit) => {
    setUnitState(next)
    savePreference('trackingUnit', next)
  }
  const statusDay = isoToDay(statusIso)
  // Křivky PV a AC; osa od začátku nákladů / skutečnosti po konec (včetně data stavu).
  const curves = useMemo(() => (baseline ? evCurves(project, baseline) : null), [project, baseline])
  const periods = useMemo(() => {
    if (!curves?.range) return []
    return splitPeriods({ startDay: Math.min(curves.range.startDay, statusDay), endDay: Math.max(curves.range.endDay, statusDay) }, unit)
  }, [curves, statusDay, unit])
  const labels = useMemo(() => periods.map((p) => periodLabel(p, unit, t, lang)), [periods, unit, t, lang])
  const samples = useMemo(() => (curves ? sampleCurves(curves, periods, statusDay) : null), [curves, periods, statusDay])
  const wbs = useMemo(() => wbsNumbers(project), [project])

  function saveBaseline(name: string) {
    const p = projectStore.getState().project
    const scheduled = getSchedule(p)
    const data = createBaseline(p, scheduled, getCostTimeline(p), todayIso())
    if (!BaselineSchema.safeParse({ id: 'check', name, ...data }).success) return showNotice(t('tracking.baseline.tooLarge'))
    if (projectStore.getState().saveBaseline(name, data) === null) return showNotice(t('tracking.baseline.limit'))
    if (scheduled.cycleTaskIds.size > 0) showNotice(t('tracking.baseline.cycles', { count: scheduled.cycleTaskIds.size }))
  }

  function submitName(event: FormEvent) {
    event.preventDefault()
    if (!naming) return
    const name = naming.name.trim()
    if (name === '') return
    if (naming.mode === 'save') saveBaseline(name)
    else if (baseline) store.renameBaseline(baseline.id, name)
    setNaming(null)
  }

  const openSave = () => setNaming({ mode: 'save', name: t('tracking.baseline.defaultName', { date: date(today) }) })
  const dialog = (
    <NameDialog
      open={naming !== null}
      title={t(naming?.mode === 'rename' ? 'tracking.baseline.renameTitle' : 'tracking.baseline.saveTitle')}
      name={naming?.name ?? ''}
      label={t('tracking.baseline.name')}
      confirm={t(naming?.mode === 'rename' ? 'tracking.baseline.renameConfirm' : 'tracking.baseline.saveConfirm')}
      hint={t(naming?.mode === 'rename' ? 'tracking.baseline.undo' : 'tracking.baseline.saveHint')}
      onChange={(name) => setNaming((n) => (n ? { ...n, name } : n))}
      onSubmit={submitName}
      onClose={() => setNaming(null)}
    />
  )

  if (project.tasks.length === 0) return <Empty title={t('tracking.noTasksTitle')} text={t('tracking.noTasks')} />
  if (!baseline || !ev) {
    return (
      <>
        <Empty title={t('tracking.emptyTitle')} text={t('tracking.empty')}>
          <button type="button" className="btn-primary mt-4" onClick={openSave}>
            {t('tracking.baseline.save')}
          </button>
        </Empty>
        {dialog}
      </>
    )
  }

  const money = (v: number) => formatMoney(v, project.currency, lang)
  const index = (v: number) => new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
  const { totals } = ev
  const evPct = totals.bac > 0 ? Math.round((totals.ev / totals.bac) * 100) : 0
  const spiHint =
    totals.spi === null ? t('tracking.hint.spiNone') : totals.spi < INDEX_ALERT ? t('tracking.hint.spiLate') : totals.spi < 1 ? t('tracking.hint.spiSlightly') : t('tracking.hint.spiOk')
  const cpiHint =
    totals.cpi === null ? t('tracking.hint.cpiNone') : totals.cpi < INDEX_ALERT ? t('tracking.hint.cpiOver') : totals.cpi < 1 ? t('tracking.hint.cpiSlightly') : t('tracking.hint.cpiOk')
  const info = (term: Term) => ({ label: t('tracking.explain', { term: t(`tracking.terms.${term}.short`) }), pressed: explain === term, onClick: () => setExplain(explain === term ? null : term) })

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Baseline a datum stavu */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <p className="min-w-60 flex-1 self-center text-sm text-slate-600 dark:text-slate-400">{t('tracking.intro')}</p>
        <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          {t('tracking.baseline.label')}
          <select className="field-select" aria-label={t('tracking.baseline.label')} value={baseline.id} onChange={(e) => store.setActiveBaseline(e.target.value)} title={t('tracking.baseline.selectHint')}>
            {project.baselines.map((b) => (
              <option key={b.id} value={b.id}>
                {t('tracking.baseline.option', { name: b.name, date: date(b.savedAt) })}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1">
          <button type="button" className="btn-secondary" onClick={openSave} title={t('tracking.baseline.saveHint')}>
            {t('tracking.baseline.save')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setNaming({ mode: 'rename', name: baseline.name })}>
            {t('tracking.baseline.rename')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              if (window.confirm(t('tracking.baseline.confirmDelete', { name: baseline.name }))) store.deleteBaseline(baseline.id)
            }}
          >
            {t('tracking.baseline.delete')}
          </button>
        </div>
        <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600 dark:text-slate-300" title={t('tracking.statusHint')}>
          {t('tracking.status')}
          <span className="flex items-center gap-1">
            <input
              type="date"
              aria-label={t('tracking.status')}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:border-slate-600 dark:bg-slate-800"
              value={statusIso}
              min="1900-01-01"
              max="2199-12-31"
              onChange={(e) => {
                const value = e.target.value
                if (value === '' || value === today) store.setStatusDate(null)
                else if (isValidIsoDate(value)) store.setStatusDate(value)
              }}
            />
            {project.statusDate !== undefined && (
              <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => store.setStatusDate(null)} title={t('tracking.todayHint')}>
                {t('tracking.today')}
              </button>
            )}
          </span>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {t('tracking.summary', { date: date(statusIso), name: baseline.name, saved: date(baseline.savedAt) })}
          {project.statusDate === undefined && <span className="text-slate-500 dark:text-slate-400"> {t('tracking.statusToday')}</span>}
        </p>

        {/* Ukazatele Earned Value */}
        <div className="mt-2 flex flex-wrap items-stretch gap-2">
          <Kpi label={t('tracking.terms.bac.short')} value={money(totals.bac)} hint={t('tracking.hint.bac')} info={info('bac')} />
          <Kpi label={t('tracking.terms.pv.short')} value={money(totals.pv)} hint={t('tracking.hint.pv', { date: date(statusIso) })} info={info('pv')} />
          <Kpi label={t('tracking.terms.ev.short')} value={money(totals.ev)} hint={t('tracking.hint.ev', { pct: evPct })} info={info('ev')} />
          <Kpi label={t('tracking.terms.ac.short')} value={money(totals.ac)} hint={t('tracking.hint.ac', { date: date(statusIso) })} info={info('ac')} />
          <Kpi label={t('tracking.terms.spi.short')} value={totals.spi === null ? '–' : index(totals.spi)} hint={spiHint} alert={totals.spi !== null && totals.spi < INDEX_ALERT} info={info('spi')} />
          <Kpi label={t('tracking.terms.cpi.short')} value={totals.cpi === null ? '–' : index(totals.cpi)} hint={cpiHint} alert={totals.cpi !== null && totals.cpi < INDEX_ALERT} info={info('cpi')} />
          <Kpi
            label={t('tracking.terms.eac.short')}
            value={totals.eac === null ? '–' : money(totals.eac)}
            hint={totals.eac === null ? t('tracking.hint.eacNone') : t('tracking.hint.eac', { etc: money(totals.etc!) })}
            info={info('eac')}
          />
          <Kpi
            label={t('tracking.terms.vac.short')}
            value={totals.vac === null ? '–' : money(totals.vac)}
            hint={totals.vac === null ? t('tracking.hint.eacNone') : totals.vac < 0 ? t('tracking.hint.vacOver') : t('tracking.hint.vacOk')}
            alert={totals.vac !== null && totals.vac < 0}
            info={info('vac')}
          />
        </div>

        {explain && (
          <div role="note" className="mt-3 max-w-3xl rounded-md border-l-4 border-miro-turquoise-dark bg-miro-turquoise-light/40 px-3 py-2 text-sm dark:border-miro-turquoise dark:bg-slate-800">
            <p className="font-semibold">{t(`tracking.terms.${explain}.name`)}</p>
            <p className="mt-0.5">{t(`tracking.terms.${explain}.text`)}</p>
            <p className="mt-1 text-slate-600 dark:text-slate-400">{t(`tracking.terms.${explain}.formula`)}</p>
          </div>
        )}

        {samples && periods.length > 0 && (
          <section aria-label={t('tracking.chart.label')} className="mt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="text-sm font-semibold">{t('tracking.chart.label')}</h2>
              <div className="ml-auto">
                <Segmented label={t('costs.unit')} options={UNITS} value={unit} onChange={setUnit} text={(u) => t(`costs.units.${u}`)} />
              </div>
            </div>
            <TrackingChart periods={periods} labels={labels} pv={samples.pv} ac={samples.ac} ev={totals.ev} statusDay={statusDay} currency={project.currency} />
          </section>
        )}

        <section aria-label={t('tracking.table.label')} className="mt-4">
          <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-sm font-semibold">{t('tracking.table.label')}</h2>
            <div className="ml-auto flex gap-1">
              <button type="button" className="btn-secondary" onClick={() => void exportTracking('xlsx', ev, wbs, t, lang)} title={t('tracking.export.hint')}>
                {t('analysis.exportXlsx')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => void exportTracking('csv', ev, wbs, t, lang)} title={t('tracking.export.hint')}>
                {t('analysis.exportCsv')}
              </button>
            </div>
          </div>
          <TrackingTable ev={ev} wbs={wbs} currency={project.currency} />
        </section>

        <details className="mt-3 max-w-3xl rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          <summary className="cursor-pointer font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">{t('tracking.learn.title')}</summary>
          <div className="mt-2 space-y-1.5 text-slate-700 dark:text-slate-300">
            <p>{t('tracking.learn.p1')}</p>
            <p>{t('tracking.learn.p2')}</p>
            <p>{t('tracking.learn.p3')}</p>
            <p>{t('tracking.learn.p4')}</p>
          </div>
        </details>
      </div>
      {dialog}
    </div>
  )
}

function Empty({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-lg rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{text}</p>
        {children}
      </div>
    </div>
  )
}
