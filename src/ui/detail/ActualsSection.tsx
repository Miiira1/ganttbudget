/**
 * Část „Skutečné náklady“ v panelu Detail činnosti (fáze 9, A-05 – AC pro Earned Value).
 * Položky k datu: datum, částka, poznámka. Přidat, upravit, smazat – každé jeden krok Zpět.
 * Do Earned Value se počítají jen položky do data stavu (pohled Sledování); budoucí datum je dovolené.
 * Text od uživatele se zobrazuje jen jako text.
 */
import { useTranslation } from 'react-i18next'
import { formatAmount, formatMoney, parseMoney } from '../../model/money'
import { isValidIsoDate, todayIso } from '../../model/dates'
import { MAX_ACTUALS, type ActualCost, type Task } from '../../model/schema'
import { projectStore, useCosts, useProject } from '../../store/useProject'
import { DateInputCell, TextCell } from '../EditableCells'
import { showNotice } from '../notice'

export function ActualsSection({ task }: { task: Task }) {
  const { t, i18n } = useTranslation()
  const currency = useProject((s) => s.project.currency)
  const costs = useCosts()
  const actuals = task.actuals ?? []
  // Fáze se sčítá ze svých činností – vlastní skutečnost ukážeme, jen když ji už má (aby šla smazat).
  if (task.kind === 'phase' && actuals.length === 0) return null

  const money = (v: number) => formatMoney(v, currency, i18n.language)
  const total = actuals.reduce((sum, a) => sum + a.amount, 0)
  const planned = costs.byTask.get(task.id)?.own.total ?? 0
  const full = actuals.length >= MAX_ACTUALS
  const store = projectStore.getState()
  const th = 'border-b border-slate-300 px-1.5 py-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:text-slate-300'

  return (
    <section aria-label={t('actuals.title')} className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <h3 className="font-semibold" title={t('actuals.hint')}>
          {t('actuals.title')}
        </h3>
        <span className="tabular-nums text-slate-700 dark:text-slate-300">
          {t('actuals.total', { amount: money(total) })}
          {planned > 0 && <span className="text-slate-500 dark:text-slate-400"> · {t('actuals.planned', { amount: money(planned) })}</span>}
        </span>
        <button
          type="button"
          className="btn-secondary ml-auto !py-0.5"
          disabled={full}
          title={full ? t('actuals.full', { count: MAX_ACTUALS }) : t('actuals.addHint')}
          onClick={() => store.addActual(task.id, { date: todayIso(), amount: 0 })}
        >
          <span aria-hidden="true">＋</span> {t('actuals.add')}
        </button>
      </div>
      {actuals.length === 0 ? (
        <p className="py-1 text-sm text-slate-500 dark:text-slate-400">{t('actuals.empty')}</p>
      ) : (
        <table className="mt-1 w-full max-w-3xl table-fixed border-collapse text-sm">
          <caption className="sr-only">{t('actuals.caption', { name: task.name })}</caption>
          <colgroup>
            <col style={{ width: '10rem' }} />
            <col style={{ width: '10rem' }} />
            <col />
            <col style={{ width: '2.5rem' }} />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>{t('actuals.columns.date')}</th>
              <th className={`${th} text-right`}>{t('actuals.columns.amount', { currency })}</th>
              <th className={th}>{t('actuals.columns.note')}</th>
              <th className={th}>
                <span className="sr-only">{t('resources.delete')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {actuals.map((a) => (
              <ActualRow key={a.id} taskId={task.id} actual={a} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function ActualRow({ taskId, actual }: { taskId: string; actual: ActualCost }) {
  const { t, i18n } = useTranslation()
  const store = projectStore.getState()
  const label = (field: string) => t('actuals.fieldLabel', { field: t(`actuals.labels.${field}`) })
  return (
    <tr className="border-b border-slate-200 align-middle dark:border-slate-700">
      <td className="px-1 py-0.5">
        <DateInputCell
          value={actual.date}
          label={label('date')}
          onCommit={(value) => {
            if (!isValidIsoDate(value)) return (showNotice(t('table.invalidDate')), false)
            store.updateActual(taskId, actual.id, { date: value })
          }}
        />
      </td>
      <td className="px-1 py-0.5">
        <TextCell
          value={formatAmount(actual.amount, i18n.language)}
          label={label('amount')}
          className="text-right tabular-nums"
          onCommit={(raw) => {
            const value = parseMoney(raw)
            if (value === null) return (showNotice(t('resources.error.invalidMoney')), false)
            store.updateActual(taskId, actual.id, { amount: value })
          }}
        />
      </td>
      <td className="px-1 py-0.5">
        <TextCell
          value={actual.note ?? ''}
          label={label('note')}
          onCommit={(raw) => {
            if (raw.trim().length > 500) return (showNotice(t('actuals.noteTooLong')), false)
            store.updateActual(taskId, actual.id, { note: raw })
          }}
        />
      </td>
      <td className="px-1 text-center">
        <button
          type="button"
          onClick={() => store.deleteActual(taskId, actual.id)}
          aria-label={t('actuals.delete')}
          title={t('actuals.deleteHint')}
          className="rounded px-1.5 text-slate-500 dark:text-slate-400 hover:bg-red-100 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950 dark:hover:text-red-300"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </td>
    </tr>
  )
}
