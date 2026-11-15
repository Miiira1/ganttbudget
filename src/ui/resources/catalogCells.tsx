/**
 * Buňky tabulek číselníků: název (povinný a jedinečný), nepovinný text, částka v haléřích
 * a výběr kategorie. Každá změna jde přes úložiště (jeden krok Zpět); neplatný vstup
 * ukáže hlášku a vrátí původní hodnotu.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '../../i18n/format'
import type { CatalogItem } from '../../model/catalogs'
import { formatAmount, parseMoney } from '../../model/money'
import { nameKey, type CatalogKey } from '../../model/schema'
import { projectStore, useProject } from '../../store/useProject'
import { TextCell } from '../EditableCells'
import { showNotice } from '../notice'

const update = <K extends CatalogKey>(key: K, id: string, patch: Partial<CatalogItem<K>>) =>
  projectStore.getState().updateCatalogItem(key, id, patch)

/** Název položky: nesmí být prázdný ani stejný jako jiný v tomto číselníku. */
export function NameCell({ catalog, item, label }: { catalog: CatalogKey; item: { id: string; name: string }; label: string }) {
  const { t } = useTranslation()
  return (
    <TextCell
      value={item.name}
      label={label}
      className="font-medium"
      onCommit={(raw) => {
        const name = raw.trim()
        if (name === '') {
          showNotice(t('resources.error.emptyName'))
          return false
        }
        const list = projectStore.getState().project[catalog] as { id: string; name: string }[]
        if (list.some((x) => x.id !== item.id && nameKey(x.name) === nameKey(name))) {
          showNotice(t('resources.error.duplicateName', { name }))
          return false
        }
        update(catalog, item.id, { name } as never)
      }}
    />
  )
}

/** Nepovinný text (kód, dodavatel…): prázdné pole údaj odstraní. */
export function OptionalTextCell<K extends CatalogKey>(props: {
  catalog: K
  id: string
  field: string
  value: string | undefined
  label: string
  maxLength: number
}) {
  const { t } = useTranslation()
  return (
    <TextCell
      value={props.value ?? ''}
      label={props.label}
      onCommit={(raw) => {
        const value = raw.trim()
        if (value.length > props.maxLength) {
          showNotice(t('resources.error.tooLong', { max: props.maxLength }))
          return false
        }
        update(props.catalog, props.id, { [props.field]: value === '' ? undefined : value } as never)
      }}
    />
  )
}

/** Povinný krátký text (jednotka). */
export function RequiredTextCell<K extends CatalogKey>(props: { catalog: K; id: string; field: string; value: string; label: string; maxLength: number }) {
  const { t } = useTranslation()
  return (
    <TextCell
      value={props.value}
      label={props.label}
      onCommit={(raw) => {
        const value = raw.trim()
        if (value === '' || value.length > props.maxLength) {
          showNotice(t('resources.error.requiredShort', { max: props.maxLength }))
          return false
        }
        update(props.catalog, props.id, { [props.field]: value } as never)
      }}
    />
  )
}

/** Částka v haléřích; píše se jako „1 234,50“. */
export function MoneyCell<K extends CatalogKey>(props: { catalog: K; id: string; field: string; value: number; label: string }) {
  const { t, i18n } = useTranslation()
  return (
    <TextCell
      value={formatAmount(props.value, i18n.language)}
      label={props.label}
      className="text-right tabular-nums"
      onCommit={(raw) => {
        const value = parseMoney(raw)
        if (value === null) {
          showNotice(t('resources.error.invalidMoney'))
          return false
        }
        update(props.catalog, props.id, { [props.field]: value } as never)
      }}
    />
  )
}

/** Desetinné číslo z textu („7,5“ i „7.5“); null = nejde přečíst. */
export function parseDecimal(raw: string): number | null {
  const text = raw.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(text)) return null
  return Number(text)
}

/** Kapacita v hodinách za den: 0,5–24 po půlhodinách. */
export function CapacityCell<K extends CatalogKey>(props: { catalog: K; id: string; value: number; label: string }) {
  const { t, i18n } = useTranslation()
  return (
    <TextCell
      value={formatNumber(props.value, i18n.language)}
      label={props.label}
      className="text-right tabular-nums"
      onCommit={(raw) => {
        const value = parseDecimal(raw)
        if (value === null || value < 0.5 || value > 24 || Math.round(value * 2) !== value * 2) {
          showNotice(t('resources.error.invalidCapacity'))
          return false
        }
        update(props.catalog, props.id, { capacityPerDay: value } as never)
      }}
    />
  )
}

/**
 * Výběr ze seznamu, který vykreslí všechny možnosti až ve chvíli, kdy na něj uživatel najede
 * nebo se do něj dostane klávesnicí. 300 řádků × 300 profesí by jinak bylo 90 000 prvků stránky.
 */
export function LazySelect(props: {
  value: string
  label: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const current = props.options.find((o) => o.value === props.value)
  const shown = expanded ? props.options : current ? [current] : []
  const expand = () => setExpanded(true)
  return (
    <select
      aria-label={props.label}
      className="field-select w-full"
      value={props.value}
      onPointerEnter={expand}
      onFocus={expand}
      onChange={(e) => props.onChange(e.target.value)}
    >
      {shown.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Výběr kategorie nákladů. */
export function CategorySelect<K extends CatalogKey>(props: { catalog: K; id: string; value: string; label: string }) {
  const categories = useProject((s) => s.project.costCategories)
  return (
    <LazySelect
      label={props.label}
      value={props.value}
      options={categories.map((c) => ({ value: c.id, label: c.name }))}
      onChange={(value) => update(props.catalog, props.id, { categoryId: value } as never)}
    />
  )
}
