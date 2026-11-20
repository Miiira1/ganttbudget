/**
 * Kde v souboru je chyba – lidsky (audit U2, N-09 „nikdy technický výpis“).
 *
 * Kontrola schématem (Zod) hlásí místo chyby technickou cestou, např. "tasks.3.durationDays"
 * (číslováno od 0). Uživateli místo toho ukážeme „u činnosti č. 4“. Název pole se neukazuje –
 * bez znalosti formátu by nic neřekl. Texty jsou v překladech file.where.*.
 */

export type IssueWhereKey =
  | 'task'
  | 'worker'
  | 'profession'
  | 'machine'
  | 'material'
  | 'category'
  | 'department'
  | 'baseline'
  | 'view'
  | 'calendar'
  | 'budget'
  | 'mindMap'
  | 'project'

/** Seznamy v souboru → druh položky (s pořadovým číslem). */
const LISTS: Record<string, IssueWhereKey> = {
  tasks: 'task',
  workers: 'worker',
  professions: 'profession',
  machines: 'machine',
  materials: 'material',
  costCategories: 'category',
  departments: 'department',
  baselines: 'baseline',
  views: 'view',
}
/** Části projektu bez pořadového čísla. */
const PARTS: Record<string, IssueWhereKey> = { calendar: 'calendar', budget: 'budget', mindMap: 'mindMap' }

export function issueWhere(path: string): { key: IssueWhereKey; number: number | null } {
  const [head = '', second] = path.split('.')
  const list = Object.hasOwn(LISTS, head) ? LISTS[head] : undefined
  const index = Number(second)
  if (list && second !== undefined && Number.isInteger(index) && index >= 0) return { key: list, number: index + 1 }
  const part = Object.hasOwn(PARTS, head) ? PARTS[head] : undefined
  return { key: part ?? 'project', number: null }
}
