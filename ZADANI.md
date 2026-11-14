# ZADÁNÍ: Aplikace pro Ganttovy diagramy s navázaným rozpočtem

> Pracovní název: **GanttBudget** (změnitelný)
> Verze zadání: 1.4 · Datum: 14. 11. 2026 (změny viz kap. 14)
> Dokument je zároveň vstupem pro Claude Code (vibe coding) a osnovou výukové case study.

---

## 1. Účel a cílová skupina

**Účel.** Webová aplikace pro plánování projektů (Ganttův diagram) s provázaným rozpočtem. Ovládáním a funkcemi se podobá MS Project nebo GanttProject, ale je radikálně jednodušší a srozumitelnější.

**Cílové skupiny.**

1. Studenti strojní fakulty (budoucí inženýři) v kurzu projektového řízení, bez předchozí zkušenosti s PM.
2. Praktici v podnicích bez zkušenosti s PM.

**Hlavní princip.** Uživatel musí být schopen sestavit smysluplný plán a rozpočet bez školení. Aplikace ho vede, vysvětluje pojmy a upozorňuje na chyby.

**Druhý cíl projektu.** Vznikne výuková case study, která autora (bez zkušenosti s programováním) provede prvním vibe codingovým projektem v Claude Code (viz kap. 9).

---

## 2. Rozhodnutí o rozsahu (shrnutí odpovědí)

| Oblast | Rozhodnutí |
|---|---|
| Platforma | Webová aplikace v prohlížeči, bez serveru a bez účtů |
| Ukládání | Soubor projektu (JSON) + automatická záloha v prohlížeči |
| Velikost projektu | Do cca 300 činností |
| Vzhled | Čistý, moderní; světlý i tmavý režim |
| Jazyky | Čeština a angličtina (rozšiřitelné o další) |
| Časová jemnost | Dny (pracovní dny dle kalendáře) |
| Měna | Jedna měna na projekt, výchozí CZK, volitelně jiná |
| Vazby | Všechny čtyři typy (FS, SS, FF, SF) + prodlevy (lag/lead) |
| PM koncepty | Milníky, kritická cesta a rezervy, zdroje, baseline a sledování plnění |
| Kalendář | Projektový kalendář + volitelné kalendáře zdrojů |
| Rozpočet | Položky přiřazené k činnostem; kategorie + volné štítky |
| AI | Kopírování promptu a JSON (bez API klíčů); později průvodce generováním plánu |
| Myšlenková mapa | Vestavěný jednoduchý editor (pozdější fáze) |
| Distribuce | Veřejný web zdarma (GitHub Pages) + open source |
| Vzorové projekty | Z prostředí strojírenství a výroby (např. zavedení automatizace do výroby) |

---

## 3. Mimo rozsah (explicitně NE)

- Uživatelské účty, přihlášení, sdílení v cloudu, týmová práce v reálném čase.
- Přímé volání AI přes API v první verzi (možné rozšíření v budoucnu).
- Plánování po hodinách, více měn s kurzy, kalendář pro každou činnost zvlášť.
- Mobilní aplikace (web má být použitelný na tabletu, na mobilu není prioritou).
- Pokročilé PM metody (Monte Carlo, PERT, vyrovnávání zdrojů automatickým algoritmem).

---

## 4. Funkční požadavky

Priorita: **M** = MVP (verze 1.0), **D** = další fáze (viz kap. 8).

### 4.1 Činnosti a struktura

| ID | Požadavek | Prio |
|---|---|---|
| F-01 | Činnosti lze zadávat v **textové tabulce** (název, začátek, konec, délka, předchůdci, % hotovo, poznámka; sloupec zdroje přibude ve fázi 6) i **graficky** v úsečkovém diagramu. Obě podoby jsou vždy synchronní. | M |
| F-02 | Typy položek: **činnost**, **fáze** (sumární), **milník** (délka 0). | M |
| F-03 | **Hierarchické sdružování** činností do fází, neomezené zanořování (rozumný limit např. 6 úrovní). Fázi lze sbalit a rozbalit. | M |
| F-04 | Fáze automaticky počítá začátek, konec a délku z podřízených činností. | M |
| F-05 | **Přeskupování**: přetažení řádku (drag & drop), odsazení a předsazení (změna úrovně), přesun nahoru/dolů klávesami. | M |
| F-06 | Automatické číslování (WBS, např. 1.2.3). | M |
| F-07 | Vazby mezi činnostmi: **FS, SS, FF, SF** s prodlevou (kladnou i zápornou) ve dnech. Zadání textem (např. `3FS+2`) i kreslením v grafu. | M |
| F-08 | Po změně činnosti se **automaticky přepočítají** následníci. Detekce cyklů s jasnou chybovou hláškou. | M |
| F-09 | Kritická cesta a rezervy (volná i celková), zvýraznění kritických činností. | D (fáze 6) |
| F-10 | Poznámky k činnostem, barvy činností/fází. | D |

