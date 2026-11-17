/**
 * Popisky vedle úseček Ganttova diagramu (např. „Montáž · 3 pracovní dny · 40 %“). ČISTÉ FUNKCE s testy.
 * Uživatel si vybere údaje v panelu „Popisky“; formátování (datum, délka, peníze) dodá volající
 * podle jazyka, takže funkce nezávisí na prohlížeči.
 */

/** Údaje, které jde u úsečky ukázat (v tomto pořadí). WBS, předchůdci a zdroje jsou v tabulce. */
export const BAR_LABEL_FIELDS = ['name', 'dates', 'duration', 'percent', 'cost'] as const
export type BarLabelField = (typeof BAR_LABEL_FIELDS)[number]

export interface BarLabelData {
  name: string
  kind: 'task' | 'phase' | 'milestone'
  start: string
  finish: string
  /** Pracovní dny (u fáze spočítané). */
  durationDays: number
  percent: number
  /** Náklad v haléřích (u fáze včetně podřízených). */
  cost: number
}

export interface BarLabelFormat {
  date: (iso: string) => string
  duration: (days: number) => string
  percent: (percent: number) => string
  money: (amount: number) => string
}

export function barLabelText(data: BarLabelData, fields: readonly BarLabelField[], fmt: BarLabelFormat): string {
  const chosen = new Set(fields)
  const parts: string[] = []
  for (const field of BAR_LABEL_FIELDS) {
    if (!chosen.has(field)) continue
    if (field === 'name') parts.push(data.name)
    else if (field === 'dates') parts.push(data.start === data.finish ? fmt.date(data.finish) : `${fmt.date(data.start)}–${fmt.date(data.finish)}`)
    else if (field === 'duration' && data.kind !== 'milestone') parts.push(fmt.duration(data.durationDays))
    else if (field === 'percent') parts.push(fmt.percent(data.percent))
    else if (field === 'cost' && data.cost > 0) parts.push(fmt.money(data.cost))
  }
  return parts.join(' · ')
}

/** Uložená volba (např. „name,percent“) → platné údaje bez opakování; nic uloženo = jen Název. */
export function parseBarLabelFields(saved: string | null): BarLabelField[] {
  if (saved === null) return ['name']
  const wanted = new Set(saved.split(','))
  return BAR_LABEL_FIELDS.filter((f) => wanted.has(f))
}

export function serializeBarLabelFields(fields: readonly BarLabelField[]): string {
  return BAR_LABEL_FIELDS.filter((f) => fields.includes(f)).join(',')
}

/** Odhad šířky popisku v px (písmo 11 px) – kvůli prodloužení časové osy vpravo. */
export function estimateLabelWidth(text: string): number {
  return Math.ceil(text.length * 6.2)
}

/** Mezera mezi koncem úsečky a popiskem (za kolečkem pro kreslení vazby). */
export const LABEL_GAP = 20

/**
 * Popisky všech řádků s termínem: id → text (prázdné popisky se vynechají).
 * `dates` = spočítané termíny (u fáze i délka), `costOf` = náklad položky v haléřích.
 */
export function buildBarLabels(
  rows: readonly { id: string; name: string; kind: BarLabelData['kind']; durationDays: number }[],
  dates: ReadonlyMap<string, { start: string | null; finish: string | null; durationDays: number | null }>,
  percents: ReadonlyMap<string, number>,
  costOf: (id: string) => number,
  fields: readonly BarLabelField[],
  fmt: BarLabelFormat,
): Map<string, string> {
  const labels = new Map<string, string>()
  if (fields.length === 0) return labels
  for (const row of rows) {
    const d = dates.get(row.id)
    if (!d?.start || !d.finish) continue
    const text = barLabelText(
      {
        name: row.name,
        kind: row.kind,
        start: d.start,
        finish: d.finish,
        durationDays: d.durationDays ?? row.durationDays,
        percent: percents.get(row.id) ?? 0,
        cost: costOf(row.id),
      },
      fields,
      fmt,
    )
    if (text) labels.set(row.id, text)
  }
  return labels
}

/** Kolik místa vpravo potřebuje nejdelší popisek (px) – pro prodloužení osy. */
export function labelsTrailingPx(labels: ReadonlyMap<string, string>): number {
  let max = 0
  for (const text of labels.values()) max = Math.max(max, estimateLabelWidth(text))
  return max === 0 ? 0 : max + LABEL_GAP + 8
}
