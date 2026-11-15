# Fáze 6a – Databáze zdrojů

## 1. Cíl fáze

Projekt má vlastní **databázi zdrojů** na nové obrazovce **Zdroje** (přepínač Plán | Zdroje):

- **Profese** s hodinovou sazbou – ruční, nebo **spočítanou** z mzdy, odvodů, režie
  a produktivních hodin (výpočet je vidět krok po kroku),
- **Pracovníci** – patří k profesi a ke **středisku**; sazbu mají vlastní, nebo převezmou sazbu profese,
- **Střediska** (dimenze pro pozdější analytiku),
- **Stroje a zařízení** se sazbou za hodinu nebo den,
- **Materiály a díly** s jednotkou a jednotkovou cenou,
- **Kategorie nákladů**.

Databázi jde přenést do jiného projektu jako **knihovnu** (Soubor → Exportovat / Načíst knihovnu
zdrojů). Na činnosti se zdroje přiřadí až ve fázi 6b.

## 2. Co se naučíte z vibe codingu

**Architektura dřív než kód.** Před fází jste se zeptali: „Bude pro každý zdroj činnosti zvláštní
řádek? A jaké databáze budeme potřebovat?“ Claude navrhl model *číselníky + řádky přiřazení*,
vysvětlil proč (sčítání, rozpočet v čase, analytika) a zapsal ho do zadání (v1.8) dřív,
než vznikl první řádek kódu. Rozhodnutí o datech se později mění nejdráž – proto se dělají první.

**Peníze se nepočítají v desetinných číslech.** `0,1 + 0,2` není v počítači přesně `0,3`.
Proto jsou všechny částky v **haléřích** (celá čísla) a text „1 234,50 Kč“ se převádí na haléře
přes text, ne přes desetinné číslo. Test s ručně spočítanou kalkulací sazby (571,54 Kč/h) to hlídá.

**Starší soubory musí jít otevřít.** Nový formát souboru (verze 2) by bez péče rozbil soubory
z fáze 5. Proto aplikace starší soubor při otevření sama **převede** a výsledek znovu ověří schématem.

**Měřit, ne odhadovat (podruhé).** S 300 položkami v seznamu se ukázalo, že úprava jedné ceny
překresluje celou tabulku a výběr profese u 300 pracovníků by vytvořil 90 000 položek seznamu.
Oprava: překreslí se jen změněný řádek a dlouhé seznamy se naplní až při najetí myší.

**Požadavky přicházejí za pochodu.** Středisko u pracovníka a přesouvání záložek v zadání nebyly.
Claude se u střediska zeptal na způsob (číselník, nebo volný text) a obojí zapsal do zadání (v1.9).

## 3. Příprava

- Hotová fáze 5 a zadání v1.8 (architektura zdrojů).

## 4. Prompty krok za krokem

1. `Před tím, než se pustíme do zdrojů… Bude se vytvářet pro jednu činnost více řádků – pro každý
   zdroj zvlášť? Jaký doporučuješ postup?` → návrh architektury, zadání v1.8.
2. `Navrhni plán implementace fáze 6a, nic zatím nepiš.` → otázky (záložky, sazba stroje,
   knihovna, vzorová data) → schválit plán.
3. Po každém kroku: ověřit → `Funguje, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | peníze v haléřích, kalkulace sazby, formát v2 + převod v1 (testy předem) | `npm test`, starý soubor se otevře |
| 2 | Plán / Zdroje, Materiály, Kategorie | přidat materiál, cena „abc“ se odmítne |
| 3 | Profese, Pracovníci, dialog Hodinová sazba | kalkulace krok po kroku, „podle profese“ |
| 4 | Stroje, smazání kategorie s náhradou | Přesunout a smazat, Ctrl+Z |
| + | Střediska (doplněk) | středisko u pracovníka |
| 5 | knihovna zdrojů | export → nový projekt → načíst → náhled |
| 6 | vzorová databáze | Vzorový projekt → Zdroje |
| + | přesouvání záložek (doplněk) | tažení, Alt+Shift+←/→, Výchozí pořadí |
| 7 | výkon, bezpečnost, průvodce, zadání v1.9 | viz níže |

Užitečné doplňující prompty:
- `Vysvětli mi kalkulaci hodinové sazby na příkladu konstruktéra ze vzorového projektu.`
- `Proč se peníze ukládají v haléřích?`

## 5. Jak ověřit výsledek

```powershell
npm test          # přes 360 testů
npm audit         # 0 vulnerabilities
npm run dev
```

1. **Vzorový projekt** → **Zdroje**: profese se sazbami, 7 pracovníků, střediska, 3 stroje, 9 materiálů.
2. Sazba konstruktéra Petra Svobody (✎) → vlastní kalkulace krok po kroku.
3. Přidat profesi bez pracovníků a smazat ji; smazat profesi s pracovníky → hláška.
4. Kategorie „Materiál“ → smazat → dialog s přesunem → Ctrl+Z.
5. Soubor → Exportovat knihovnu → Nový projekt → Načíst knihovnu → náhled → potvrdit.
6. Uložit projekt, zavřít, otevřít → databáze je zpět; soubor z fáze 5 se otevře také.
7. Záložky přetáhnout jinam, obnovit stránku → pořadí zůstane.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Kalkulace dává jinou sazbu, než čekám | `U profese <název> vychází <sazba>, ručně mi vychází <sazba>. Projdi výpočet krok po kroku a napiš na to test.` |
| Starý soubor nejde otevřít | `Soubor uložený ve fázi <N> hlásí „<hláška>“. Převeď ho a přidej test na tento případ.` |
| Knihovna načte něco dvakrát | `Po načtení knihovny mám profesi „X“ dvakrát. Název v projektu je „<…>“, v knihovně „<…>“.` |
| Tabulka je pomalá | `Záložka <název> s <počet> položkami se překresluje <jak dlouho>. Změř to a zrychli.` |

## 7. Uložení do Gitu

`Fáze 6a je ověřená. Udělej commit s popisem v češtině a pošli ho na GitHub.`

## 8. Kontrolní otázky / mini-úkol

1. Proč pracovník bez vlastní sazby přebírá sazbu profese, a ne naopak?
2. Proč knihovna páruje položky podle názvu, a ne podle ID?
3. Co by se stalo, kdyby se kategorie dala smazat i ve chvíli, kdy ji používají materiály?
4. **Mini-úkol:** přidejte profesi „Svářeč“ s kalkulací (mzda 45 000 Kč, režie 12 %),
   dva svářeče do střediska Výroba – jednomu dejte ruční sazbu. Vyexportujte knihovnu
   a načtěte ji do nového projektu.