### 4.2 Ganttův diagram (grafické ovládání)

| ID | Požadavek | Prio |
|---|---|---|
| G-01 | Úsečkový diagram vedle tabulky, sdílené svislé posouvání, oddělovač lze posouvat. | M |
| G-02 | **Tažení úsečky** = posun činnosti; **tažení okrajů** = změna délky. Pohyb se přichytává na pracovní dny. | M |
| G-03 | **Kreslení vazby** tažením z konce/začátku jedné úsečky na druhou; typ vazby plyne z toho, kam se táhne. | M |
| G-04 | Zoom časové osy: dny, týdny, měsíce, čtvrtletí. Zvýraznění dneška, víkendů a svátků. | M |
| G-05 | **Undo/Redo** (Ctrl+Z / Ctrl+Y) napříč všemi operacemi. | M |
| G-06 | Klávesové zkratky (nová činnost, odsadit, smazat, duplikovat), přehled zkratek v aplikaci. | M |
| G-07 | Zobrazení vazeb šipkami, milníků kosočtverci, fází jako sumárních úseček. | M |
| G-08 | Zobrazení baseline (stínová úsečka pod plánem) a % hotovo (výplň úsečky). | D |
| G-09 | Funkční na tabletu (dotyk). | D |

**Pravidlo posunu úsečky.** Při tažení činnosti s předchůdci se nastaví omezení „začít nejdříve k datu". Skutečný začátek = pozdější z (omezení, vyplývající z vazeb). Aplikace to uživateli srozumitelně vysvětlí (např. ikonou a tooltipem). Přesné chování se ověří ve fázi 4b roadmapy.

### 4.3 Kalendář

| ID | Požadavek | Prio |
|---|---|---|
| K-01 | Projektový kalendář: pracovní dny (výchozí Po–Pá), pracovní doba se v dnech neřeší. | M |
| K-02 | **České státní svátky se načtou automaticky** pro libovolný rok (včetně pohyblivých: Velký pátek, Velikonoční pondělí; výpočet algoritmem, bez externí služby). | M |
| K-03 | **Vlastní výjimky**: libovolné dny nebo rozsahy (podniková odstávka, dovolená) a ruční přidání/odebrání svátků. Lze i vypnout automatické svátky. | M |
| K-04 | Možnost zvolit jinou sadu svátků než českou (struktura připravená na další země). | D |
| K-05 | Kalendáře zdrojů: nepřítomnosti konkrétního zdroje (dovolená, nemoc). | D (fáze 6) |

Státní svátky ČR k zakódování: 1. 1.; Velký pátek; Velikonoční pondělí; 1. 5.; 8. 5.; 5. 7.; 6. 7.; 28. 9.; 28. 10.; 17. 11.; 24. 12.; 25. 12.; 26. 12. (Claude Code má jejich seznam před zakódováním ověřit proti aktuální legislativě.) ✅ Ověřeno 14. 11. 2026 proti zákonu č. 245/2000 Sb. ve znění novely 59/2026 Sb. (ta přidala jen významný den 30. 3., který není dnem pracovního klidu).

### 4.4 Zdroje

| ID | Požadavek | Prio |
|---|---|---|
| Z-01 | Číselník zdrojů: lidé a stroje, sazba (Kč/hod nebo Kč/den), kapacita (hodin/den), kalendář. | D (fáze 6) |
| Z-02 | Přiřazení zdroje k činnosti (včetně podílu úvazku, např. 50 %). | D |
| Z-03 | Detekce přetížení zdroje (varování + histogram vytížení). | D |

### 4.5 Rozpočet a náklady

| ID | Požadavek | Prio |
|---|---|---|
| R-01 | Rozpočtové položky vždy **navázané na činnost nebo fázi**. Posun činnosti automaticky posune náklady v čase. | D (fáze 7) |
| R-02 | Typy položek: **jednorázový náklad k datu** (na začátku/na konci činnosti nebo k pevnému datu), **průběžný náklad** (za den/týden/měsíc po dobu činnosti), **mzdový náklad ze zdroje** (hodiny × sazba), **množství × jednotková cena**. | D |
| R-03 | **Kategorie nákladů** (editovatelný číselník, výchozí: materiál, mzdy, služby, investice, režie, rezerva) + **volné štítky**. | D |
| R-04 | **Časový náběh nákladů**: rozpad všech položek do dnů/týdnů/měsíců, kumulativně i po obdobích. | D |
| R-05 | Souhrn nákladů za fázi (součet dílčích činností) a za celý projekt. | D |
| R-06 | Volitelný limit rozpočtu a varování při překročení. | D |

