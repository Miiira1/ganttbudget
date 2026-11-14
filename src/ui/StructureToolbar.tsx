/** Tlačítka Předsadit / Odsadit / Nahoru / Dolů v liště – pracují s vybraným řádkem. */
import { useTranslation } from 'react-i18next'
import { useProject } from '../store/useProject'
import { runStructureCommand, STRUCTURE_COMMANDS, type StructureCommand } from './structureCommands'
import { useSelectedId } from './viewState'

const ICONS: Record<StructureCommand, string> = { outdent: '⇤', indent: '⇥', moveUp: '↑', moveDown: '↓' }

export function StructureToolbar() {
  const { t } = useTranslation()
  const project = useProject((s) => s.project)
  const selectedId = useSelectedId(project)
  return (
    <div role="group" aria-label={t('structure.toolbarLabel')} className="flex flex-wrap gap-1">
      {STRUCTURE_COMMANDS.map((command) => (
        <button
          key={command}
          type="button"
          className="btn-secondary"
          disabled={selectedId === null}
          title={selectedId === null ? t('structure.noSelection') : t(`structure.${command}Hint`)}
          // Kliknutí nesmí vzít zaměření poli v tabulce (pak by se ztratil rozepsaný text).
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runStructureCommand(command, t)}
        >
          <span aria-hidden="true">{ICONS[command]}</span> {t(`structure.${command}`)}
        </button>
      ))}
    </div>
  )
}
