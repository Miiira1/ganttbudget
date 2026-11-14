# CLAUDE.md – pravidla projektu GanttBudget

## Zdroj pravdy
- **Na začátku každé práce si přečti `ZADANI.md`.** Je to závazná specifikace (požadavky, stack, datový model, roadmapa).
- Pracuj **jen na fázi, kterou ti zadám**. Nepředbíhej do dalších fází.
- Když zjistíš rozpor nebo mezeru v zadání, upozorni mě a navrhni úpravu. Nic tiše neměň.

## Se kým pracuješ
- Jsem **úplný začátečník** v programování a toto je můj první vibe-codingový projekt.
- Komunikuj **česky**, laicky a stručně: co jsi udělal, proč a jak to mám ověřit. Odborné pojmy krátce vysvětli.
- U každého příkazu do terminálu jednou větou řekni, co udělá.
- Když si nejsi jistý, co chci, **zeptej se**. Nehádej.

## Způsob práce
- **Plán před kódem.** Před každou větší změnou navrhni plán a počkej na moje schválení.
- **Malé kroky.** Jeden krok = jedna viditelná změna, kterou hned ověřím v prohlížeči.
- Po každé dokončené části spusť **build a testy** a popiš, co mám v aplikaci zkontrolovat.
- Hotová fáze končí **commitem** se smysluplným popisem v češtině. Commituj jen na můj pokyn.
- Nezačínej novou fázi, dokud předchozí není ověřená a funkční.
- **Žádné nové knihovny** bez zdůvodnění a mého souhlasu.

## Technická pravidla
- TypeScript (strict) + React + Vite + Tailwind + Zustand. Plný stack je v `ZADANI.md`, kap. 6.
- **Plánovací jádro je čistá funkce nezávislá na UI.** Ke každé změně jádra patří test (Vitest). Testy jádra piš před kódem.
- **Stav aplikace drž s historií změn** (Undo/Redo) od fáze 1.
- **Peníze vždy jako celá čísla v haléřích** (nejmenší jednotce měny). Nikdy float.
- **Data jako ISO dny `YYYY-MM-DD`**, bez časových pásem.
- **Žádný pevný text v UI.** Všechny texty patří do překladových souborů (cs, en).
- Komentáře v kódu a README česky.

## Bezpečnost
- Každý importovaný soubor (JSON, CSV, XLSX, výstup z AI) ověř **schématem Zod** dřív, než se použije.
- Text od uživatele nikdy nevkládej do stránky jako HTML (žádné `dangerouslySetInnerHTML`, `innerHTML`, `eval`).
- Při exportu do CSV/XLSX ošetři buňky začínající `=`, `+`, `-`, `@`, tabulátorem nebo CR (CSV injection).
- **Nepoužívej SheetJS (`xlsx`) z npm.** Pro XLSX používej ExcelJS.
- Do kódu ani do repozitáře nikdy nedávej hesla, klíče ani tokeny.
- Aplikace nic neposílá na server a nepoužívá sledovací nástroje.
- Nikdy nemaž ani nepřepisuj uživatelova data bez varování.
- Po každé fázi navrhni spuštění `npm audit` a bezpečnostní revize.

## Prostředí
- Windows 11, PowerShell 5.1 (bez `&&`; příkazy řetězit `;`). Node.js 24 LTS, npm 11, Git 2.56, VS Code.
- Projekt: `C:\Users\mirek\Documents\Vibe-code\miro-project`. Git repozitář je založen (větev `main`), na GitHubu zatím není.
- Repozitář bude veřejný (GitHub Pages). Git už používá skrytou adresu `…@users.noreply.github.com`; nikdy ji neměň na skutečný e-mail.
