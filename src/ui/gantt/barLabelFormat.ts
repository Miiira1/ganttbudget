/** Formátování údajů v popiscích úseček podle jazyka (graf i export používají totéž). */
import type { TFunction } from 'i18next'
import type { BarLabelFormat } from '../../gantt/barLabels'
import { formatIsoDate } from '../../i18n/format'
import { localeFor } from '../../i18n/languages'
import { formatMoneyCompact } from '../../model/money'

const percentFormats = new Map<string, Intl.NumberFormat>()

export function barLabelFormat(t: TFunction, language: string, currency: string): BarLabelFormat {
  let percent = percentFormats.get(language)
  if (!percent) {
    percent = new Intl.NumberFormat(localeFor(language), { style: 'percent', maximumFractionDigits: 0 })
    percentFormats.set(language, percent)
  }
  const pct = percent
  return {
    date: (iso) => formatIsoDate(iso, language),
    duration: (days) => t('gantt.workingDays', { count: days }),
    percent: (value) => pct.format(value / 100),
    money: (amount) => formatMoneyCompact(amount, currency, language),
  }
}
