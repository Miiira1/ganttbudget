/**
 * Tabulka jednoho číselníku (materiály, kategorie, profese…): řádek = položka,
 * buňky se upravují přímo (EditableCells), vpravo tlačítko Smazat, pod tabulkou Přidat.
 * Obsah sloupců dodává volající (ResourcesView.tsx).
 *
 * Výkon: řádek je memo – po změně jedné položky se překreslí jen její řádek. Volající proto
 * musí sloupce vytvořit přes useMemo (jinak by se při každém překreslení měnily).
 */
import { memo, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export interface CatalogColumn<T> {
  key: string
  header: string
  /** Šířka sloupce (CSS), např. '8rem'. */
  width?: string
  align?: 'left' | 'right'
  cell: (item: T) => ReactNode
}

interface CatalogTableProps<T extends { id: string; name: string }> {
  caption: string
  items: T[]
  columns: CatalogColumn<T>[]
  addLabel: string
  emptyText: string
  onAdd: () => void
  onDelete: (item: T) => void
  /** Položka, jejíž první pole se má zaměřit (po přidání). */
  focusId: string | null
}

export function CatalogTable<T extends { id: string; name: string }>(props: CatalogTableProps<T>) {
  const { t } = useTranslation()
  const { caption, items, columns, addLabel, emptyText, onAdd, onDelete, focusId } = props
  const tableRef = useRef<HTMLTableElement>(null)
  // Stálá funkce pro řádky (aktuální obsluhu čte z ref), aby se memo řádků nerozbíjelo.
  const onDeleteRef = useRef(onDelete)
  onDeleteRef.current = onDelete
  const deleteItem = useCallback((item: { id: string; name: string }) => onDeleteRef.current(item as T), [])

  // Nově přidaná položka: kurzor rovnou do jejího názvu, ať jde hned psát.
  useEffect(() => {
    if (!focusId) return
    const input = tableRef.current?.querySelector<HTMLInputElement>(`tr[data-item-id="${CSS.escape(focusId)}"] input`)
    input?.focus()
    input?.select()
  }, [focusId])

  const th = 'border-b border-slate-300 bg-slate-50 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
  return (
    <div>
      <table ref={tableRef} className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
          <col style={{ width: '2.5rem' }} />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`${th} ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.header}
              </th>
            ))}
            <th scope="col" className={th}>
              <span className="sr-only">{t('resources.delete')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <CatalogRow key={item.id} item={item} columns={columns as CatalogColumn<{ id: string; name: string }>[]} onDelete={deleteItem} />
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p className="px-2 py-4 text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>}
      <button type="button" className="btn-secondary mt-3" onClick={onAdd}>
        <span aria-hidden="true">＋</span> {addLabel}
      </button>
    </div>
  )
}

const CatalogRow = memo(function CatalogRow(props: {
  item: { id: string; name: string }
  columns: CatalogColumn<{ id: string; name: string }>[]
  onDelete: (item: { id: string; name: string }) => void
}) {
  const { t } = useTranslation()
  const { item, columns, onDelete } = props
  return (
    <tr data-item-id={item.id} className="border-b border-slate-200 hover:bg-miro-turquoise-light/30 dark:border-slate-700 dark:hover:bg-slate-800">
      {columns.map((c) => (
        <td key={c.key} className={`px-1 py-0.5 ${c.align === 'right' ? 'text-right' : ''}`}>
          {c.cell(item)}
        </td>
      ))}
      <td className="px-1 text-center">
        <button
          type="button"
          onClick={() => onDelete(item)}
          aria-label={t('resources.deleteLabel', { name: item.name })}
          title={t('resources.deleteLabel', { name: item.name })}
          className="rounded px-1.5 text-slate-500 dark:text-slate-400 hover:bg-red-100 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950 dark:hover:text-red-300"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </td>
    </tr>
  )
})