### 4.6 Analytika a dashboardy

| ID | Požadavek | Prio |
|---|---|---|
| A-01 | **Interaktivní kontingenční tabulka**: uživatel volí řádky, sloupce, metriku a agregaci z dimenzí (fáze, činnost, kategorie, štítek, zdroj, měsíc/týden/čtvrtletí). | D (fáze 8) |
| A-02 | K tabulce přiložené **grafy** (sloupcový, čárový, koláčový, skládaný), přepínání jedním klikem. | D |
| A-03 | **Dashboard „Náklady v čase"**: S-křivka (kumulativní náklady) a cash flow po obdobích. | D |
| A-04 | **Dashboard „Vytížení zdrojů"**: histogram po týdnech, zvýraznění přetížení. | D |
| A-05 | **Dashboard „Plán vs. skutečnost"**: baseline vs. aktuální plán, % dokončení, **Earned Value** (PV, EV, AC, CPI, SPI, EAC) s vysvětlením pojmů. | D (fáze 9) |
| A-06 | Přednastavené pohledy pro začátečníky + možnost uložit vlastní pohled. | D |

### 4.7 Import a export

| ID | Požadavek | Prio |
|---|---|---|
| I-01 | **Celý projekt jako JSON** (otevřít/uložit, záloha, vstup pro AI). Formát je verzovaný (pole `schemaVersion`), aby šly starší soubory načíst. | M |
| I-02 | Automatická záloha rozpracovaného projektu v prohlížeči (obnova po zavření záložky). | M |
| I-03 | **Export a import činností do CSV a XLSX** (včetně hierarchie, vazeb, délek). Import s náhledem a kontrolou chyb před potvrzením. | M |
| I-04 | **Export a import rozpočtu a časového náběhu nákladů do CSV a XLSX**. | D (fáze 7) |
| I-05 | Export Gantta do **PDF** a obrázku (PNG/SVG) pro odevzdávání úkolů. | D (fáze 13) |
| I-06 | Import ze souborů MS Project (XML) a GanttProject. | D (fáze 13) |

### 4.8 Uživatelská přívětivost

| ID | Požadavek | Prio |
|---|---|---|
| U-01 | **Průvodce prvním projektem** (název, termíny, kalendář, první fáze). | D (fáze 10) |
| U-02 | **Vzorové projekty a šablony ze strojírenství a výroby** (např. zavedení automatizace do výroby, vývoj nového výrobku, zavedení nové výrobní linky, investiční akce, plánovaná odstávka a údržba). Každý je kompletní: fáze, činnosti, vazby, zdroje, rozpočet. | D |
| U-03 | **Kontextová nápověda**: tooltipy a krátké výukové boxy u pojmů (kritická cesta, rezerva, baseline, CPI…). Aplikace nepoužívá odborné termíny bez vysvětlení. | M (základ) / D |
| U-04 | **Kontrola kvality plánu** (varování, ne blokace): činnost bez následníka nebo předchůdce, fáze bez činností, překročení rozpočtu, přetížený zdroj, vazba vedoucí do minulosti, činnost bez délky. U každého varování tlačítko „Jak to opravit". | D |
| U-05 | Dobrá výchozí nastavení: nový projekt je použitelný po prvním kliknutí. | M |
| U-06 | Přístupnost: použitelné z klávesnice, dostatečný kontrast, barvy nejsou jediným nositelem informace. | M |

### 4.9 Jazyky

| ID | Požadavek | Prio |
|---|---|---|
| L-01 | Čeština a angličtina, přepínač v hlavním menu, volba se pamatuje. | M |
| L-02 | **Žádný pevný text v kódu**. Všechny texty (včetně chybových hlášek a nápovědy) jsou v překladových souborech. Formát data, čísel a měny se řídí jazykem. | M |
| L-03 | Přidání dalšího jazyka = přidání jednoho souboru. | M |

### 4.10 Napojení na AI (bez serveru)

| ID | Požadavek | Prio |
|---|---|---|
| AI-01 | **Export pro AI**: tlačítko „Zkopírovat projekt pro AI" vyrobí Markdown/JSON (struktura, termíny, rozpočet) vhodný k vložení do ChatGPT/Claude, volitelně s přednastavenou otázkou (např. „Zkontroluj plán a najdi rizika"). | D (fáze 11) |
| AI-02 | **Generování plánu z textového zadání**: aplikace vytvoří prompt (včetně popisu formátu JSON), student ho vloží do AI a výsledek vloží zpět. Aplikace výsledek zvaliduje, ukáže náhled a po potvrzení importuje. | D |
| AI-03 | Prompty jsou v češtině i angličtině, přizpůsobené tomu, co AI nejlépe zvládne. | D |
| AI-04 | Odolnost vůči chybám AI: neplatný JSON, neexistující ID předchůdce apod. se ohlásí srozumitelně, případně se nabídne „oprav pomocí AI" prompt. | D |

