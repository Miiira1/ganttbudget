/**
 * Obal mobilní verze (jen prohlížení, displej pod 768 px):
 *  - úzké záhlaví: symbol loga, název projektu a stručné údaje, ⚙ Zobrazení a menu ⋯,
 *  - obsah pohledu přes celou šířku,
 *  - spodní lišta pohledů pro palec (Plán, Náklady, Sledování, Analýza, Mapa).
 * Upravovat se na telefonu nedá – k tomu je „Plná verze“ v menu ⋯ nebo počítač.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import symbolOnLight from '../../assets/brand/miro-symbol-color-on-light.svg'
import symbolOnDark from '../../assets/brand/miro-symbol-color-on-dark.svg'
import { DisplaySettings, HelpMenu, type HelpMenuItem } from '../HeaderMenus'
import { AnalysisIcon, CostsIcon, MindMapIcon, PlanIcon, TrackingIcon } from '../icons'
import { MOBILE_VIEWS, type MobileView } from './layout'
import { ReadOnlyContext } from '../readOnly'

const ICONS: Record<MobileView, () => ReactNode> = {
  plan: () => <PlanIcon />,
  costs: () => <CostsIcon />,
  tracking: () => <TrackingIcon />,
  analysis: () => <AnalysisIcon />,
  mindmap: () => <MindMapIcon />,
}

interface MobileShellProps {
  projectName: string
  /** Stručné údaje pod názvem (termíny, náklady). */
  meta: string
  dirty: boolean
  view: MobileView
  onView: (view: MobileView) => void
  menuItems: HelpMenuItem[]
  /** Obsah panelu ⚙ Zobrazení (jazyk, vzhled). */
  settings: ReactNode
  /** Lišta upozornění (stejná jako v plné verzi). */
  notice: ReactNode
  children: ReactNode
}

export function MobileShell(props: MobileShellProps) {
  const { t } = useTranslation()
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white/60 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40">
        <h1 className="shrink-0">
          <img src={symbolOnLight} alt={t('app.title')} className="h-8 w-auto dark:hidden" />
          <img src={symbolOnDark} alt={t('app.title')} className="hidden h-8 w-auto dark:block" />
        </h1>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-baseline gap-1.5 text-sm font-medium">
            <span className="truncate">{props.projectName}</span>
            {props.dirty && (
              <span className="shrink-0 text-miro-gold dark:text-miro-yellow" title={t('file.unsavedHint')}>
                <span aria-hidden="true">●</span>
                <span className="sr-only">{t('file.unsaved')}</span>
              </span>
            )}
          </p>
          <p className="truncate text-xs text-slate-600 dark:text-slate-400">{props.meta}</p>
        </div>
        <DisplaySettings>{props.settings}</DisplaySettings>
        <HelpMenu
          label={t('mobile.menu')}
          title={t('mobile.menuHint')}
          button={<span aria-hidden="true" className="px-0.5 text-base leading-none">⋯</span>}
          items={props.menuItems}
        />
      </header>

      {props.notice}

      <main id="obsah" tabIndex={-1} className="min-h-0 flex-1 overflow-auto focus:outline-none">
        <ReadOnlyContext.Provider value={true}>{props.children}</ReadOnlyContext.Provider>
      </main>

      {/* Spodní lišta pohledů – velké cíle pro palec, aktivní pohled se žlutou čárou a podkladem. */}
      <nav
        aria-label={t('mobile.navLabel')}
        className="grid grid-cols-5 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MOBILE_VIEWS.map((id) => {
          const active = props.view === id
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => props.onView(id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-[3px] px-1 text-[11px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus ${
                active
                  ? 'border-miro-yellow bg-miro-yellow-light/45 text-miro-graphite dark:bg-miro-yellow/15 dark:text-miro-paper'
                  : 'border-transparent text-slate-600 dark:text-slate-400'
              }`}
            >
              {ICONS[id]()}
              <span className="max-w-full truncate">{t(`view.${id}`)}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
