/**
 * Dialog „Hodinová sazba“ profese nebo pracovníka (Z-04).
 * Tři způsoby: ruční sazba, kalkulace (výpočet je vidět krok po kroku) a – u pracovníka –
 * sazba podle profese. Do projektu se zapíše až tlačítkem Uložit (jeden krok Zpět).
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatHours, formatNumber, formatPercent } from '../../i18n/format'
import { localeFor } from '../../i18n/languages'
import { formatAmount, formatMoney, parseMoney } from '../../model/money'
import { calculateRate, createDefaultRateCalc, professionRate, workingDaysInYear, type RateCalc } from '../../model/rates'
import { projectStore, useProject } from '../../store/useProject'
import { parseDecimal } from './catalogCells'

export interface RateTarget {
  catalog: 'professions' | 'workers'
  id: string
}

type Mode = 'manual' | 'calc' | 'profession'

/** Pole formuláře jako text (uživatel může psát i rozepsané hodnoty). */
interface Draft {
  manualRate: string
  monthlyWage: string
  contributionsPct: string
  overheadMode: 'annual' | 'percent'
  overheadValue: string
  vacationDays: string
  sickDays: string
  hoursPerDay: string
  productivityPct: string
}

const fieldClass =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-[invalid=true]:border-red-500 dark:border-slate-600 dark:bg-slate-800'

function toDraft(calc: RateCalc, manualRate: number | undefined, lang: string): Draft {
  const num = (n: number) => n.toLocaleString(localeFor(lang), { maximumFractionDigits: 2 })
  return {
    manualRate: manualRate === undefined ? '' : formatAmount(manualRate, lang),
    monthlyWage: formatAmount(calc.monthlyWage, lang),
    contributionsPct: num(calc.contributionsPct),
    overheadMode: calc.overheadMode,
    overheadValue: calc.overheadMode === 'annual' ? formatAmount(calc.overheadValue, lang) : num(calc.overheadValue),
    vacationDays: String(calc.vacationDays),
    sickDays: String(calc.sickDays),
    hoursPerDay: num(calc.hoursPerDay),
    productivityPct: num(calc.productivityPct),
  }
}

/** Text formuláře → kalkulace; null u pole, které nejde přečíst nebo je mimo rozsah. */
function fromDraft(d: Draft): { calc: RateCalc | null; invalid: Set<keyof Draft> } {
  const invalid = new Set<keyof Draft>()
  const decimal = (field: keyof Draft, min: number, max: number) => {
    const value = parseDecimal(d[field] as string)
    if (value === null || value < min || value > max) invalid.add(field)
    return value ?? 0
  }
  const integer = (field: keyof Draft, max: number) => {
    const value = Number((d[field] as string).trim())
    if (!Number.isInteger(value) || value < 0 || value > max || (d[field] as string).trim() === '') invalid.add(field)
    return value
  }
  const money = (field: keyof Draft) => {
    const value = parseMoney(d[field] as string)
    if (value === null) invalid.add(field)
    return value ?? 0
  }
  const calc: RateCalc = {
    monthlyWage: money('monthlyWage'),
    contributionsPct: decimal('contributionsPct', 0, 100),
    overheadMode: d.overheadMode,
    overheadValue: d.overheadMode === 'annual' ? money('overheadValue') : decimal('overheadValue', 0, 1000),
    vacationDays: integer('vacationDays', 366),
    sickDays: integer('sickDays', 366),
    hoursPerDay: decimal('hoursPerDay', 0.5, 24),
    productivityPct: decimal('productivityPct', 0, 100),
  }
  return { calc: invalid.size === 0 ? calc : null, invalid }
}

