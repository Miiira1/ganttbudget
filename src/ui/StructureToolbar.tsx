/** Tlačítka Předsadit / Odsadit / Nahoru / Dolů v liště – pracují s vybranými řádky. */
import { useTranslation } from 'react-i18next'
import { useProject } from '../store/useProject'
import { runStructureCommand, STRUCTURE_COMMANDS, type StructureCommand } from './structureCommands'
import { useSelectedIds } from './viewState'

const ICONS: Record<StructureCommand, string> = { outdent: '⇤', indent: '⇥', moveUp: '↑', moveDown: '↓' }

export function StructureToolbar() {
  const { t } = useTranslation()
  const project = useProject((s) => s.project)
  const count = useSelectedIds(project).length
  return (
    <div role="group" aria-label={t('structure.toolbarLabel')} className="flex flex-wrap items-center gap-1">
      {STRUCTURE_COMMANDS.map((command) => (
        <button
          key={command}
          type="button"
          className="btn-secondary"
          disabled={count === 0}
          title={count === 0 ? t('structure.noSelection') : t(`structure.${command}Hint`)}
          // Kliknutí nesmí vzít zaměření poli v tabulce (pak by se ztratil rozepsaný text).
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runStructureCommand(command, t)}
        >
          <span aria-hidden="true">{ICONS[command]}</span> {t(`structure.${command}`)}
        </button>
      ))}
      {count > 1 && (
        <span role="status" className="ml-1 rounded bg-miro-turquoise-light px-2 py-0.5 text-xs font-medium text-miro-graphite dark:bg-miro-turquoise/20 dark:text-miro-turquoise" title={t('structure.selectedHint')}>
          {t('structure.selectedCount', { count })}
        </span>
      )}
    </div>
  )
}
