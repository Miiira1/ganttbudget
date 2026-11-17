# Fáze 8 – Analytika a dashboardy

## 1. Cíl fáze

Aplikace dosud ukazovala náklady a vytížení jen v pevně daných tabulkách. Teď si uživatel položí vlastní otázku, třeba „kolik stojí mzdy ve fázi 3 po měsících“ nebo „kolik hodin má středisko Konstrukce v březnu“. Odpověď uvidí v tabulce i v grafu a analýzu si uloží jako pohled.

- **Pohled Analýza** (pátý přepínač) je kontingenční tabulka (A-01):
  - řádky v 1–2 úrovních, sloupce volitelně,
  - dimenze: fáze, činnost, kategorie, štítek, druh, zdroj, profese, středisko, týden / měsíc / čtvrtletí,
  - metrika náklady nebo hodiny,
  - agregace součet, průměr, počet, minimum, maximum,
  - filtry s více volbami,
  - export do Excelu a CSV.
- **Grafy k tabulce** (A-02): sloupcový, koláčový, čárový a skládaný. Graf a tabulka jsou vedle sebe nebo pod sebou a podíl se mění rozdělovníkem.
- **Pohledy** (A-06): pět přednastavených pro začátek a vlastní pohledy uložené v souboru projektu (uložit, uložit změny, přejmenovat, smazat).
- **Dashboard Náklady v čase** (A-03, pohled Náklady):
  - šest ukazatelů: celkem, plánováno do dneška, zbývá, nejdražší období, průměr, čerpání limitu,
  - graf **S-křivka / Cash flow** s čarou „Dnes“.
- **Dashboard Vytížení** (A-04, pohled Vytížení):
  - filtry: druh zdroje, středisko, jen přetížené,
  - čtyři ukazatele,
  - souhrnný histogram skupiny.

| Pojem | Co znamená |
|---|---|
| kontingenční tabulka | tabulka, kde si sami zvolíte, co bude v řádcích a ve sloupcích, a aplikace to sečte |
| dimenze | podle čeho se třídí (kategorie, fáze, měsíc…) |
| metrika | co se sčítá (Kč nebo hodiny) |
| S-křivka | kumulativní náklady: kolik se od začátku celkem utratí do daného dne |
| cash flow | kolik se utratí v každém období zvlášť (zatím jen výdaje) |

## 2. Co se naučíte z vibe codingu

**Jeden zdroj čísel pro všechny pohledy.** Analýza nepočítá náklady ani hodiny znovu po svém. Vezme rozklad, který už používají pohledy Náklady a Vytížení (`facts.ts`), a jen ho třídí a sčítá (`pivot.ts`). Testy hlídají, že součet Analýzy se rovná nákladům v záhlaví a hodiny se rovnají Vytížení. Kdyby každý pohled počítal sám, dříve nebo později by se rozešly.

**Štítky se počítají opatrně.** Řádek se dvěma štítky („dotace“ i „etapa 1“) patří do obou skupin. Řádek „Celkem“ ho ale započte jen jednou, jinak by byl celek vyšší než projekt. Tabulka to vysvětlí poznámkou. Ze stejného důvodu je při štítcích v řádcích vypnutý koláčový graf: podíly by dávaly víc než 100 %.

**Graf má jednu osu.** Původní graf nákladů měl osu vlevo i vpravo s různým měřítkem. Takový graf svádí k porovnávání věcí, které porovnat nejde. Teď je to přepínač: S-křivka, nebo Cash flow, a každý má jen jednu osu.

**Barva patří věci, ne pořadí.** Skupina má barvu podle svého místa v projektu, takže filtr nepřebarví ostatní. Červená je vyhrazená přetížení a limitu, tyrkysová značí „dnes“ a výběr.

**Souhrn nesmí sčítat jablka s hruškami.** Profese obsahuje hodiny svých pracovníků. Kdyby se sečetly s pracovníky, hodiny by se započítaly dvakrát. Proto má každý druh zdroje svůj histogram. Profese bez lidí (neznámá kapacita) se do souhrnu nezapočte, jinak by hlásila falešné přetížení. Tuhle past našel test napsaný předem.

**Pohled je data, ne kód.** Uložený pohled je jen nastavení (řádky, sloupce, filtry) v souboru projektu. Při načtení ho ověří schéma Zod a pohledů smí být nejvýš 50. Uložení, přejmenování i smazání jde vrátit tlačítkem Zpět.

## 3. Příprava

