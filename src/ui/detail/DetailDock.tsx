/**
 * Plán nahoře, pod ním panel „Detail činnosti“ (fáze 6b). Panel jde sbalit a jeho výšku změnit
 * tažením vodorovného oddělovače (i šipkami ↑ ↓). Výšku i sbalení si pamatuje prohlížeč.
 * Bez vybrané činnosti (`empty`) zbude jen úzký pruh s nápovědou – plán dostane celou výšku
 * (brand 2.0 – přehlednost); uložené rozbalení se tím nemění.
 */
import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { loadNumberPreference, loadPreference, savePreference } from '../preferences'

const MIN_HEIGHT = 120
const DEFAULT_HEIGHT = 260
const KEY_STEP = 24
/** Panel nesmí zabrat víc než 70 % okna – plán musí zůstat vidět. */
const maxHeight = () => Math.max(MIN_HEIGHT, Math.round(window.innerHeight * 0.7))

export function DetailDock({ plan, header, children, empty = false }: { plan: ReactNode; header: ReactNode; children: ReactNode; empty?: boolean }) {
  const { t } = useTranslation()
  const [height, setHeightState] = useState(() => loadNumberPreference('detailHeight', DEFAULT_HEIGHT, MIN_HEIGHT, 2000))
  const [openPreference, setOpenState] = useState(() => loadPreference('detailOpen') !== 'false')
  const open = openPreference && !empty
  const setHeight = (next: number) => {
    const value = Math.round(Math.min(maxHeight(), Math.max(MIN_HEIGHT, next)))
    setHeightState(value)
    savePreference('detailHeight', String(value))
  }
  const setOpen = (next: boolean) => {
    setOpenState(next)
    savePreference('detailOpen', String(next))
  }

  const [drag, setDrag] = useState<{ startY: number; startHeight: number } | null>(null)
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Zachycení ukazatele nemusí být k dispozici – tažení funguje i bez něj.
    }
    event.preventDefault()
    event.currentTarget.focus()
    setDrag({ startY: event.clientY, startHeight: height })
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (drag) setHeight(drag.startHeight + (drag.startY - event.clientY))
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = { ArrowUp: height + KEY_STEP, ArrowDown: height - KEY_STEP, Home: maxHeight(), End: MIN_HEIGHT }[event.key]
    if (next === undefined) return
    event.preventDefault()
    setHeight(next)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">{plan}</div>
      {open && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('detail.splitter')}
          aria-valuemin={MIN_HEIGHT}
          aria-valuemax={maxHeight()}
          aria-valuenow={height}
          title={t('detail.splitterHint')}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
          onKeyDown={onKeyDown}
          // Dotyk: aktivní plocha ~26 px přes neviditelný přesah, čára zůstane tenká (audit U7).
          className="relative z-10 h-1.5 shrink-0 cursor-row-resize touch-none pointer-coarse:after:absolute pointer-coarse:after:-inset-y-2.5 pointer-coarse:after:inset-x-0 pointer-coarse:after:content-[''] bg-slate-200 hover:bg-miro-turquoise focus:outline-none focus-visible:bg-focus dark:bg-slate-700 dark:hover:bg-miro-turquoise/70"
        />
      )}
      <section
        aria-label={t('detail.title')}
        className="flex shrink-0 flex-col border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        style={open ? { height } : undefined}
      >
        <div className={`flex items-center gap-2 px-3 py-1 ${open ? 'border-b border-slate-200 dark:border-slate-700' : ''}`}>
          {!empty && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              title={t(open ? 'detail.collapse' : 'detail.expand')}
              className="rounded px-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:hover:bg-slate-800"
            >
              <span aria-hidden="true">{open ? '▾' : '▸'}</span>
              <span className="sr-only">{t(open ? 'detail.collapse' : 'detail.expand')}</span>
            </button>
          )}
          <div className="min-w-0 flex-1">{header}</div>
        </div>
        {open && <div className="min-h-0 flex-1 overflow-auto px-3 py-2">{children}</div>}
      </section>
    </div>
  )
}
