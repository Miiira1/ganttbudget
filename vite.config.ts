import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Content Security Policy (CSP) = pravidla, odkud smí stránka načítat skripty a styly.
 * Aplikace smí používat jen soubory ze své vlastní adresy ('self'), nic odjinud.
 *
 * Vkládá se JEN do produkčního buildu. Vývojový server Vite si do stránky vkládá
 * vlastní pomocné skripty a styly, které by přísná pravidla zablokovala.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'ganttbudget-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineConfig({
  // Relativní cesty, aby aplikace fungovala i v podsložce (GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  build: {
    // Malé obrázky se nesmí vkládat jako inline data do CSS/JS mimo pravidla CSP.
    assetsInlineLimit: 0,
    // Knihovna ExcelJS (export/import XLSX) má cca 0,9 MB. Je v samostatném souboru, který se
    // stáhne až při prvním použití XLSX – proto vyšší limit, ať build zbytečně nevaruje.
    chunkSizeWarningLimit: 1000,
  },
})
