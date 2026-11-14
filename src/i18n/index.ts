/**
 * Nastavení překladů (knihovna i18next).
 * Všechny texty aplikace jsou v souborech locales/*.json – v kódu nesmí být žádný pevný text.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages'

const STORAGE_KEY = 'ganttbudget.language'

function isSupported(code: string | null | undefined): code is string {
  return !!code && LANGUAGES.some((l) => l.code === code)
}

/** Zvolí jazyk: uložená volba → jazyk prohlížeče → čeština. */
function detectLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isSupported(saved)) return saved
  } catch {
    // Ukládání může být v prohlížeči zakázané.
  }
  const browser = navigator.language?.slice(0, 2)
  return isSupported(browser) ? browser : DEFAULT_LANGUAGE
}

function onLanguageChanged(code: string): void {
  document.documentElement.lang = code
  document.title = i18n.t('app.title')
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // Volba se jen nezapamatuje.
  }
}

i18n.on('languageChanged', onLanguageChanged)

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(LANGUAGES.map((l) => [l.code, { translation: l.translation }])),
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  // React texty sám bezpečně ošetřuje, dvojité ošetření by kazilo uvozovky.
  interpolation: { escapeValue: false },
  initAsync: false,
})

export default i18n