export function RateDialog({ target, onClose }: { target: RateTarget | null; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const project = useProject((s) => s.project)
  const item = target ? project[target.catalog].find((x) => x.id === target.id) : undefined
  const profession =
    target?.catalog === 'workers' && item && 'professionId' in item ? project.professions.find((p) => p.id === item.professionId) : undefined
  const year = Number(project.startDate.slice(0, 4))
  const fundDays = workingDaysInYear(project.calendar, year)

  const [mode, setMode] = useState<Mode>('calc')
  const [draft, setDraft] = useState<Draft>(() => toDraft(createDefaultRateCalc(), undefined, lang))
  const [showErrors, setShowErrors] = useState(false)

  // Při otevření: načíst údaje položky do formuláře.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (target && item) {
      // Pracovník bez vlastní kalkulace začne s kalkulací své profese (jen jako předvyplnění).
      const calc = item.rateCalc ?? profession?.rateCalc ?? createDefaultRateCalc()
      setDraft(toDraft(calc, item.manualRate, lang))
      setMode(item.manualRate !== undefined ? 'manual' : item.rateCalc ? 'calc' : target.catalog === 'workers' ? 'profession' : 'calc')
      setShowErrors(false)
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) dialog.close()
    // Spouští se jen při otevření pro jinou položku.
  }, [target?.id, target?.catalog])

  const { calc, invalid } = fromDraft(draft)
  const result = calc ? calculateRate(calc, fundDays) : null
  const manual = parseMoney(draft.manualRate)
  const inheritedRate = profession ? professionRate(profession, fundDays) : null

  function save(event: FormEvent) {
    event.preventDefault()
    if (!target || !item) return
    let patch: { manualRate?: number; rateCalc?: RateCalc }
    if (mode === 'manual') {
      if (manual === null) return setShowErrors(true)
      patch = { manualRate: manual, rateCalc: item.rateCalc }
    } else if (mode === 'calc') {
      if (!calc || !result?.ok) return setShowErrors(true)
      patch = { manualRate: undefined, rateCalc: calc }
    } else patch = { manualRate: undefined, rateCalc: undefined }
    projectStore.getState().updateCatalogItem(target.catalog, target.id, patch as never)
    onClose()
  }

  const set = (field: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [field]: value }))
  const money = (h: number) => formatMoney(h, project.currency, lang)
  const field = (name: keyof Draft, unit: string) => (
    <label className="grid grid-cols-[1fr_7.5rem_4rem] items-center gap-2 text-sm">
      <span>{t(`rate.fields.${name}`)}</span>
      <input
        type="text"
        inputMode="decimal"
        className={fieldClass}
        value={draft[name] as string}
        aria-invalid={showErrors && invalid.has(name)}
        onChange={(e) => set(name)(e.target.value)}
      />
      <span className="text-slate-500 dark:text-slate-400">{unit}</span>
    </label>
  )
  const modes: Mode[] = target?.catalog === 'workers' ? ['profession', 'calc', 'manual'] : ['calc', 'manual']

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(52rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
    >
      {item && (
        <form className="p-5" onSubmit={save}>
          <h2 id={titleId} className="text-lg font-semibold">
            {t('rate.title', { name: item.name })}
          </h2>
          <fieldset className="mt-3 flex flex-wrap gap-4 text-sm">
            <legend className="sr-only">{t('rate.modeLabel')}</legend>
            {modes.map((m) => (
              <label key={m} className="flex items-center gap-1.5">
                <input type="radio" name="rate-mode" checked={mode === m} onChange={() => setMode(m)} />
                {t(`rate.mode.${m}`)}
              </label>
            ))}
          </fieldset>

          {mode === 'profession' && (
            <p className="mt-4 text-sm">
              {inheritedRate === null
                ? t('rate.professionNoRate', { profession: profession?.name ?? '' })
                : t('rate.professionRate', { profession: profession?.name ?? '', rate: money(inheritedRate) })}
            </p>
          )}

          {mode === 'manual' && (
            <div className="mt-4 max-w-sm">
              <label className="grid grid-cols-[1fr_7.5rem_4rem] items-center gap-2 text-sm">
                <span>{t('rate.fields.manualRate')}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className={fieldClass}
                  value={draft.manualRate}
                  aria-invalid={showErrors && manual === null}
                  onChange={(e) => set('manualRate')(e.target.value)}
                />
                <span className="text-slate-500 dark:text-slate-400">{t('rate.perHour', { currency: project.currency })}</span>
              </label>
            </div>
          )}

          {mode === 'calc' && (
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                {field('monthlyWage', project.currency)}
                {field('contributionsPct', '%')}
                <label className="grid grid-cols-[1fr_7.5rem_4rem] items-center gap-2 text-sm">
                  <span>{t('rate.fields.overheadMode')}</span>
                  <select
                    className="field-select"
                    value={draft.overheadMode}
                    onChange={(e) => setDraft((d) => ({ ...d, overheadMode: e.target.value as Draft['overheadMode'], overheadValue: '0' }))}
                  >
                    <option value="percent">{t('rate.overhead.percent')}</option>
                    <option value="annual">{t('rate.overhead.annual')}</option>
                  </select>
                  <span />
                </label>
                {field('overheadValue', draft.overheadMode === 'percent' ? '%' : t('rate.perYear', { currency: project.currency }))}
                {field('vacationDays', t('rate.days'))}
                {field('sickDays', t('rate.days'))}
                {field('hoursPerDay', 'h')}
                {field('productivityPct', '%')}
              </div>

              {/* Výpočet krok po kroku */}
              <div className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">
                <h3 className="font-semibold">{t('rate.steps.title')}</h3>
                {result?.ok ? (
                  <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 tabular-nums">
                    <dt>{t('rate.steps.annualWage')}</dt>
                    <dd className="text-right">{money(result.annualWage)}</dd>
                    <dt>+ {t('rate.steps.contributions')}</dt>
                    <dd className="text-right">{money(result.contributions)}</dd>
                    <dt>+ {t('rate.steps.overhead')}</dt>
                    <dd className="text-right">{money(result.overhead)}</dd>
                    <dt className="border-t border-slate-300 pt-1 font-semibold dark:border-slate-600">= {t('rate.steps.annualCost')}</dt>
                    <dd className="border-t border-slate-300 pt-1 text-right font-semibold dark:border-slate-600">{money(result.annualCost)}</dd>
                    <dt className="pt-2">{t('rate.steps.fund', { year })}</dt>
                    <dd className="pt-2 text-right">{t('rate.daysCount', { count: result.fundDays })}</dd>
                    <dt>− {t('rate.steps.absence')}</dt>
                    <dd className="text-right">{t('rate.daysCount', { count: result.fundDays - result.availableDays })}</dd>
                    <dt>× {t('rate.steps.hoursAndProductivity')}</dt>
                    <dd className="text-right">{`${formatHours(calc!.hoursPerDay, lang, 2)} × ${formatPercent(calc!.productivityPct, lang, 2)}`}</dd>
                    <dt className="border-t border-slate-300 pt-1 font-semibold dark:border-slate-600">= {t('rate.steps.productiveHours')}</dt>
                    <dd className="border-t border-slate-300 pt-1 text-right font-semibold dark:border-slate-600">
                      {formatNumber(result.productiveHours, lang)} h
                    </dd>
                    <dt className="pt-2 text-base font-bold text-slate-900 dark:text-miro-yellow">{t('rate.steps.rate')}</dt>
                    <dd className="pt-2 text-right text-base font-bold text-slate-900 dark:text-miro-yellow">
                      {money(result.rate)} / h
                    </dd>
                  </dl>
                ) : (
                  <p className="mt-2 text-red-700 dark:text-red-300">{calc ? t('rate.error.noProductiveHours') : t('rate.error.invalidFields')}</p>
                )}
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('rate.steps.note')}</p>
              </div>
            </div>
          )}

          {showErrors && (
            <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
              {t('rate.error.fixFields')}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('rate.cancel')}
            </button>
            <button type="submit" className="btn-primary">
              {t('rate.save')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
