# GanttBudget

Jednoduchá webová aplikace pro plánování projektů (Ganttův diagram) s navázaným rozpočtem.
Je určená studentům a praktikům bez zkušenosti s projektovým řízením. Běží jen v prohlížeči –
**data zůstávají ve vašem počítači, nic se neposílá na server.**

> Stav: **fáze 4c – všechny typy vazeb.** Termíny se počítají z délek, vazeb FS, SS, FF, SF
> (s prodlevou), omezení „začít nejdříve“ a kalendáře (víkendy, české svátky, odstávky) a zobrazují
> se v tabulce i v Ganttově diagramu. Vazby se zapisují textem (`3SS+2`) nebo kreslí tažením v grafu.
> Činnosti se seskupují do fází (WBS, sbalení, sumarizace), úsečky se v grafu táhnou s přichycením
> na pracovní dny, řádky se přesouvají tlačítky, klávesami i tažením; přehled zkratek otevře F1.
> Vše jde vrátit Ctrl+Z. Ukládání a export přijdou ve fázi 5 (viz [ZADANI.md](ZADANI.md), kap. 8).

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
| `src/gantt/` | výpočty pro graf: časová osa, poloha úseček, trasy šipek, tažení, kreslení vazeb – čisté funkce s testy |
| `src/model/` | formát projektu (schéma Zod), strom fází a přesuny (`hierarchy.ts`), práce s daty a zápis předchůdců |
| `src/store/` | stav aplikace s historií změn (Zpět / Znovu) |
| `src/ui/` | obrazovky a komponenty (React); `src/ui/gantt/` kreslí Ganttův graf (SVG) |
| `src/i18n/` | překlady (`locales/cs.json`, `locales/en.json`) a formát data a čísel |
| `src/samples/` | vzorový projekt „Zavedení automatizace do výroby“ |
| `pruvodce/` | výuková case study – jedna kapitola na fázi vývoje |

## Přidání jazyka

1. Zkopírujte `src/i18n/locales/en.json` pod novým názvem (např. `de.json`) a přeložte texty.
2. Přidejte jeden řádek do pole `LANGUAGES` v `src/i18n/languages.ts`.
3. Spusťte `npm test` – test ověří, že v překladu žádný text nechybí.

## Licence

MIT