### 4.11 Myšlenková mapa (pozdější fáze)

| ID | Požadavek | Prio |
|---|---|---|
| MM-01 | Jednoduchý vestavěný editor: centrální téma, větve, přidávání/mazání/přesouvání uzlů, sbalování. | D (fáze 12) |
| MM-02 | Tlačítko „Vytvořit plán z mapy": hierarchie uzlů se stane fázemi a činnostmi (hloubka → úroveň, listy → činnosti), uživatel doplní délky a vazby. | D |
| MM-03 | Import odsazeného textu (outline) jako alternativní vstup. | D |

---

## 5. Nefunkční požadavky

| ID | Požadavek |
|---|---|
| N-01 | Běží ve všech aktuálních prohlížečích (Chrome, Edge, Firefox, Safari) bez instalace. |
| N-02 | Plynulé ovládání pro 300 činností (tažení úsečky bez zpoždění, přepočet do 100 ms). |
| N-03 | Data zůstávají v počítači uživatele, nic se neposílá na server (zdůraznit v aplikaci). Aplikace nepoužívá sledovací nástroje. |
| N-04 | Světlý i tmavý režim, přepínač a respektování systémového nastavení. |
| N-05 | Rozumné rozložení na šířce od 1024 px; na menších šířkách alespoň čtení. |
| N-06 | **Plánovací jádro je oddělené od uživatelského rozhraní** (čistá funkce: projekt dovnitř, vypočtené termíny ven) a pokryté automatickými testy. |
| N-07 | Zdrojový kód s komentáři a README v češtině; open source licence (doporučeno MIT). |
| N-08 | Žádná ztráta dat: před přepsáním/importem upozornění, před zavřením s neuloženými změnami varování. |
| N-09 | Chybové hlášky srozumitelné laikovi (co se stalo a co s tím), nikdy technický výpis. |
| N-10 | **Bezpečný import**: každý načítaný soubor (JSON, CSV, XLSX, výstup z AI) se před použitím ověří proti schématu (Zod). Neplatná data se nikdy nepoužijí částečně. Texty od uživatele se nikdy nevkládají do stránky jako HTML. |
| N-11 | **Bezpečný export**: buňky začínající `=`, `+`, `-`, `@`, tabulátorem nebo CR se v CSV/XLSX ošetří, aby je Excel nespustil jako vzorec (CSV injection). |
| N-12 | **Content Security Policy** v `index.html`: aplikace načítá skripty a styly jen ze své vlastní adresy. |
| N-13 | **Závislosti**: co nejméně knihoven, zamčené verze (`package-lock.json`), pravidelně `npm audit`, na GitHubu zapnutý Dependabot. Žádné knihovny se známými neopravenými zranitelnostmi. |

---

## 6. Doporučená technologie (návrh s odůvodněním)

| Vrstva | Volba | Proč |
|---|---|---|
| Jazyk a UI | **TypeScript + React** | Claude Code je v nich nejspolehlivější; typy zachytí mnoho chyb dřív, než se objeví uživateli |
| Build | **Vite** | Rychlý start, jednoduchá konfigurace, výstup statického webu pro GitHub Pages |
| Styl | **Tailwind CSS** (+ jednoduché vlastní komponenty) | Konzistentní vzhled, snadný tmavý režim, Claude Code ho píše spolehlivě |
| Stav a Undo/Redo | **Zustand** + vlastní historie změn | Malé, srozumitelné řešení; undo/redo jako součást stavu. **Struktura stavu s historií změn se navrhne už ve fázi 1**, aby se později nemusela přepisovat. |
| Validace dat | **Zod** | Jedno schéma popisuje formát projektu: ověří import JSON/CSV/XLSX i výstup z AI a zároveň z něj vzniknou typy TypeScriptu |
| Gantt graf | **Vlastní komponenta (SVG)** | Knihovny zdarma často neumí všechny čtyři typy vazeb ani tažení vazeb. Vlastní řešení dává plnou kontrolu a je dobrým cvičením. |
| Datum a čas | **Vlastní funkce** (`src/engine/calendar.ts`) + vestavěné `Intl` | Práce s ISO dny `YYYY-MM-DD` bez časového pásma. Rozhodnuto ve fázi 2 (v1.2): pro výpočty stačí pár otestovaných funkcí, jedna závislost méně (N-13). date-fns lze přidat později, pokud by se vyplatila. |
| i18n | **react-i18next** | Standard pro překlady, formáty čísel a data |
| CSV / XLSX | **PapaParse**, **ExcelJS** | Osvědčené knihovny pro import i export. **SheetJS (`xlsx`) z npm nepoužívat**: verze na npm je zastaralá a má známé zranitelnosti. |
| Grafy | **Recharts** (případně ECharts) | Dobrá integrace s Reactem, pokryje sloupcové, čárové, plošné grafy |
| Pivot | **Vlastní jednoduchá implementace** (agregace + tabulka) | Hotové pivot knihovny bývají neudržované nebo špatně stylovatelné |
| Myšlenková mapa | **React Flow** nebo vlastní SVG (rozhodnout ve fázi 12) | |
| Testy | **Vitest** (jednotkové testy jádra), Playwright (pozdější klíčové scénáře) | |
| Ukládání | Stažení/nahrání souboru JSON, **File System Access API** tam, kde je dostupné; autosave do **IndexedDB** | |
| Nasazení | **GitHub Pages** přes GitHub Actions | Zdarma, automatické po každém uložení do hlavní větve |

