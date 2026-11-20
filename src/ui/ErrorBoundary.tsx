/**
 * Záchytná síť (audit B5): když při vykreslení nastane nečekaná chyba, místo bílé stránky
 * se ukáže srozumitelná hláška s tlačítkem Obnovit. Rozpracovaný projekt zůstává v záloze
 * prohlížeče (autosave) a po obnovení stránky se sám načte.
 *
 * React umí chyby při vykreslení zachytit jen „třídní“ komponentou (getDerivedStateFromError).
 * Texty jsou z překladů jako všude jinde; technický popis chyby se uživateli neukazuje.
 */
import { Component, type ReactNode } from 'react'
import i18n from '../i18n'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    // Jen do konzole prohlížeče (pro ladění) – nic se nikam neodesílá.
    console.error(error)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <main role="alert" className="mx-auto mt-16 max-w-lg rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
        <h1 className="text-lg font-semibold">{i18n.t('crash.title')}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{i18n.t('crash.text')}</p>
        <div className="mt-6 flex justify-center">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            {i18n.t('crash.reload')}
          </button>
        </div>
      </main>
    )
  }
}
