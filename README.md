# GanttBudget

Jednoduchá webová aplikace pro plánování projektů (Ganttův diagram) s navázaným rozpočtem.
Je určená studentům a praktikům bez zkušenosti s projektovým řízením. Běží jen v prohlížeči –
**data zůstávají ve vašem počítači, nic se neposílá na server.**

> Stav: **fáze 2 – kalendář a plánovací jádro.** Termíny se počítají z délek, vazeb FS a kalendáře
> (víkendy, české svátky, odstávky). Graf, další typy vazeb a ukládání přijdou v dalších fázích
> (viz [ZADANI.md](ZADANI.md), kap. 8).

## Co je potřeba

- [Node.js](https://nodejs.org/) 24 LTS (obsahuje i `npm`)

## Spuštění na vlastním počítači

```powershell
npm install        # jednou: stáhne knihovny podle package-lock.json
npm run dev        # spustí vývojovou verzi na http://localhost:5173
```

## Další příkazy

| Příkaz | Co udělá |
|---|---|
| `npm test` | spustí automatické testy |
| `npm run build` | zkontroluje typy a vyrobí hotový web do složky `dist/` |
| `npm run preview` | spustí hotový web z `dist/` (i s bezpečnostními pravidly CSP) na http://localhost:4173 |
| `npm audit` | zkontroluje známé zranitelnosti knihoven |

## Struktura kódu

| Složka | Obsah |
|---|---|
| `src/engine/` | plánovací jádro: kalendář (svátky, pracovní dny) a výpočet termínů – čisté funkce s testy |
| `src/model/` | formát projektu (schéma Zod), práce s daty a zápis předchůdců |
| `src/store/` | stav aplikace s historií změn (Zpět / Znovu) |
| `src/ui/` | obrazovky a komponenty (React) |
| `src/i18n/` | překlady (`locales/cs.json`, `locales/en.json`) a formát data a čísel |
| `src/samples/` | vzorový projekt „Zavedení automatizace do výroby“ |
| `pruvodce/` | výuková case study – jedna kapitola na fázi vývoje |

## Přidání jazyka

1. Zkopírujte `src/i18n/locales/en.json` pod novým názvem (např. `de.json`) a přeložte texty.
2. Přidejte jeden řádek do pole `LANGUAGES` v `src/i18n/languages.ts`.
3. Spusťte `npm test` – test ověří, že v překladu žádný text nechybí.

## Licence

MIT
