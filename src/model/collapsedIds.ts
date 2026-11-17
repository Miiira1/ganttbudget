/**
 * Sbalené fáze v souboru projektu a v záloze (fáze 13c, `Project.collapsedIds`). ČISTÉ FUNKCE s testy.
 *
 * Sbalení je stav zobrazení (ui/viewState.ts) a NEPATŘÍ do historie Zpět – proto ho projekt
 * v aplikaci nikdy neobsahuje. Při uložení souboru nebo zálohy se do projektu „přibalí“
 * (attachCollapsed), po otevření se zase „vybalí“ do stavu zobrazení (detachCollapsed).
 * Ukládají se jen fáze, které v projektu opravdu jsou.
 */
import type { Project } from './schema'

/** Projekt pro uložení: přidá seznam sbalených fází (nebo pole vynechá, když není nic sbalené). */
export function attachCollapsed(project: Project, collapsed: ReadonlySet<string>): Project {
  const { collapsedIds: _old, ...rest } = project
  void _old
  const ids = project.tasks.filter((t) => t.kind === 'phase' && collapsed.has(t.id)).map((t) => t.id)
  return ids.length > 0 ? { ...rest, collapsedIds: ids } : rest
}

/** Otevřený projekt → projekt bez seznamu a množina sbalených fází pro zobrazení. */
export function detachCollapsed(project: Project): { project: Project; collapsed: Set<string> } {
  if (project.collapsedIds === undefined) return { project, collapsed: new Set() }
  const { collapsedIds, ...rest } = project
  const phases = new Set(project.tasks.filter((t) => t.kind === 'phase').map((t) => t.id))
  return { project: rest, collapsed: new Set(collapsedIds.filter((id) => phases.has(id))) }
}