- Hotová fáze 7 (rozpočet v čase) a doplněk „celý projekt v Excelu“.
- Vzorový projekt (tlačítko **Vzorový projekt**).

## 4. Prompty krok za krokem

1. `Vytvoř plán implementace fáze 8, zatím nic nepiš.` → otázky (kde analýza bude, jaké metriky, kam ukládat pohledy, co je cash flow) → schválit plán.
2. Po každém kroku: ověřit → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | jádro: `facts.ts`, `pivot.ts` (testy předem, výkon) | `npm test` |
| 2 | vlastní pohledy v datech (`Project.views`) | starý soubor projektu se načte |
| 3 | pohled Analýza: tabulka, nastavení, filtry, export | Celkem = náklady v záhlaví |
| 4 | grafy ke tabulce | přepnout 4 typy grafu |
| — | tabulka a graf vedle sebe / pod sebou, rozdělovník; „Odebrat vše“ ve filtrech | táhnout rozdělovník |
| 5 | nabídka Pohled: přednastavené a vlastní pohledy | uložit, přejmenovat, smazat, Ctrl+Z |
| 6 | dashboard Náklady: ukazatele, S-křivka / Cash flow, čára Dnes | přepínač grafu |
| 7 | dashboard Vytížení: filtry, ukazatele, souhrn skupiny | Jen přetížené |
| 8 | audit, průvodce, README, zadání v1.15 | viz níže |

Užitečné doplňující prompty:
- `Proč se v Analýze řádek Celkem nerovná součtu štítků?`
- `Spočítej ručně hodiny pracovníka <jméno> v březnu a porovnej je s Analýzou a s pohledem Vytížení.`
- `Chci přednastavený pohled „<název>“ – navrhni nastavení.`

## 5. Jak ověřit výsledek

```powershell
npm test          # přes 500 testů
npm audit         # 0 vulnerabilities
npm run dev
```

1. **Vzorový projekt** → **Analýza** → Pohled „Náklady podle kategorií po měsících“ → Celkem 6 274 822,49 Kč (stejně jako záhlaví).
2. Řádky **Fáze › Kategorie**, sloupce **Čtvrtletí**, filtr **Druh = práce**: součty sedí s pohledem Náklady se stejným filtrem.
3. Metrika **Hodiny**, řádky **Zdroj**, sloupce **Týden**: čísla sedí s pohledem Vytížení.
4. Graf: přepnout sloupcový / koláčový / čárový / skládaný a táhnout rozdělovník.
5. **Pohled → Uložit jako nový pohled…** → uložit projekt do souboru → otevřít znovu → pohled je v nabídce → smazat → Ctrl+Z.
6. **Náklady**: dlaždice ukazatelů, přepínač **S-křivka / Cash flow**, tyrkysová čára Dnes. Nastavte limit 5 000 000 Kč: v S-křivce se objeví čára limitu, červený bod a červená dlaždice Čerpání limitu. Pak Ctrl+Z.
7. **Vytížení**: zaškrtnout **Jen přetížené** → 2 zdroje. Spodní panel **Souhrn skupiny** → histogram pracovníků, profesí a strojů.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Analýza ukazuje jiný součet než záhlaví | `V Analýze je Celkem <X>, v záhlaví <Y>, nastavení: <řádky, sloupce, filtry>. Najdi rozdíl a napiš test.` |
| Graf je prázdný nebo přetéká | `Graf v Analýze (<typ>) se při šířce okna <…> zobrazuje špatně: <popis>. Pošlu screenshot.` |
| Uložený pohled po otevření souboru chybí | `Uložil jsem pohled „<název>“, ale po otevření souboru v nabídce není. Zkontroluj ukládání Project.views.` |

## 7. Uložení do Gitu

`Fáze 8 je ověřená. Udělej commit s popisem v češtině a pošli ho na GitHub.`

## 8. Kontrolní otázky / mini-úkol

1. Proč průměr, minimum a maximum nejde zobrazit v koláčovém nebo skládaném grafu?
2. Proč dlaždice „Čerpání limitu“ ignoruje filtry, ale ostatní ukazatele ne?
3. Skupina pracovníků v souhrnu není přetížená, ale jeden pracovník ano. Co to o plánu říká a co byste udělali?
4. **Mini-úkol:** v Analýze nastavte tabulku „mzdové náklady podle středisek po čtvrtletích jen pro fázi 3“, uložte ji jako vlastní pohled a vyexportujte do Excelu. Ověřte, že součet v Excelu sedí s tabulkou.