> Stack je návrh. Pokud ho Claude Code ve fázi 0 vyhodnotí jako problematický, má navrhnout změnu a zdůvodnit ji, ne tiše změnit.

---

## 7. Datový model (náčrt)

Pro Claude Code jako výchozí bod; upřesní se ve fázi 1. Termíny jsou ISO dny (`YYYY-MM-DD`). **Peníze se ukládají jako celá čísla v nejmenší jednotce měny** (haléře, centy); zobrazují se se 2 desetinnými místy podle jazyka. Desetinná čísla (float) se pro peníze nepoužívají.

```
Project
  schemaVersion, name, startDate, currency, language
  calendar: Calendar
  tasks: Task[]            // plochý seznam, hierarchie přes parentId + pořadí
  resources: Resource[]
  costCategories: Category[]
  costItems: CostItem[]
  baselines: Baseline[]

Calendar
  workingWeekdays[]        // výchozí Po–Pá
  useCzechHolidays: bool
  customHolidays[]         // přidané svátky/odstávky (datum nebo rozsah, název)
  removedHolidays[]        // státní svátky, které se nemají počítat

Task
  id, parentId, order, name
  kind: "task" | "phase" | "milestone"
  durationDays             // pracovní dny; 0 pro milník
  constraintStart?         // "začít nejdříve k datu"
  dependencies: [{ predecessorId, type: FS|SS|FF|SF, lagDays }]
  percentComplete, notes, color
  assignments: [{ resourceId, share }]
  // vypočteno enginem, neukládá se: start, finish, slack, isCritical

Resource     id, name, kind (person|machine), rate, rateUnit, capacityPerDay, absences[]
CostItem     id, taskId, categoryId, tags[], name,
             kind: oneTime|recurring|labor|unitPrice,
             amount | quantity × unitPrice | period (day|week|month),
             timing: start|end|fixedDate (+ date)
Baseline     id, name, savedAt, snapshot (termíny a náklady)
```

**Plánovací jádro (engine).** Čistá funkce `schedule(project) → vypočtené termíny`:

1. Topologické řazení, detekce cyklů.
2. Forward pass podle vazeb, kalendáře a omezení; backward pass pro rezervy (od fáze 6).
3. Sumarizace fází.
4. Vždy pokryto testy (typické případy, víkendy, svátky, záporné prodlevy, všechny čtyři typy vazeb).

---

## 8. Roadmapa po fázích

Každá fáze je **samostatně funkční a ověřitelná**. Končí uložením do Gitu (commit) a krátkým ověřením. Další fáze se začíná až po úspěšném ověření.

