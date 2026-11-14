# KONTEXT projektu MiRo Project

> ⚠️ **ZASTARALÉ (14. 11. 2026).** Platí `ZADANI.md` (v1.1) a `CLAUDE.md`. Tento soubor je jen historický záznam
> úvodní konzultace. Kde se s nimi rozchází (např. „lokální aplikace“, číslování fází), řiď se `ZADANI.md`.

> Tento soubor předává kontext z úvodní konzultace do nových session Claude Code.
> **Claude: přečti si ho celý na začátku každé nové session.**

---

## 1. Kdo jsem a jak se mnou pracovat

- Jsem **úplný začátečník** v programování, toto je můj **první vibe-codingový projekt**.
- Komunikuj **česky**, srozumitelně, bez zbytečného žargonu. Odborné pojmy krátce vysvětli.
- **Před každou větší změnou navrhni plán a počkej na moje schválení.**
- Postupuj **po malých krocích**: jeden krok = jedna funkce = jeden commit.
- Když navrhuješ příkaz do terminálu, stručně vysvětli, co udělá.
- Nepřidávej nové knihovny bez mého souhlasu a zdůvodnění.
- Pokud si nejsi jistý, co chci, **zeptej se**, nehádej.

## 2. Cíl projektu

Aplikace pro tvorbu **projektových Ganttových diagramů** a na ně **navázaných projektových rozpočtů**.

Požadované vlastnosti:
- **transparentně strukturovaná** (přehledný kód, dokumentace, čitelná historie),
- **uživatelsky přívětivá** (česky, intuitivní ovládání),
- **maximálně bezpečná** (absolutní bezpečnost neexistuje, cílem je minimalizovat rizika).

## 3. Stav přípravy prostředí (Fáze 0 – HOTOVO)

| Nástroj | Stav |
|---|---|
| Operační systém | Windows 11, PowerShell 5.1 |
| Git | 2.56.0, nastavené jméno i e-mail |
| Node.js | v24.22.1 (LTS) |
| npm | 11.19.1 |
| PowerShell Execution Policy | `RemoteSigned` pro CurrentUser (kvůli npm) |
| VS Code | 1.143.1 |
| GitHub | účet založen, zapnuté 2FA; **repozitář zatím nezaložen** (bude Private) |
| Složka projektu | `C:\Users\mirek\Documents\Vibe-code\miro-project` (mimo ownCloud) |

Git repozitář v této složce ještě **není inicializován** (`git init` zatím neproběhl).

## 4. Plán fází projektu

| Fáze | Obsah | Stav |
|---|---|---|
| 0 | Příprava prostředí | ✅ hotovo |
| 1 | **Zadání – SPEC.md** (Claude mě v plánovacím režimu zpovídá) | ⏭️ **další krok** |
| 2 | Architektura a technologie, datový model | čeká |
| 3 | `CLAUDE.md` – trvalá pravidla projektu (`/init` + doplnění) | čeká |
| 4 | Vývoj po milnících M1–M8 | čeká |
| 5 | Testování (zejména výpočty rozpočtu) | průběžně |
| 6 | Bezpečnost (`/security-review`, `npm audit`, …) | průběžně |
| 7 | Uživatelská přívětivost, test s 2–3 lidmi | čeká |
| 8 | Dokumentace: README.md, ROZHODNUTI.md | průběžně |

### Pracovní cyklus pro každou funkci
1. **Plán** (Plan mode, nic se nemění) → 2. **Schválení** → 3. **Provedení** → 4. **Kontrola a testy** → 5. **Commit**

### Navržené milníky (fáze 4)
- **M1** kostra aplikace, spuštění v prohlížeči
- **M2** projekty a úkoly (přidat/upravit/smazat), data přežijí obnovení stránky
- **M3** vykreslení Ganttova diagramu
- **M4** závislosti a milníky, posun navazujících úkolů
- **M5** zdroje (osoby/role, sazby, materiál) a jejich přiřazení k úkolům
- **M6** rozpočet: výpočty, souhrny po úkolech/měsících/projektu, plán vs. skutečnost
- **M7** export PDF/Excel, záloha a obnova přes JSON
- **M8** uživatelské doladění

## 5. Předběžná doporučení z konzultace (k potvrzení ve Fázi 1–2)

- **Začít lokální jednouživatelskou aplikací** (data v počítači/prohlížeči + export/import JSON jako záloha).
  Webovou víceuživatelskou verzi s přihlašováním až později, a před ostrým nasazením s nezávislým bezpečnostním auditem.
  Datovou vrstvu oddělit tak, aby šla později vyměnit za server.
- Navržená technologie: **React + TypeScript + Vite**, ukládání **IndexedDB**, testy **Vitest**,
  Gantt přes knihovnu (např. frappe-gantt), nebo vlastní vykreslení. Porovnat licence a údržbu.
- **Peníze ukládat jako celá čísla v haléřích**, nikdy jako desetinná čísla (float).
- Výpočty rozpočtu jako **čisté funkce** oddělené od UI, každá s automatickým testem.
  Kontrolní příklady spočítám ručně (Excel), ne AI.
- Navrhovaná struktura složek: `src/model`, `src/vypocty`, `src/ui`, `src/uloziste`.
- UI česky: datum `d. M. yyyy`, měna `1 250 000,00 Kč`, české svátky, srozumitelné chybové hlášky,
  Zpět (Ctrl+Z), potvrzení před mazáním.

### Předběžný datový model
```
Projekt ─┬─ Úkol ─┬─ Závislost (na jiný úkol)
         │        └─ Přiřazení zdroje (hodiny) ── Zdroj (sazba)
         └─ Nákladová položka (volitelně navázaná na úkol)
```

### Funkce MVP k upřesnění ve SPEC.md
- Projekt: název, popis, zahájení, měna
- Úkoly: název, začátek, trvání/konec, odpovědná osoba, % dokončení; milníky
- Závislosti mezi úkoly
- Zdroje: osoby/role s hodinovou sazbou, materiál, služby
- Rozpočet: osobní náklady (hodiny × sazba), přímé náklady, nepřímé náklady (% režie),
  souhrny, plán vs. skutečnost
- Export: PDF diagramu, Excel rozpočtu
- **Otevřené otázky:** DPH, zaokrouhlování, pracovní vs. kalendářní dny, co v MVP NEBUDE

## 6. Bezpečnostní pravidla

- Nikdy neukládat hesla, klíče ani tokeny do kódu. Tajné údaje patří do `.env`, který je v `.gitignore`.
- Nepoužívat režim přeskakující schvalování. Každý příkaz musím mít možnost schválit.
- Co nejméně závislostí, pravidelně spouštět `npm audit`, na GitHubu zapnout Dependabot.
- Validovat všechny vstupy, importovaný JSON ověřovat proti schématu (např. Zod).
- Nevkládat text uživatele do stránky jako HTML (ochrana před XSS).
- Po každém milníku spustit `/security-review` a `/code-review`.
- Před prvním `git push` zkontrolovat, co se odesílá.
- Jména osob a sazby jsou osobní údaje (GDPR), důležité zejména u webové verze.

## 7. Další krok

**Fáze 1 – zadání.** V plánovacím režimu mi pokládej po jedné až třech otázkách najednou,
abychom společně sepsali soubor **`SPEC.md`**. Začni rozhodnutím **lokální vs. webová aplikace**
a tím, **kdo bude aplikaci používat**.
