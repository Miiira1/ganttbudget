/** Vstupní bod aplikace: nastaví překlady a vzhled a vykreslí hlavní komponentu. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import { applyTheme, loadThemePreference } from './ui/theme'
import App from './ui/App'

// Vzhled nastavíme ještě před vykreslením, aby stránka neproblikla světlou barvou.
applyTheme(loadThemePreference())

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