| Fáze | Název | Výsledek (Definition of Done) | Požadavky |
|---|---|---|---|
| **0** | Příprava a první kontakt | Nainstalovaný Claude Code, Node.js, Git, účet GitHub. Prázdný projekt, soubor `CLAUDE.md` s pravidly, zadání nahrané. Claude Code zadání přečte a vlastními slovy shrne. | |
| **1** | Kostra a tabulka činností | Aplikace se spustí, zobrazí tabulku činností (přidat, upravit, smazat řádek), světlý/tmavý režim, přepínač CS/EN, texty v překladových souborech. Stav aplikace je navržen s historií změn (připraven na Undo/Redo), formát projektu je popsán schématem Zod, v `index.html` je CSP. | F-01 (textová část), L-01–03, N-04, N-12 |
| **2** | Kalendář a plánovací jádro | Z délek a vazeb (nejdřív jen FS) se spočítají termíny, respektují víkendy a české svátky. Testy projdou. Jednoduchý nastavovací dialog kalendáře. | K-01–03, F-07 (základ), F-08, N-06 |
| **3** | Ganttův graf | Úsečkový diagram vedle tabulky, časová osa se zoomem, víkendy/svátky/dnešek zvýrazněny, šipky vazeb, milníky. Zatím jen zobrazení. | G-01, G-04, G-07 |
| **4a** | Hierarchie a přeskupování | Fáze (sbalení, sumarizace), odsazování a předsazení, přeskupování tažením i klávesami, WBS číslování, Undo/Redo v plném rozsahu. | F-02–06, G-05 |
| **4b** | Tažení v grafu | Tažení úsečky (posun) a okrajů (změna délky) s přichytáváním na pracovní dny, omezení „začít nejdříve k datu“, klávesové zkratky a jejich přehled. | G-02, G-06 |
| **4c** | Všechny typy vazeb | Vazby FS, SS, FF, SF s prodlevou (text `3FS+2` i kreslení tažením), přepočet následníků, detekce cyklů. Testy jádra pro všechny typy. | F-07, F-08, G-03 |
| **5** | Ukládání, export a import činností → **MVP 1.0** | Uložit/otevřít JSON, autosave, export a import CSV/XLSX činností s validací a ochranou proti CSV injection. První nasazení na GitHub Pages a odkaz pro vyzkoušení. | I-01–03, N-08, N-10, N-11 |
| **6** | Zdroje a kritická cesta | Zdroje a přiřazení, kalendáře zdrojů, kritická cesta a rezervy, varování na přetížení. | F-09, K-05, Z-01–03 |
| **7** | Rozpočet | Rozpočtové položky všech 4 typů, kategorie a štítky, časový náběh nákladů, export/import rozpočtu. | R-01–06, I-04 |
| **8** | Analytika a dashboardy | Kontingenční tabulka s grafy, dashboard Náklady v čase (S-křivka), Vytížení zdrojů. | A-01–04, A-06 |
| **9** | Baseline a sledování | Uložení baseline, zadávání % hotovo a skutečných nákladů, dashboard Plán vs. skutečnost a Earned Value. | G-08, A-05 |
| **10** | Učení a přívětivost | Průvodce prvním projektem, vzorové projekty ze strojírenství, kontextová nápověda, kontrola kvality plánu. | U-01–04 |
| **11** | Napojení na AI | Export pro AI, generování plánu z textu přes prompt a import JSON s validací. | AI-01–04 |
| **12** | Myšlenková mapa | Editor mapy, převod na činnosti, import odsazeného textu. | MM-01–03 |
| **13** | Doladění a export | Export do PDF/obrázku, import MS Project/GanttProject, dotyk, přístupnost, výkon. | I-05, I-06, G-09, K-04 |

> **Pravidlo pro začátečníka.** Fáze 0–5 stačí k použitelnému nástroji (MVP). Pokud by to bylo časově náročné, je to legitimní bod zastavení a nasazení. Fáze 6+ lze přidávat podle potřeby.

---

## 9. Výuková case study (struktura)

Cílem je, aby člověk bez programátorských zkušeností prošel celým projektem a naučil se i **styl práce s Claude Code**. Pro každou fázi vznikne samostatná kapitola ve stejné struktuře:

