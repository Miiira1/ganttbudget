/**
 * Výpočty pro tažení úseček v grafu (G-02) – čisté funkce, testy v drag.test.ts.
 *
 * Z toho, o kolik dní uživatel úsečku posunul, spočítají nové omezení „začít nejdříve k datu“
 * a délku. Pohyb se přichytává na pracovní dny podle kalendáře projektu:
 *  - posun ('move'):    začátek = nejbližší pracovní den od posunutého začátku, délka zůstane,
 *  - pravý okraj ('end'): konec = předchozí pracovní den od posunutého konce (nejdřív v den začátku),
 *  - levý okraj ('start'): začátek = další pracovní den od posunutého začátku (nejpozději v den konce),
 *                          konec zůstane, délka se dopočítá.
 * Milník nemá délku, proto se vždy jen posouvá.
 */
import type { WorkCalendar } from '../engine/calendar'
import { dayToIso } from '../engine/calendar'

export type DragMode = 'move' | 'start' | 'end'

export interface DragInput {
  mode: DragMode
  kind: 'task' | 'milestone'
  /** Spočítaný začátek a konec před tažením (čísla dnů). */
  startDay: number
  finishDay: number
  /** Délka v pracovních dnech před tažením. */
  durationDays: number
  /** O kolik kalendářních dnů se myš posunula. */
  deltaDays: number
}

export interface DragResult {
  /** Nové omezení „začít nejdříve“ ("YYYY-MM-DD"); undefined = nemění se (pravý okraj). */
  constraintStart?: string
  durationDays: number
  /** Náhled: kde úsečka bude (bez ohledu na vazby – ty uplatní až jádro). */
  startDay: number
  finishDay: number
}

/** Posun myši v pixelech → celé dny. */
export function pixelsToDays(deltaX: number, dayWidth: number): number {
  return Math.round(deltaX / dayWidth)
}

/**
 * Délka podle Konce zadaného v tabulce: pracovní dny od začátku do konce včetně.
 * Konec ve volný den se bere jako předchozí pracovní den. Konec před začátkem → null.
 */
export function durationForFinish(calendar: WorkCalendar, startDay: number, finishDay: number): number | null {
  if (finishDay < startDay) return null
  const finish = calendar.previousWorkingDay(finishDay)
  return finish < startDay ? null : calendar.countWorkingDays(startDay, finish)
}

/** Konec činnosti, která začíná `start` a trvá `duration` pracovních dnů (milník: týž den). */
function finishOf(calendar: WorkCalendar, start: number, duration: number): number {
  return duration <= 0 ? start : calendar.addWorkingDays(start, duration - 1)
}

export function applyDrag(calendar: WorkCalendar, input: DragInput): DragResult {
  const { kind, startDay, finishDay, durationDays, deltaDays } = input
  const mode: DragMode = kind === 'milestone' ? 'move' : input.mode

  if (mode === 'move') {
    const start = calendar.nextWorkingDay(startDay + deltaDays)
    return { constraintStart: dayToIso(start), durationDays, startDay: start, finishDay: finishOf(calendar, start, durationDays) }
  }

  if (mode === 'end') {
    const finish = Math.max(startDay, calendar.previousWorkingDay(finishDay + deltaDays))
    return { durationDays: calendar.countWorkingDays(startDay, finish), startDay, finishDay: finish }
  }

  // Levý okraj: začátek se hýbe, konec zůstává.
  const start = Math.min(calendar.nextWorkingDay(startDay + deltaDays), finishDay)
  return {
    constraintStart: dayToIso(start),
    durationDays: calendar.countWorkingDays(start, finishDay),
    startDay: start,
    finishDay,
  }
}

/** Úsečka ve skupině, kterou uživatel táhne najednou (hromadný výběr). */
export interface GroupDragItem {
  id: string
  kind: 'task' | 'milestone'
  startDay: number
  finishDay: number
  durationDays: number
}

/**
 * Posun více vybraných úseček najednou: tažená (`primaryId`) se posune stejně jako sama
 * (přichycení na pracovní den); ostatní o STEJNÝ POČET PRACOVNÍCH DNŮ, délky se nemění.
 * Každá dostane omezení „začít nejdříve“. Bez posunu vrátí prázdnou mapu.
 */
export function applyGroupMove(
  calendar: WorkCalendar,
  items: GroupDragItem[],
  primaryId: string,
  deltaDays: number,
): Map<string, DragResult> {
  const results = new Map<string, DragResult>()
  const primary = items.find((x) => x.id === primaryId)
  if (!primary || deltaDays === 0) return results
  const moved = applyDrag(calendar, { ...primary, mode: 'move', deltaDays })
  // O kolik pracovních dnů se tažená posunula (její začátek je vždy pracovní den).
  const from = primary.startDay
  const to = moved.startDay
  const shift = to >= from ? calendar.countWorkingDays(from, to) - 1 : -(calendar.countWorkingDays(to, from) - 1)
  if (shift === 0 && to === from) return results
  for (const item of items) {
    if (item.id === primaryId) {
      results.set(item.id, moved)
      continue
    }
    const start = calendar.addWorkingDays(item.startDay, shift)
    results.set(item.id, {
      constraintStart: dayToIso(start),
      durationDays: item.durationDays,
      startDay: start,
      finishDay: finishOf(calendar, start, item.durationDays),
    })
  }
  return results
}
