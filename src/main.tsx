/** Vstupní bod aplikace: nastaví překlady a vzhled a vykreslí hlavní komponentu. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import { applyTheme, loadThemePreference } from './ui/theme'
import App from './ui/App'
import { ErrorBoundary } from './ui/ErrorBoundary'

// Vzhled nastavíme ještě před vykreslením, aby stránka neproblikla světlou barvou.
applyTheme(loadThemePreference())

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      {/* Nečekaná chyba při vykreslení → hláška s tlačítkem Obnovit místo bílé stránky. */}
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}
