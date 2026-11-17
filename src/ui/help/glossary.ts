/**
 * Slovníček pojmů (U-03, fáze 10): seznam pojmů rozdělený do oddílů.
 * Texty jsou v překladech: glossary.terms.<pojem>.name / .text, názvy oddílů glossary.sections.<oddíl>.
 * Ukazatele Earned Value (BAC, PV…) mají texty v tracking.terms (používá je i pohled Sledování).
 */

export const GLOSSARY_SECTIONS = [
  { id: 'plan', terms: ['phase', 'milestone', 'wbs', 'duration', 'workingDays', 'dependency', 'linkTypes', 'lag', 'constraint', 'criticalPath', 'slack'] },
  { id: 'resources', terms: ['resource', 'rate', 'load', 'overload'] },
  { id: 'budget', terms: ['costLine', 'costCategory', 'tags', 'costTimeline', 'budgetLimit', 'sCurve', 'cashFlow', 'pivot'] },
  { id: 'tracking', terms: ['percentComplete', 'baseline', 'statusDate', 'actualCost', 'earnedValue'] },
] as const

export type GlossaryTerm = (typeof GLOSSARY_SECTIONS)[number]['terms'][number]

/** Ukazatele Earned Value v pořadí dlaždic pohledu Sledování (texty v tracking.terms). */
export const EV_TERMS = ['bac', 'pv', 'ev', 'ac', 'spi', 'cpi', 'eac', 'vac'] as const

/** Všechny pojmy slovníčku za sebou. */
export const GLOSSARY_TERMS: readonly GlossaryTerm[] = GLOSSARY_SECTIONS.flatMap((s) => s.terms)

/** Texty pojmu pro dlaždici ukazatele (Kpi, vlastnost help). */
export function glossaryHelp(t: (key: string) => string, term: GlossaryTerm): { title: string; text: string } {
  return { title: t(`glossary.terms.${term}.name`), text: t(`glossary.terms.${term}.text`) }
}