1. **Cíl fáze**: co bude na konci fungovat (laicky).
2. **Co se naučíte z vibe codingu**: jeden nový dovednostní prvek (např. plán před kódem, malé kroky, testy, čtení chyb).
3. **Příprava**: co mít hotové před začátkem.
4. **Prompty krok za krokem**: konkrétní texty ke zkopírování, v pořadí. Vždy jeden úkol na prompt.
5. **Jak ověřit výsledek**: co kliknout a co má být vidět. Ověření je vždy lidské, ne jen „Claude říká, že to funguje".
6. **Když se to rozbije**: typické chyby a přesné prompty pro opravu (např. „Vložím ti chybovou hlášku z konzole…").
7. **Uložení do Gitu**: příkaz nebo prompt pro commit se smysluplnou zprávou.
8. **Kontrolní otázky / mini-úkol**: upevnění znalostí.

**Průřezové dovednosti, které se v průběhu učí:**

- Fáze 0: co je terminál, složka projektu, Git; psaní dobrého `CLAUDE.md`; režim plánování (nejdřív plán, pak kód).
- Fáze 1–2: malé kroky, jak číst chybovou hlášku, proč testy (a požádat Claude, aby je psal před kódem jádra).
- Fáze 3–4: iterace nad vizuálním výsledkem (popis „co vidím a co chci"), práce se screenshoty.
- Fáze 5: nasazení a sdílení odkazu; zálohování pomocí Gitu.
- Další fáze: čtení cizího kódu s Claude (vysvětli mi, co dělá tento soubor), refaktoring, přidávání funkcí do existující aplikace bez rozbití staré.
- Průběžně: kdy začít čistou konverzaci, jak udržet kontext (`CLAUDE.md`, krátké specifikace fází), jak se neztratit u velkých změn (vždy po fázi commit).

**Forma výstupu:** soubor `PRUVODCE.md` (nebo složka `pruvodce/` s kapitolou na fázi). Zdrojové texty promptů a ověřovací kroky jsou součástí repozitáře, aby se case study dala použít ve výuce.

### Návrh `CLAUDE.md` (pravidla pro Claude Code)

- Čti `ZADANI.md` na začátku každé práce; pracuj jen na zadané fázi.
- Před větší změnou nejdřív navrhni plán a počkej na schválení.
- Piš kód v TypeScriptu, komentáře a README česky. Texty UI nikdy natvrdo, vždy přes překlady.
- Plánovací jádro nesmí záviset na UI; ke každé změně jádra patří test.
- Po každé dokončené části spusť build a testy; popiš, jak změnu ověřit.
- Žádné nové knihovny bez zdůvodnění a souhlasu.
- Nikdy nemaž ani nepřepisuj uživatelova data bez varování.
- Vysvětluj laicky: co jsi udělal a proč, bez zbytečného žargonu.

---

## 10. Pravidla pro vibe coding tohoto projektu

1. **Jedna fáze = jedna větev nebo jeden blok commitů.** Hotová fáze = commit s popisem.
2. **Plán před kódem.** Každá fáze začíná promptem „Navrhni plán implementace fáze N, nic ještě nepiš."
3. **Malé kroky.** Jeden prompt, jedna viditelná změna, okamžité ověření v prohlížeči.
4. **Ověřuje člověk.** Po každém kroku se otevře aplikace a zkusí se to. Chyby se Claude Code vloží doslova (text z konzole, screenshot).
5. **Testy jádra.** Plánovací logika a výpočty nákladů mají testy, protože zde jsou chyby nejzákeřnější a z UI je nepoznáte.
6. **Nezačínat novou fázi na rozbité předchozí.**
7. **Vzorová data.** Od fáze 1 existuje jeden vzorový projekt (zavedení automatizace do výroby), na kterém se vše zkouší a který poslouží i jako první šablona.

---

## 11. Vzorový projekt pro vývoj a testy

**„Zavedení automatizace do výroby"** (strojírenský podnik, cca 40–60 činností, 6–9 měsíců).

Fáze: Analýza a studie proveditelnosti → Výběr dodavatele (výběrové řízení) → Projekt a konstrukce → Dodávka a výroba zařízení → Příprava výrobní haly (podlaha, přípojky, bezpečnost) → Instalace a uvedení do provozu → Zaškolení obsluhy a zkušební provoz → Předání do provozu a vyhodnocení.

Má obsahovat všechny typy vazeb (včetně SS s prodlevou, např. příprava haly začíná 10 dní po zahájení výroby), několik milníků (podpis smlouvy, FAT, SAT, předání), zdroje (projektant, konstruktér, elektrikář, programátor PLC, externí dodavatel) a rozpočet (investice do zařízení jednorázově v platebních milnících, mzdy průběžně, školení, rezerva).

---

## 12. Kritéria přijetí (verze 1.0 / MVP)

Student bez předchozí zkušenosti s PM dokáže **do 15 minut a bez návodu**:

1. Vytvořit nový projekt a pojmenovat ho.
2. Přidat tři fáze a do nich 10 činností (textem i tažením v grafu).
3. Propojit je vazbami různých typů a vidět automatický posun termínů.
4. Nastavit podnikovou odstávku a vidět, že se plán přizpůsobí (a že české svátky se počítají samy).
5. Přepnout jazyk do angličtiny a zpět.
6. Uložit projekt do souboru, zavřít prohlížeč, projekt znovu otevřít.
7. Exportovat činnosti do Excelu a naimportovat je zpět beze ztráty.
8. Vrátit omylem provedenou změnu pomocí Ctrl+Z.

Technicky: build bez chyb, testy plánovacího jádra projdou, aplikace je nasazena na veřejné adrese.

---

## 13. Otevřené otázky a předpoklady k ověření

| # | Téma | Aktuální předpoklad |
|---|---|---|
| 1 | Chování tažení úsečky u činností s předchůdci | ✅ Rozhodnuto ve fázi 4b (v1.4): posun nastaví omezení „začít nejdříve k datu“; platí nejpozdější z (začátek projektu, vazby, omezení); když vyhraje vazba, aplikace to vysvětlí a ikona 📌 je bledší. Ověřit v praxi s uživateli zůstává doporučeno |
| 2 | Zdroje a rozpočet: mzda se počítá z hodin zdroje, nebo z celkové délky činnosti | Hodiny = délka činnosti × kapacita × podíl úvazku; ověřit ve fázi 6–7 |
| 3 | Zaokrouhlování peněz | ✅ Rozhodnuto (v1.1): celá čísla v nejmenší jednotce měny, zobrazení na 2 desetinná místa |
| 4 | Průběžný náklad „za měsíc" u činnosti, která nezačíná na začátku měsíce | Poměrně po dnech; upřesnit ve fázi 7 |
| 5 | Skutečné náklady (AC) pro Earned Value | Zadávají se ručně jako položky k datu; upřesnit ve fázi 9 |
| 6 | Pracovní název a logo aplikace | „GanttBudget" dočasně |
| 7 | Licence | MIT, pokud zadavatel (fakulta) nevyžaduje jinak |
| 8 | Použití ve výuce: potřeba odevzdávat projekty učiteli | Zatím jen soubor JSON/XLSX/PDF e-mailem nebo přes LMS |
| 9 | Majetková práva k aplikaci (případné zaměstnanecké dílo ČVUT) | ✅ Ověřeno u fakulty (14. 11. 2026) |
| 10 | E-mail v Git commitech veřejného repozitáře | ✅ Vyřešeno (14. 11. 2026): Git používá skrytou adresu GitHubu (`…@users.noreply.github.com`) |

---

## 14. Historie změn zadání

| Verze | Datum | Změny |
|---|---|---|
| 1.0 | 14. 11. 2026 | První verze |
| 1.1 | 14. 11. 2026 | Fáze 4 rozdělena na 4a/4b/4c; návrh stavu s historií (Undo/Redo) přesunut do fáze 1; peníze jako celá čísla v nejmenší jednotce; ExcelJS místo SheetJS; přidána validace Zod; bezpečnostní požadavky N-10 až N-13; fáze 6 přejmenována (milníky jsou v MVP); sloupec zdrojů v F-01 přesunut do fáze 6; otevřené otázky 9 a 10 |
| 1.2 | 14. 11. 2026 | Fáze 2: místo date-fns vlastní otestované funkce pro data; seznam svátků ověřen proti legislativě; pravidla výpočtu termínů (konec = poslední pracovní den, FS = další pracovní den po konci, milník na dni konce předchůdce); předchůdci se ve fázi 2 zadávají čísly řádků s prodlevou (`2; 5+3`), fáze zatím nemají vazby |
| 1.3 | 14. 11. 2026 | Fáze 4a – pravidla stromu: sloupec Č. (čísla řádků pro předchůdce, sbalením se nemění) + nový sloupec WBS; podřízené položky má jen fáze, max. 6 úrovní; odsazení pod obyčejnou činnost ji změní na fázi (její vazby se po potvrzení odeberou, fáze zatím vazby mít nesmí); předsazení přesune řádek za konec jeho fáze; Nahoru/Dolů jen mezi sourozenci, do jiné fáze předsazením nebo tažením (nad fází: horní třetina = před, prostředek = dovnitř, spodní třetina = za); zkratky Alt+Shift+šipky; fázi s činnostmi nejde změnit na činnost/milník; délka fáze = pracovní dny od jejího začátku do konce; sbalení fáze je jen volba zobrazení (mimo Zpět/Znovu, zatím se neukládá – řeší fáze 5) |
| 1.4 | 14. 11. 2026 | Fáze 4b – tažení: posun úsečky přichytí začátek na nejbližší pracovní den a nastaví omezení „začít nejdříve k datu“; pravý okraj mění konec (délku, min. 1 den), levý okraj mění začátek a konec zůstane; milník se jen posouvá, fázi táhnout nejde; během tažení náhled s daty, Esc zruší, jedno tažení = jeden krok Zpět. Omezení: začátek = nejpozdější z (začátek projektu, vazby, omezení); když vyhraje vazba, aplikace to vysvětlí (otevřená otázka č. 1 uzavřena); ikona 📌 u činnosti, kliknutím se omezení zruší. Začátek a Konec jdou zadat v tabulce (Začátek = omezení, smazání ho zruší; Konec přepočítá délku). Zkratky (G-06): Ctrl+Enter nová činnost pod výběr, Ctrl+D duplikovat (fáze i s činnostmi), Ctrl+Delete smazat (jen mimo textové pole), Alt+Shift+šipky, Ctrl+Z/Y, F1 přehled. Výkon: krok tažení < 3 ms; puštění, které posune všech 300 řádků, cca 0,4 s – zrychlení (např. pole data až po kliknutí) ve fázi 13 |
