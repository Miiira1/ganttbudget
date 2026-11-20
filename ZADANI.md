# ZADÁNÍ: Aplikace pro Ganttovy diagramy s navázaným rozpočtem

> Název aplikace: **MiRo project** (pracovní název do v1.10: GanttBudget)
> Verze zadání: 1.35 · Datum: 20. 11. 2026 (změny viz kap. 14)
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
| Vzhled | Čistý, moderní, podle značky MiRo project (N-13); světlý i tmavý režim |
| Jazyky | Čeština a angličtina (rozšiřitelné o další) |
| Časová jemnost | Dny (pracovní dny dle kalendáře) |
| Měna | Jedna měna na projekt, výchozí CZK, volitelně jiná |
| Vazby | Všechny čtyři typy (FS, SS, FF, SF) + prodlevy (lag/lead) |
| PM koncepty | Milníky, kritická cesta a rezervy, zdroje, baseline a sledování plnění |
| Kalendář | Projektový kalendář + volitelné kalendáře zdrojů |
| Rozpočet | Položky přiřazené k činnostem; kategorie + volné štítky |
| AI | Kopírování promptu a JSON (bez API klíčů); později průvodce generováním plánu |
| Myšlenková mapa | Vestavěný jednoduchý editor (pozdější fáze) |
| Distribuce | Veřejný web zdarma (GitHub Pages); zdrojový kód veřejně viditelný, **všechna práva vyhrazena** (od v1.30, dříve open source MIT) |
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
| F-01 | Činnosti lze zadávat v **textové tabulce** (název, začátek, konec, délka, předchůdci, % hotovo, poznámka; sloupec zdroje přibude ve fázi 6) i **graficky** v úsečkovém diagramu. Obě podoby jsou vždy synchronní. **Nová činnost tažením** (fáze 13c): pod posledním řádkem grafu je pruh „Táhněte sem vodorovně“; tah myší nebo prstem ukáže náhled s daty a délkou, po puštění vznikne činnost na konci plánu se začátkem 📌 (jen když začíná později než projekt, nikdy dřív) a délkou v pracovních dnech, kurzor skočí do jejího názvu; krátké kliknutí nic nevytvoří, Esc zruší, jeden krok Zpět. Tabulka má dole stejně vysoký prázdný řádek, aby řádky lícovaly. | M |
| F-02 | Typy položek: **činnost**, **fáze** (sumární), **milník** (délka 0). | M |
| F-03 | **Hierarchické sdružování** činností do fází, neomezené zanořování (rozumný limit např. 6 úrovní). Fázi lze sbalit a rozbalit. | M |
| F-04 | Fáze automaticky počítá začátek, konec a délku z podřízených činností. | M |
| F-05 | **Přeskupování**: přetažení řádku (drag & drop), odsazení a předsazení (změna úrovně), přesun nahoru/dolů klávesami. | M |
| F-06 | Automatické číslování (WBS, např. 1.2.3). | M |
| F-07 | Vazby mezi činnostmi: **FS, SS, FF, SF** s prodlevou (kladnou i zápornou) v **pracovních dnech** podle kalendáře projektu (jako MS Project). Zadání textem (např. `3FS+2`) i kreslením v grafu. **Milník je okamžik**: leží buď na konci dne (když ho určuje konec předchůdce – FS, FF, SF), nebo na začátku dne (SS, omezení, začátek projektu). Všechny vazby z milníku počítají s tímto okamžikem: z milníku na konci pátku začne následník FS i SS až v pondělí; z milníku na začátku čtvrtka smí následník FF skončit už ve středu (od v1.32). | M |
| F-08 | Po změně činnosti se **automaticky přepočítají** následníci. Detekce cyklů s jasnou chybovou hláškou. | M |
| F-09 | Kritická cesta a rezervy (volná i celková), zvýraznění kritických činností: zpětný průchod jádra (pozdní začátek a konec), **celková rezerva** = o kolik pracovních dnů se položka smí zpozdit bez posunu konce projektu, **volná** = bez posunu následníka; **kritická** = celková rezerva ≤ 0 (fáze: nejmenší rezerva z podřízených). Přepínač **Kritická cesta** (žluté úsečky a vazby, pruh rezervy) a sloupec **Rezerva** (volná v bublině). | D (fáze 6c) |
| F-10 | Poznámky k činnostem, barvy činností/fází. | D |
| F-11 | **Hromadný výběr**: Ctrl+klik přidá / odebere řádek, Shift+klik vybere rozsah (v tabulce i na úsečkách), Esc výběr zruší. Hromadně fungují Odsadit, Předsadit, Nahoru, Dolů, Duplikovat, Smazat (jedno potvrzení), přetažení řádků i posun úseček. Každá akce = jeden krok Zpět; když nejde u některého řádku, nezmění se nic. | M (doplněk po fázi 5) |

### 4.2 Ganttův diagram (grafické ovládání)

| ID | Požadavek | Prio |
|---|---|---|
| G-01 | Úsečkový diagram vedle tabulky, sdílené svislé posouvání, oddělovač lze posouvat. | M |
| G-02 | **Tažení úsečky** = posun činnosti; **tažení okrajů** = změna délky. Pohyb se přichytává na pracovní dny. | M |
| G-03 | **Kreslení vazby** tažením z konce/začátku jedné úsečky na druhou; typ vazby plyne z toho, kam se táhne. | M |
| G-04 | Zoom časové osy: dny, týdny, měsíce, čtvrtletí. Zvýraznění dneška, víkendů a svátků. | M |
| G-05 | **Undo/Redo** (Ctrl+Z / Ctrl+Y) napříč všemi operacemi. | M |
| G-06 | Klávesové zkratky (nová činnost, odsadit, smazat, duplikovat), přehled zkratek v aplikaci. | M |
| G-07 | Zobrazení vazeb šipkami, milníků kosočtverci, fází jako sumárních úseček. **Popisky vedle úseček** (doplněk po fázi 13): tlačítko „Popisky ▾“ v liště plánu se zaškrtávacími políčky Název, Termín, Délka, % hotovo, Náklady (výchozí jen Název; volbu si pamatuje prohlížeč); text vpravo od úsečky (za kolečkem vazby), náklady zkráceně, u milníku bez délky; osa se vpravo prodlouží, jen když popisky nemají místo; stejné popisky i v exportu SVG / PNG / PDF. | M |
| G-08 | Zobrazení baseline a % hotovo: **% hotovo** = tmavší výplň úsečky zleva; u činnosti se zadává ručně, u fáze se počítá z jejích činností (váha = plánovaný náklad z vybrané baseline, bez něj délka, u samých milníků prostý průměr) a je jen ke čtení; milník má zaškrtávátko „splněno“ (0 / 100 %). Přepínač **Baseline** vedle Kritické cesty (pamatuje si ho prohlížeč) ukáže pod úsečkami tenkou šedou stínovou úsečku s termíny vybrané baseline; bublina úsečky ukáže % hotovo, termíny baseline a posun konce v kalendářních dnech. | D (fáze 9) |
| G-09 | Funkční na tabletu (dotyk): na zařízení s „hrubým“ ukazatelem (`pointer: coarse`) **větší úchyty** – úsečka se chytá po celé výšce řádku, okraje 16 px místo 6 px, kolečka pro kreslení vazeb větší a u vybraných řádků stále vidět (najet myší nejde). **Tažení úseček** (i skupiny) a **mapy** prstem. **Dlouhý stisk ½ s** na úsečce nebo řádku tabulky = přidat / odebrat z výběru (náhrada Ctrl+klik); pohyb prstu o víc než 8 bodů = tažení. Klepnutí vybere jen tuto položku. **Řádky** se na dotyku přesouvají tlačítky Nahoru / Dolů (tažení za ⠿ používá přetahování prohlížeče, které na dotyku spolehlivě nefunguje). Ověřeno v emulaci dotykového zařízení. | D (fáze 13c) |

**Pravidlo posunu úsečky.** Při tažení činnosti s předchůdci se nastaví omezení „začít nejdříve k datu". Skutečný začátek = pozdější z (omezení, vyplývající z vazeb). Aplikace to uživateli srozumitelně vysvětlí (např. ikonou a tooltipem). Přesné chování se ověří ve fázi 4b roadmapy.

### 4.3 Kalendář

| ID | Požadavek | Prio |
|---|---|---|
| K-01 | Projektový kalendář: pracovní dny (výchozí Po–Pá), pracovní doba se v dnech neřeší. | M |
| K-02 | **České státní svátky se načtou automaticky** pro libovolný rok (včetně pohyblivých: Velký pátek – svátkem od roku 2016, Velikonoční pondělí; výpočet algoritmem, bez externí služby). | M |
| K-03 | **Vlastní výjimky**: libovolné dny nebo rozsahy (podniková odstávka, dovolená) a ruční přidání/odebrání svátků. Lze i vypnout automatické svátky. | M |
| K-04 | Možnost zvolit jinou sadu svátků než českou: **Slovensko, Polsko, Německo (celostátní svátky), Rakousko** nebo bez státních svátků (struktura připravená na další země). Nepovinné pole `calendar.holidayCountry` (chybí = Česko; „bez svátků“ = `useCzechHolidays: false`). Výběr v okně Kalendář a v průvodci, položka „Země státních svátků“ v sešitu Excelu (starší sešity = Česko), země v exportu pro AI. Seznamy ověřené 17. 11. 2026 a vázané na roky: **SK** podle zákona č. 241/1993 Z. z. ve znění do 256/2026 Z. z. (Slov-Lex): 1. 1., 6. 1., Velký pátek, Velikonoční pondělí, 1. 5., 8. 5., 5. 7., 29. 8., 15. 9., 1. 11., 24.–26. 12.; 1. 9. volno jen do 2023 (530/2023), 17. 11. jen do 2024 (261/2025), 8. 5. a 15. 9. nejsou volno v roce 2026 (§ 4b), 28. 10. je státní svátek, ale volno nikdy. **PL** (ustawa o dniach wolnych od pracy): 1. 1., 6. 1. (od 2011), Velikonoční neděle a pondělí, 1. 5., 3. 5., Letnice, Boží tělo, 15. 8., 1. 11., 11. 11., 24. 12. (od 2025), 25.–26. 12. **DE** celostátní: 1. 1., Velký pátek, Velikonoční pondělí, 1. 5., Nanebevstoupení, Svatodušní pondělí, 3. 10. (od 1990), 25.–26. 12.; 31. 10. jen 2017 (svátky spolkových zemí ne). **AT** (Arbeitsruhegesetz § 7): 1. 1., 6. 1., Velikonoční pondělí, 1. 5., Nanebevstoupení, Svatodušní pondělí, Boží tělo, 15. 8., 26. 10., 1. 11., 8. 12., 25.–26. 12. (Velký pátek ne). | D (fáze 13d) |
| K-05 | Kalendáře zdrojů: nepřítomnosti pracovníka jako rozsahy od–do s poznámkou (dialog z tabulky Pracovníci, sloupec s počtem pracovních dnů; max. 200 záznamů, jeden nejvýš 731 dnů). Ovlivní **jen vytížení a varování**, termíny činností se nemění. | D (fáze 6c) |

Státní svátky ČR k zakódování: 1. 1.; Velký pátek; Velikonoční pondělí; 1. 5.; 8. 5.; 5. 7.; 6. 7.; 28. 9.; 28. 10.; 17. 11.; 24. 12.; 25. 12.; 26. 12. (Claude Code má jejich seznam před zakódováním ověřit proti aktuální legislativě.) ✅ Ověřeno 14. 11. 2026 proti zákonu č. 245/2000 Sb. ve znění novely 59/2026 Sb. (ta přidala jen významný den 30. 3., který není dnem pracovního klidu).

### 4.4 Zdroje

| ID | Požadavek | Prio |
|---|---|---|
| Z-01 | **Databáze (číselníky) zdrojů v projektu**: **profese** (sazba, kapacita h/den, kategorie nákladů), **pracovníci** (jméno, profese, vlastní nebo zděděná sazba, kapacita h/den, nepřítomnosti), **stroje a zařízení** (sazba Kč/h nebo Kč/den, kapacita h/den), **materiály a díly** (jednotka, jednotková cena, kategorie, volitelně kód/dodavatel), **střediska** (kód, název; pracovník volitelně patří do střediska – dimenze pro analytiku A-01 a A-04). Samostatná obrazovka „Zdroje“; pořadí jejích podzáložek si uživatel může změnit (tažením nebo Alt+Shift+←/→, pamatuje si ho prohlížeč). Položku použitou na činnostech nejde smazat bez varování. | D (fáze 6a) |
| Z-02 | Přiřazení zdroje k činnosti jako **řádek činnosti**: člověk = profese a volitelně konkrétní pracovník (sazba pracovníka, jinak profese) + % zapojení; stroj + % využití. Hodiny = délka položky (pracovní dny; u fáze spočítaná délka) × h/den × % (h/den i sazba pracovníka, jinak profese). Řádky se zadávají v panelu **Detail činnosti** pod plánem. **Délka činnosti se zdroji nemění** (žádné automatické přeplánování). | D (fáze 6b) |
| Z-03 | Detekce přetížení zdroje: poptávka = h/den × % řádku v každém pracovním dni položky; kapacita pracovníka = h/den (při nepřítomnosti 0), **profese** = součet jejích pracovníků (poptávka ze všech řádků profese; bez pracovníků se přetížení nehlásí), stroje = h/den; přetížený den = poptávka > kapacita. Pohled **Vytížení** (mřížka zdrojů × dny/týdny/měsíce, nejvyšší denní vytížení v %, histogram a činnosti vybraného zdroje, odznak s počtem přetížených) a ⚠ varování v panelu Detail činnosti (nepřítomnost, přetížení). | D (fáze 6c) |
| Z-04 | **Kalkulace hodinové sazby** profese nebo pracovníka: (hrubá mzda × 12 + odvody zaměstnavatele, výchozí 33,8 % + přidělená režie Kč/rok nebo % ze mzdy) ÷ produktivní hodiny ((pracovní dny roku dle kalendáře − dovolená − nemoc) × h/den × produktivita %). Výpočet je vidět krok po kroku; ruční sazba ho přepíše. Peníze v haléřích. | D (fáze 6a) |
| Z-05 | **Knihovna zdrojů**: číselníky jdou exportovat jako samostatný soubor (`.ganttbudget-lib.json`) a načíst do jiného projektu (ověření schématem Zod, náhled, sloučení podle názvu). | D (fáze 6a) |

### 4.5 Rozpočet a náklady

| ID | Požadavek | Prio |
|---|---|---|
| R-01 | Zdroje i náklady jsou **řádky navázané na činnost nebo fázi** (jeden řádek = jeden zdroj nebo položka); **milník** smí mít jen jednorázový náklad a materiál. Posun činnosti automaticky posune náklady v čase. | D (fáze 6b) |
| R-02 | Typy řádků: **člověk** (hodiny × sazba), **stroj** (hodiny × sazba), **materiál** (množství × jednotková cena z databáze – změna ceny v databázi se propíše, na řádku ji jde přepsat), **jednorázový náklad k datu** (na začátku/na konci činnosti nebo k pevnému datu), **průběžný náklad** (za pracovní den × pracovní dny; za týden × kalendářní dny ÷ 7; za měsíc – každý kalendářní den = částka ÷ počet dní jeho měsíce). Stroj se sazbou za den: dny × % × sazba. Množství materiálu až na 3 desetinná místa. Peníze v haléřích, zaokrouhlení u každého řádku. | D (fáze 6b) |
| R-03 | **Kategorie nákladů** (editovatelný číselník, výchozí: materiál, mzdy, služby, investice, režie, rezerva – hotovo ve fázi 6a/6b) + **volné štítky** u řádků: nejvýš 10 na řádek, každý 1–30 znaků, bez opakování (velikost písmen se nerozlišuje); zadávají se jako „bublinky“ v panelu Detail činnosti s nápovědou už použitých štítků. | D (fáze 7) |
| R-04 | **Časový náběh nákladů**: každý řádek se rozloží do dnů a součet dnů se rovná nákladu řádku **na haléř** (zbytky dostanou dny s největším zbytkem po dělení). Člověk, stroj a průběžný za den rovnoměrně do pracovních dnů položky; **materiál celý v den začátku**; jednorázový na začátku / na konci / k datu; průběžný za týden do kalendářních dnů (1/7), za měsíc do kalendářních dnů (částka ÷ počet dní měsíce); řádky fáze do její spočítané délky; položka bez termínu (kruh) se nezapočítá a pohled to napíše. Pohled **Náklady** (čtvrtý pohled): tabulka podle kategorií, fází nebo druhu × týdny / měsíce / čtvrtletí, za období i kumulativně; graf se skládanými sloupci v odstínech značky, kumulativní čárou a čárou limitu; filtry s více volbami (kategorie, fáze, druh) a filtr štítku. | D (fáze 7) |
| R-05 | Souhrn nákladů za fázi (vlastní řádky + součet podřízených) a za celý projekt: sloupec **Náklady** v tabulce (bublina s rozpadem na práci, stroje, materiál, ostatní) a náklady projektu v záhlaví. | D (fáze 6b) |
| R-06 | Volitelný **limit rozpočtu** celého projektu a jednotlivých kategorií (dialog Limity rozpočtu v pohledu Náklady, čerpání v %). Varování při překročení: v záhlaví („Náklady: X z limitu Y“ červeně), v pohledu Náklady (o kolik a **od kterého data** kumulativní náklady limit přesáhnou), v grafu čára limitu a bod překročení. Smazání kategorie smaže i její limit (s upozorněním). Filtry pohledu limity neovlivňují. | D (fáze 7) |

### 4.6 Analytika a dashboardy

| ID | Požadavek | Prio |
|---|---|---|
| A-01 | **Interaktivní kontingenční tabulka** (pátý pohled **Analýza**): uživatel volí řádky (1–2 úrovně), sloupce (žádné nebo 1 dimenze), metriku a agregaci. Dimenze: fáze (položka nejvyšší úrovně), činnost, kategorie, štítek, druh nákladu, zdroj (pracovník / profese / stroj / materiál / název nákladu), profese, středisko, týden/měsíc/čtvrtletí; chybějící hodnota = „(neuvedeno)“. Metrika náklad (Kč) nebo hodiny, agregace součet / průměr na řádek činnosti / počet / minimum / maximum. Filtry s více volbami pro každou dimenzi (tlačítka „Vybrat vše“ a „Odebrat vše“). Součty řádků, sloupců i celkem; řádek se dvěma štítky patří do obou skupin, ale „Celkem“ ho počítá jen jednou (tabulka to vysvětlí poznámkou). Čísla vycházejí ze stejného rozkladu po dnech jako pohledy Náklady a Vytížení, takže se s nimi nikdy nerozejdou. Export tabulky do XLSX a CSV (s ochranou proti vzorcům). | D (fáze 8) |
| A-02 | K tabulce přiložené **grafy** (sloupcový, čárový, koláčový, skládaný, nebo bez grafu), přepínání jedním klikem; SVG bez knihovny, odstíny značky v pevném pořadí (skupiny nad 9 se sloučí do „Ostatní“), legenda a bubliny s přesnými čísly. Typ, který by klamal, je zablokovaný s vysvětlením (čárový a skládaný potřebují sloupce; průměr, minimum a maximum nejde sčítat do celku; štítky v řádcích se překrývají). Tabulka a graf **vedle sebe** (výchozí poměr 2/3 : 1/3) nebo **pod sebou**, podíl se mění rozdělovníkem; volba se pamatuje v prohlížeči. | D |
| A-03 | **Dashboard „Náklady v čase"** v pohledu Náklady: ukazatele celkem, plánováno do dneška (včetně), zbývá, nejdražší období, průměr za období (všechny podle filtrů) a čerpání limitu (vždy za celý projekt, při překročení červeně). Graf s přepínačem **S-křivka** (kumulativní náklady, čára limitu a bod překročení – jen bez filtrů) / **Cash flow** (výdaje za období skládané podle členění); každý má **jedinou osu** (graf se dvěma osami z fáze 7 zrušen); tyrkysová čára „Dnes“. Cash flow zatím jen výdaje, příjmy později. | D |
| A-04 | **Dashboard „Vytížení zdrojů"** v pohledu Vytížení: filtry druh zdroje, středisko (mají ho jen pracovníci; profese, stroje a lidé bez střediska = „(bez střediska)“) a „jen přetížené“; ukazatele přetížené zdroje, přetížené dny celkem, nejvyšší a průměrné vytížení (naplánováno / kapacita) za celý plán. Spodní panel přepíná **Vybraný zdroj / Souhrn skupiny**: souhrnný histogram (součet poptávky proti součtu kapacit po obdobích, přetížení červeně) zvlášť pro každý druh zdroje – profese obsahuje hodiny svých pracovníků, sčítání by je zdvojilo; profese bez pracovníků se do souhrnu s kapacitou nezapočte (falešné přetížení). | D |
| A-05 | **Dashboard „Plán vs. skutečnost"** – šestý pohled **Sledování**: až 10 pojmenovaných **baseline** (snímek termínů a plánovaného nákladu po dnech; uložit, vybrat ke srovnání, přejmenovat, smazat – každé jeden krok Zpět); **datum stavu** (prázdné = dnes); dlaždice **BAC, PV, EV, AC, SPI, CPI, EAC (ETC), VAC** – u každé ⓘ s názvem, významem a vzorcem a box „Jak číst Earned Value“ (U-03); index pod 0,95 a záporné VAC červeně s ikonou a textem; dělení nulou = „–“ s vysvětlením. Graf v Kč s jedinou osou (týdny / měsíce / čtvrtletí): PV čárkovaně za celé období, AC do data stavu, EV jako bod v datu stavu (historie % hotovo se neukládá), svislá čára data stavu. Tabulka činností: termíny baseline a plánu, posun konce, % hotovo, BAC, PV, EV, AC, CV, SV, Celkem; export XLSX / CSV. Činnost přidaná po uložení baseline má BAC 0 (skutečnost se počítá), smazaná zůstává pod svou fází (PV běží, hotovo 0 %). | D (fáze 9) |
| A-06 | Nabídka **Pohled** v Analýze: pět přednastavených pohledů pro začátečníky (náklady podle kategorií po měsících, podle fází a druhu, hodiny lidí po týdnech, mzdové náklady podle středisek po čtvrtletích, štítky × kategorie) a vlastní pohledy uložené **v souboru projektu** (uložit jako nový, uložit změny, přejmenovat, smazat – každé jeden krok Zpět; nejvýš 50). | D |

### 4.7 Import a export

| ID | Požadavek | Prio |
|---|---|---|
| I-01 | **Celý projekt jako JSON** (otevřít/uložit, záloha, vstup pro AI). Formát je verzovaný (pole `schemaVersion`), aby šly starší soubory načíst. Soubor projektu je čitelný JSON s odsazením, **limit 50 MB** (od v1.31; pokryje i maximum schématu 5 000 činností a 10 baseline). Když by uložený soubor limit přesáhl, uloží se a aplikace varuje, že ho nepůjde znovu otevřít. Limit 5 MB platí dál pro importy (I-04 až I-07, knihovna zdrojů). | M |
| I-02 | Automatická záloha rozpracovaného projektu v prohlížeči (obnova po zavření záložky). Záloha se ukládá úsporně bez odsazení (od v1.31), starší zálohy s odsazením se dál obnoví. | M |
| I-03 | **Export a import činností do CSV a XLSX** (včetně hierarchie, vazeb, délek). Import s náhledem a kontrolou chyb před potvrzením. | M |
| I-04 | **Export a import rozpočtu a časového náběhu nákladů do CSV a XLSX**: export XLSX má list **Řádky** (WBS, Činnost, Typ, Zdroj / název, Pracovník, Podíl % / množství, Částka / cena, Kdy / období, Datum, Kategorie, Štítky, Poznámka a vypočtené h/den, Sazba Kč/h, Hodiny, Náklad) a list **Náběh** (kategorie × měsíce, Celkem, kumulativně); CSV obsahuje Řádky. Import (CSV nebo list Řádky) s náhledem: činnost podle WBS, zdroje a kategorie podle názvu (nic se nevytvoří samo), Hodiny a Náklad se ignorují; **nahradí řádky činností uvedených v souboru**, ostatní zůstanou; jakákoli chyba (s číslem řádku) import zablokuje; jeden krok Zpět; limit 5 MB / 20 000 řádků; české i anglické hlavičky. | D (fáze 7) |
| I-05 | Export Gantta do **PDF** a obrázku (PNG/SVG) pro odevzdávání úkolů – tak, jak je plán vidět (měřítko osy, sbalené fáze, kritická cesta). Obrázek: nadpis a podtitul (začátek, konec, počet položek, datum vytvoření), tabulka (č., WBS, název, začátek, konec, délka), časová osa s volnými dny, úsečky s % hotovo, šipky vazeb; vždy světlé barvy značky, texty escapované. **SVG** a **PNG** (2× rozlišení, nejvýš 16 000 bodů na stranu) přímo z menu Soubor. **Tisk / PDF** (menu Soubor, Ctrl+P): papír A4 / A3 na šířku (okraje 10 mm), měřítko osy automaticky (nejpodrobnější čitelné) nebo ručně, kritická cesta; stránkování po řádcích s nadpisem a osou na každé stránce, PDF uloží tisk prohlížeče („Uložit jako PDF“). Velmi široký diagram se zmenší na šířku stránky (s upozorněním) – dělení do šířky zatím ne. Bez nové knihovny. | D (fáze 13a) |
| I-06 | Import ze souborů MS Project (XML) a GanttProject (.gan): **jen plán** – činnosti, fáze, milníky, vazby s prodlevou, % hotovo, poznámky, začátek projektu (zdroje a náklady ne). Menu **Soubor → Importovat → Plán z MS Project (XML)… / Plán z GanttProject (.gan)…**. **MS Project** (Uložit jako → XML): strom podle OutlineLevel (souhrnný úkol projektu se vynechá), Summary → fáze, Milestone → milník, Duration na pracovní dny podle MinutesPerDay (výchozí 480), PercentComplete, Notes, omezení „začít nejdříve / začít přesně“ → 📌, vazby PredecessorLink (typy FF / FS / SF / SS, prodleva v desetinách minut; prodleva v % → 0 dní s upozorněním), začátek projektu = StartDate. **GanttProject**: vnořené `<task>` → strom (úkol s podřízenými = fáze), `meeting` → milník, `duration`, `complete`, `<notes>`, vazby `<depend>` uložené u předchůdce (typy 1 SS, 2 FS, 3 FF, 4 SF, `difference` = prodleva), začátek projektu = nejdřívější úkol, úkol bez předchůdce s pozdějším začátkem dostane 📌. Vazby se souhrnnými úkoly / fázemi a na neexistující úkoly se vynechají s upozorněním v náhledu (s počtem). Náhled a nahrazení činností jako u importu tabulky (I-03) – navíc nadpis „Import plánu“, upozornění a nové datum začátku projektu; shodné činnosti si ponechají ID, jeden krok Zpět. XML čte vlastní bezpečný čtenář (bez DOCTYPE a externích entit, nejvýš 64 úrovní a 500 000 prvků), limity 5 MB / 5 000 úkolů / 6 úrovní, kontrola kruhu ve vazbách a ověření Zod; srozumitelné chyby (není XML, není plán z daného programu, žádné úkoly, příliš mnoho / příliš hluboko, kruh). | D (fáze 13b) |
| I-07 | **Celý projekt v jednom sešitu Excelu**: export s listy Projekt, Kalendář, Činnosti, Řádky, Kategorie, Střediska, Profese, Pracovníci (s kalkulací sazby), Nepřítomnosti, Stroje, Materiály a Náběh; **vypočtené sloupce** (termíny, sazby, h/den, hodiny, náklady, plánováno, celý Náběh) šedé s dovětkem „(vypočteno)“ – import je ignoruje a spočítá znovu, takže náklad se mění jen přes vstupy. Fáze 9 přidala list **Skutečnost** (WBS, činnost, datum, částka, poznámka; nepovinný kvůli starším sešitům – bez něj zůstanou skutečné náklady činností beze změny, s ním nahradí skutečné náklady všech činností). Import (jen .xlsx) s náhledem počtů za listy: listy se propojují názvy (jedinečné) a WBS, položky databáze se stejným názvem si ponechají ID, **činnost se stejným WBS, názvem a druhem si ponechá ID i skutečné náklady** (baseline ji tak dál pozná; totéž platí pro import činností I-03); baseline, datum stavu a uložené pohledy zůstávají, chybějící list nebo jakákoli chyba (s listem a řádkem) import zablokuje; **nahradí celý projekt** jedním krokem Zpět; limity 5 MB, 2 000 řádků na list databáze; ověření schématem Zod. Soubor projektu (.json, I-01) zůstává hlavním formátem pro zálohu a přenos. | D (doplněk po fázi 7) |

### 4.8 Uživatelská přívětivost

| ID | Požadavek | Prio |
|---|---|---|
| U-01 | **Průvodce prvním projektem** v pěti krocích: název a měna (CZK, EUR, USD, PLN – později se změnit nedá), začátek projektu (výchozí nejbližší pondělí), kalendář (pracovní dny v týdnu, české svátky, odstávky od–do), první fáze (předvyplněné Příprava, Realizace, Předání; nejvýš 12) a shrnutí. Volba „do každé fáze přidat první činnost (5 pracovních dnů) a propojit je za sebou“ (výchozí zapnutá) dá plánu hned tvar bez varování kontroly kvality. Konec projektu vyplyne z plánu (požadovaný konec se zatím neukládá). Každý krok se ověří, než pustí dál. Průvodce se sám neotevírá: nabízí ho okno **Soubor → Nový projekt…** (Prázdný / Průvodce / šablony) a úvodní obrazovka prázdného plánu (Spustit průvodce, Ze šablony…, Přidat činnost, Vzorový projekt). Vytvoření nahradí plán (na neuložené změny se zeptá) = jeden krok Zpět. | D (fáze 10) |
| U-02 | **Vzorové projekty a šablony ze strojírenství a výroby** v okně **Nový projekt**: zavedení automatizace do výroby (29 položek), vývoj nového výrobku (26), zavedení nové výrobní linky (28), investiční akce – výstavba skladové haly (26), plánovaná odstávka a údržba (23). Každá je kompletní (fáze, činnosti, milníky, vazby různých typů, zdroje se sazbami, rozpočet), přeložená do všech jazyků a bez varování kontroly plánu (u automatizace záměrně činnost se SF bez následníka). Karta ukazuje počet položek, délku a rozpočet; šablona začíná k datu, které uživatel zvolí (výchozí nejbližší pondělí), a nemá baseline ani skutečnost – „v běhu“ zůstává jen vzorový projekt z tlačítka **Vzorový projekt** (kap. 11). Šablona je popis dat (`TemplateDef`), projekt z ní staví společná funkce; testy hlídají každou šablonu stejně. | D (fáze 10) |
| U-03 | **Kontextová nápověda**: tooltipy a krátké výukové boxy u pojmů (kritická cesta, rezerva, baseline, CPI…). Jednotné tlačítko **ⓘ** s vysvětlením pojmu (bublina nad vším ostatním, ovladatelná klávesnicí, Esc zavře) u sloupců tabulky (WBS, Začátek, Délka, Rezerva, Předchůdci, % hotovo, Náklady), u přepínačů Kritická cesta a Baseline, v pohledech Vytížení a Náklady (včetně S-křivky / Cash flow) a u dlaždic Sledování (i se vzorcem); okno **Slovníček** (tlačítko 📖 v liště) s 36 pojmy v pěti oddílech a hledáním bez ohledu na diakritiku. Texty ve slovníčku překladů (`glossary.*`). Aplikace nepoužívá odborné termíny bez vysvětlení. | M (základ) / D (fáze 10) |
| U-04 | **Kontrola kvality plánu** (varování, ne blokace) – tlačítko **🔍 Kontrola plánu** v liště se žlutým počtem varování (✓ bez varování) a okno se seznamem podle druhu: překročený rozpočet (projekt, kategorie, od kdy), přetížený zdroj (počet dnů, první den), vazba do minulosti – (a) předstih tak velký, že následník začne dřív než sám předchůdce, (b) činnost nebo milník měly začít před dneškem a mají 0 % hotovo –, činnost s délkou 0, fáze bez činností, bez předchůdce (kromě první takové položky a položek s pevným začátkem 📌), bez následníka (kromě položek končících s koncem projektu). U každého varování „Jak to opravit“ (rada) a akce Ukázat v plánu / Otevřít Vytížení / Otevřít Náklady. Výpočet je čistá funkce s testy (`planCheck.ts`); varování se zatím neskrývají ani neukládají. | D (fáze 10) |
| U-05 | Dobrá výchozí nastavení: nový projekt je použitelný po prvním kliknutí. | M |
| U-06 | Přístupnost: použitelné z klávesnice, dostatečný kontrast, barvy nejsou jediným nositelem informace. Ověřeno ve fázi 13d: test kontrastu barev značky z `src/index.css` (text ≥ 4,5 : 1, grafika ≥ 3 : 1) a zákaz slabých šedých (`text-slate-300/400`, ve tmavém `slate-500/600`) jako textu; automatický audit všech pohledů a oken (popisky ovládacích prvků, obrázky, duplicitní ID, pořadí tabulátoru); viditelný rámeček fokusu; odkaz **„Přeskočit na obsah“** jako první zastávka klávesy Tab; myšlenková mapa jako strom pro čtečky (SVG bez role). Ganttův graf má popisek odkazující na tabulku, která nese stejné údaje přístupně (jednotlivé úsečky se čtečce zvlášť nepředstavují). | M |

### 4.9 Jazyky

| ID | Požadavek | Prio |
|---|---|---|
| L-01 | Čeština a angličtina, přepínač v hlavním menu, volba se pamatuje. | M |
| L-02 | **Žádný pevný text v kódu**. Všechny texty (včetně chybových hlášek a nápovědy) jsou v překladových souborech. Formát data, čísel a měny se řídí jazykem. | M |
| L-03 | Přidání dalšího jazyka = přidání jednoho souboru. | M |

### 4.10 Napojení na AI (bez serveru)

| ID | Požadavek | Prio |
|---|---|---|
| AI-01 | **Export pro AI**: karta „Zkopírovat projekt pro AI“ v okně tlačítka **AI** (ikona čtyřcípé hvězdičky) vyrobí **Markdown**: přehled (termíny, kalendář, náklady, limit), tabulka plánu (číslo řádku, WBS, typ, termíny, délka, předchůdci, rezerva, kritická, % hotovo, náklady, zdroje), rozpočet podle kategorií, zdroje, varování kontroly plánu, Earned Value (je-li baseline) a na konci otázka. Pět přednastavených otázek (rizika, zkrácení termínu, rozpočet, vysvětlení kritické cesty, stav projektu), vlastní otázka nebo bez otázky; náhled textu a počet znaků. Zaškrtávátko „Zahrnout jména pracovníků a sazby“ je ve výchozím stavu vypnuté (pracovníci jen profesí, bez sazeb a mezd). Tlačítko Zkopírovat; když prohlížeč schránku nepovolí, text se označí k Ctrl+C. Nic se neposílá samo. | D (fáze 11) |
| AI-02 | **Generování plánu z textového zadání**: karta „Vytvořit plán s AI“ (i jako volba „Plán s pomocí AI“ v okně Nový projekt): název, začátek, měna a popis → prompt s pravidly a přesným příkladem formátu **AI plán** (kap. 7) → uživatel vloží odpověď → kontrola → náhled (počet položek, délka, rozpočet, konec, varování kontroly plánu, první řádky) → **nový projekt** (na neuložené změny se zeptá, jeden krok Zpět). AI vrací plán a hrubý rozpočet (jednorázové a průběžné náklady v kategoriích; bez lidí a sazeb). Rozepsané zadání vydrží zavření okna, po vytvoření se vyprázdní. | D (fáze 11) |
| AI-03 | Prompty jsou v češtině i angličtině podle jazyka aplikace (role projektového manažera ve strojírenství, 7 pravidel, příklad formátu, „odpověz jen JSON“). Ověřeno na skutečných odpovědích ChatGPT a Claude v obou jazycích; příklad v promptu hlídá test. | D (fáze 11) |
| AI-04 | Odolnost vůči chybám AI: JSON se najde i v textu okolo nebo v bloku ```json; chyby se hlásí srozumitelně s číslem položky (neplatný JSON, chybějící / neplatný údaj, duplicitní id, neexistující předchůdce nebo fáze, vazba s fází, kruh ve vazbách či ve stromu, víc než 6 úrovní, průběžný náklad u milníku, víc než 300 položek, text nad 500 kB). Tlačítko „Zkopírovat prompt na opravu“ (chyby s technickým detailem, příklad formátu, původní odpověď). Milník s délkou se opraví na 0 s upozorněním. Jen `JSON.parse` + Zod, neplatná data se nikdy nepoužijí částečně. | D (fáze 11) |

### 4.11 Myšlenková mapa (pozdější fáze)

| ID | Požadavek | Prio |
|---|---|---|
| MM-01 | Jednoduchý vestavěný editor jako **sedmý pohled „Mapa“**: centrální téma (výchozí název projektu), větve, přidávání/mazání/přesouvání uzlů, sbalování. Klasická mapa do dvou stran (hlavní větve postupně na nižší stranu, podřízené směrem ven, barvy větví podle značky, sbalená větev ukáže „+N“). Ovládání klávesnicí (Tab = podřízený, Enter = sourozenec, F2 / psaní = přejmenovat, Delete = smazat, šipky = pohyb, mezerník = sbalit, Alt+Shift+↑/↓ = pořadí), myší (tažení uzlu doprostřed jiného = pod něj, k okraji = před / za, Esc zruší; kolečko = přiblížení, tažení pozadí = posun) i tlačítky. Mapa se ukládá do projektu (nepovinné pole, starší soubory beze změny), každá úprava = jeden krok Zpět. Nejvýš 500 uzlů, hloubka kořen + 6 úrovní. Přístupnost: strom pro čtečky obrazovky (role tree). | D (fáze 12) |
| MM-02 | Tlačítko „Vytvořit plán z mapy": hierarchie uzlů se stane fázemi a činnostmi (hloubka → úroveň, uzel s podřízenými → fáze, listy → činnosti s délkou 5 pracovních dnů, bez vazeb), uživatel doplní délky a vazby. Prázdný plán se vytvoří; jinak volba „Přidat na konec plánu“ / „Nahradit plán“ (s varováním). Vždy náhled a jeden krok Zpět, mapa zůstane beze změny. | D (fáze 12) |
| MM-03 | Import odsazeného textu (outline) jako alternativní vstup – okno „Vložit text…“: odsazení tabulátory / mezerami, odrážky, číslování a nadpisy „#“ se odstraní; jediný řádek bez odsazení (nebo nadpis nad odrážkami) = střední téma, víc takových se zařadí pod název projektu; přeskočená úroveň se srovná; náhled, chyby s číslem řádku, nahrazení mapy s varováním (jeden krok Zpět). Opačně tlačítko „Zkopírovat jako text“ (osnova s odrážkami). Osnova mapy je i v exportu pro AI (AI-01), pokud mapa má aspoň jednu větev. | D (fáze 12) |

---

## 5. Nefunkční požadavky

| ID | Požadavek |
|---|---|
| N-01 | Běží ve všech aktuálních prohlížečích (Chrome, Edge, Firefox, Safari) bez instalace. |
| N-02 | Plynulé ovládání pro 300 činností (tažení úsečky bez zpoždění, přepočet do 100 ms). Změřeno ve fázi 13c na 300 činnostech v jednom řetězu vazeb (Chrome): přepočet (termíny, náklady, vytížení) ≈ 7 ms; krok náhledu tažení ≈ 16 ms (jeden snímek) i pro 100 vybraných úseček; po puštění včetně překreslení tabulky a grafu ≈ 0,2 s (posun první činnosti posune všech 270 následníků). Pomohlo: `contain: strict` u panelů tabulky a grafu, data v tabulce jako text (pole s kalendářem až po kliknutí), paměť hotových překladů. **Velké plány (od v1.34, audit krok 5)**: celý přepočet po 1 změně (termíny, náklady, náběh, vytížení, rozpočet, fakta, EV, kontrola) u 2 000 činností ≈ 64 ms (dřív 146 ms), u 500 ≈ 14 ms; otevření souboru se 2 000 činnostmi (kontrola Zod) ≈ 43 ms (dřív 92 ms). Spočítané výsledky se pamatují jen pro poslední 3 verze projektu (historie Zpět už kvůli nim nedrží stovky MB), odznaky v záhlaví se dopočítají až po vykreslení změny. Tabulka a graf zatím kreslí všechny řádky (virtualizace = krok 7 plánu oprav). **Velikost aplikace (od v1.35)**: při otevření se stáhne 854 kB JavaScriptu (266 kB po kompresi; dřív 1 127 / 330 kB). Pohledy kromě Plánu, dialogy, mobilní verze a vzorový projekt se stahují až při prvním použití; otevřený dialog zůstává připravený (např. rozepsané zadání pro AI). Oba jazyky zůstávají v hlavním souboru (potřebují je i importy z Excelu a CSV). |
| N-03 | Data zůstávají v počítači uživatele, nic se neposílá na server (zdůraznit v aplikaci). Aplikace nepoužívá sledovací nástroje. |
| N-04 | Světlý i tmavý režim, přepínač a respektování systémového nastavení. |
| N-05 | Rozumné rozložení na šířce od 1024 px; na menších šířkách alespoň čtení. **Mobilní verze** (displej pod 768 px, doplněk po fázi 13): jen prohlížení – úzké záhlaví (symbol loga, název a údaje projektu, ⚙ jazyk a vzhled, menu ⋯: Otevřít projekt, Vzorový projekt, Slovníček, Kde jsou moje data, Plná verze) a spodní lišta pohledů **Plán, Náklady, Sledování, Analýza, Mapa** (Zdroje a Vytížení jen na počítači). Plán = **seznam karet** po fázích (fáze jdou sbalit; karta: název, WBS, termín, délka, % hotovo, kritická cesta, 📌; klepnutím detail – předchůdci, náklady po řádcích, poznámka) nebo **Gantt** (úsporný obrázek bez tabulky, názvy a % hotovo u úseček, měřítko Týdny / Měsíce / Čtvrtletí, posun prstem). Ostatní pohledy bez upravovacích prvků (limity, baseline, export, uložené pohledy, úpravy mapy), nastavení sbalené, souhrnné dlaždice po dvou. Volba **Plná verze ↔ Mobilní verze** se pamatuje (tablet na šířku má plnou verzi). Projekt se do telefonu dostane jen otevřením souboru – aplikace nic neposílá na server. |
| N-06 | **Plánovací jádro je oddělené od uživatelského rozhraní** (čistá funkce: projekt dovnitř, vypočtené termíny ven) a pokryté automatickými testy. |
| N-07 | Zdrojový kód s komentáři a README v češtině. **Licence: všechna práva vyhrazena** (Copyright © 2026 Miroslav Žilka, soubor `LICENSE` česky i anglicky; `package.json` `"license": "UNLICENSED"`). Používání aplikace v prohlížeči pro osobní a výukové účely je dovoleno; kopírování, úpravy a šíření kódu i dokumentace jen s písemným souhlasem autora. Verze zveřejněné do commitu `7434bd3` (19. 11. 2026) zůstávají pod licencí MIT. Knihovny třetích stran a písma (SIL OFL) se řídí svými licencemi. |
| N-08 | Žádná ztráta dat: před přepsáním/importem upozornění, před zavřením s neuloženými změnami varování. |
| N-09 | Chybové hlášky srozumitelné laikovi (co se stalo a co s tím), nikdy technický výpis. |
| N-10 | **Bezpečný import**: každý načítaný soubor (JSON, CSV, XLSX, výstup z AI) se před použitím ověří proti schématu (Zod). Neplatná data se nikdy nepoužijí částečně. Texty od uživatele se nikdy nevkládají do stránky jako HTML. **XLSX (archiv ZIP) se před otevřením zkontroluje** (fáze 13b): nejvýš 50 MB po rozbalení, 2 000 souborů v archivu, poměr komprese do 200 : 1 u souborů nad 1 MB, a skutečná velikost po rozbalení se ověří proudovým rozbalením (podvržená hlavička nepomůže); archiv s předsazenými daty (adresář nekončí přesně před koncovým záznamem) se odmítne. **List** se přečte jen do 60 000 řádků a 5 milionů buněk (ochrana proti „řídkému“ listu s jedinou buňkou daleko vpravo dole; od v1.33). Vlastní čtenář XML čte atributy lineárně (žádné zpomalení dlouhými značkami). Podezřelý soubor se odmítne srozumitelnou hláškou. Nečekaná chyba při vykreslení ukáže hlášku s tlačítkem Obnovit místo bílé stránky (rozpracovaný projekt zůstává v záloze). |
| N-11 | **Bezpečný export**: buňky začínající `=`, `+`, `-`, `@`, tabulátorem nebo CR se v CSV/XLSX ošetří, aby je Excel nespustil jako vzorec (CSV injection). |
| N-12 | **Content Security Policy** v `index.html`: aplikace načítá skripty a styly jen ze své vlastní adresy. |
| N-13 | **Vizuální identita MiRo project** podle **brand kitu 2.0** (směr „Monolinka“: μ a ρ z jednoho tahu, žlutý disk = milník): horizontální logo v záhlaví (světlá / tmavá varianta, výška 28 px, minimum kitu 96 px na šířku), ikona aplikace ve variantě *dark* (favicon ICO/SVG, ikona iOS 180 px). **Písma** (OFL) jako vlastní WOFF2 jen s latinkou a středoevropskými znaky (~21 kB na řez), ne z Google Fonts: **Inter Tight** 500/600 = nadpisy, **Inter** 400/500/600 = text i čísla, data a částky (číslice stejné šířky, aby sloupce lícovaly; na přání uživatele místo JetBrains Mono z kitu), **JetBrains Mono** 400/500 = strojový text (prompt pro AI, náhled exportu, klávesy zkratek). Barvy: základ **grafit** `#262626`, **papír** `#F6F5F0` a teplá šedá škála; **žlutá** `#FFC000` = důležité (primární tlačítko, aktivní pohled, kritická cesta, varování, neuloženo); **tyrkysová** `#3BDAFF` = interakce a stav (výběr, dnešek, najetí myší, fokus, přetahování, informace, běžné úsečky činností průsvitně s rámečkem); červená jen pro chyby a mazání. Žlutá a jasná tyrkysová jsou jen plochy – text na světlém pozadí je grafitový, nebo tmavá tyrkysová `#0E7490` (místo žlutého textu tmavé zlato `#B38600`). Kontrast textu ≥ 4,5 : 1, grafiky ≥ 3 : 1 (WCAG AA, viz U-06; hlídá test). Barvy a písma jsou tokeny v `src/index.css`. **Rozvržení**: záhlaví ve dvou řadách (logo, projekt, akce Soubor / Zpět / Znovu / Kalendář / Kontrola plánu / AI / Nápověda / ⚙ Zobrazení; pod tím záložky pohledů), nástroje pohledu pod záhlavím; panel detailu bez vybrané činnosti jen jako úzký pruh; informace o datech jednořádková a skrývatelná (znovu v Nápovědě). |
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
| Myšlenková mapa | **Vlastní SVG** (rozhodnuto ve fázi 12, v1.21) | Žádná nová knihovna; rozložení mapy je čistá funkce s testy, stejně jako Gantt |
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
  // číselníky (databáze) – součást projektu, exportovatelné jako knihovna (.ganttbudget-lib.json)
  departments: Department[]
  professions: Profession[]
  workers: Worker[]
  machines: Machine[]
  materials: Material[]
  costCategories: Category[]
  budget?: { limit?, categoryLimits: { categoryId, limit }[] }   // limity rozpočtu v haléřích (fáze 7)
  views?: { id, name, config }[]   // uložené pohledy Analýzy (fáze 8, max. 50, ověřené Zod); import celého projektu z Excelu je zachová
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
  percentComplete, notes, color   // % hotovo zadané u činnosti; u fáze se počítá (fáze 9)
  lines: TaskLine[]        // zdroje a náklady činnosti – jeden řádek = jeden zdroj / položka
  actuals?: [{ id, date, amount, note? }]   // skutečné náklady k datu v haléřích, max. 200 (fáze 9)
  // vypočteno enginem, neukládá se: start, finish, lateStart, lateFinish, totalSlack, freeSlack, critical, náklady, vytížení

RateCalc     monthlyWage, employerContribPct (33,8), overhead (Kč/rok | % ze mzdy),
             vacationDays, sickDays, hoursPerDay, productivityPct
             // sazba = roční náklady ÷ produktivní hodiny (Z-04)
Profession   id, name, categoryId, rateCalc?, manualRate?, capacityPerDay
Department   id, name, code?                       // středisko
Worker       id, name, professionId, departmentId?, rateCalc?, manualRate?, capacityPerDay, absences?[] { start, end, note? } (max 200, každá ≤ 731 dnů)
             // sazba: ruční > vlastní kalkulace > sazba profese
Machine      id, name, rate, rateUnit (hour|day), capacityPerDay, categoryId
Material     id, name, unit, unitPrice, categoryId, code?, supplier?

TaskLine     id, categoryId, note?, tags?[] (max 10 × 30 znaků), + podle typu:
  labor      professionId, workerId?, sharePct          // hodiny = dny × h/den × %; pracovník patří k profesi
  machine    machineId, sharePct
  material   materialId, quantity, unitPriceOverride?   // cena z číselníku, nebo přepsaná
  oneTime    name, amount, timing: start|end|date, date?
  recurring  name, amount, period: day|week|month

Baseline     id, name, savedAt, tasks: [{ taskId, parentId, name, kind, start, finish, durationDays,
             costStart?, costs[] }]   // snímek plánu: termíny a vlastní náklad po dnech (haléře) od costStart;
             // max. 10 baseline, 3 660 dnů na položku, 500 000 čísel na baseline (fáze 9)
Project      … activeBaselineId? (baseline ke srovnání), statusDate? (datum stavu; chybí = dnes)
Project      … mindMap?: { nodes: [{ id, parentId (null = střední téma), order, text, collapsed? }] }
             // myšlenková mapa (fáze 12): právě jeden kořen, max. 500 uzlů, 6 úrovní pod kořenem, text 1–200 znaků;
             // nepovinná (schemaVersion zůstává 2), import celého projektu z Excelu ji zachová
Project      … collapsedIds?: string[]   // sbalené fáze (fáze 13c) – jen v souboru a v záloze; v aplikaci je drží
             // stav zobrazení mimo historii Zpět (při uložení se přibalí, po otevření vybalí); neznámá ID se ignorují
```

**Formát „AI plán“ (fáze 11)** – odpověď AI, ze které vznikne nový projekt (nové ID, peníze × 100 na haléře):

```
{ format?: "miro-ai-plan", version?: 1, tasks: [            // 1–300 položek
  { id, name, kind: phase|task|milestone, parent? (id fáze), duration (pracovní dny),
    dependsOn?: [{ id, type?: FS|SS|FF|SF (výchozí FS), lag? (výchozí 0) }],     // jen mezi činnostmi a milníky
    costs?: [{ name, amount (v měně projektu), category: material|labor|services|investment|overhead|reserve,
               when: start|end (jednorázový) | perDay|perWeek|perMonth (průběžný) }] } ] }
```

**Verze souborů.** Projekt `schemaVersion: 2` (fáze 6a); soubor ve formátu 1 (fáze 5) se při otevření
i obnově zálohy sám převede (výchozí kategorie podle jazyka projektu, prázdné číselníky) a ověří schématem.
Knihovna zdrojů `.ganttbudget-lib.json`: `{ kind: "ganttbudget-library", libraryVersion: 1, currency, číselníky }`.

**Plánovací jádro (engine).** Čistá funkce `schedule(project) → vypočtené termíny`:

1. Topologické řazení, detekce cyklů.
2. Forward pass podle vazeb, kalendáře a omezení; backward pass pro rezervy (od fáze 6c).
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
| **6a** | Databáze zdrojů | Obrazovka „Zdroje“: profese, pracovníci s kalkulací sazby, stroje, materiály a díly, kategorie nákladů. Export/import knihovny (Zod). Formát projektu v2 s převodem starších souborů. | Z-01, Z-04, Z-05, R-03 |
| **6b** | Zdroje a náklady na činnostech | Panel detailu činnosti se seznamem řádků (člověk, stroj, materiál, jednorázový, průběžný náklad), náklad činnosti, součty za fáze a projekt, sloupec Náklady v tabulce. | Z-02, R-01, R-02, R-05 |
| **6c** | Kritická cesta a vytížení | Kritická cesta a rezervy, kalendáře zdrojů, varování na přetížení a histogram vytížení. | F-09, K-05, Z-03 |
| **7** | Rozpočet v čase | Časový náběh nákladů z řádků činností, volné štítky u řádků, limit rozpočtu, export/import rozpočtu. | R-03 (štítky), R-04, R-06, I-04 |
| **8** | Analytika a dashboardy | Kontingenční tabulka s grafy, dashboard Náklady v čase (S-křivka), Vytížení zdrojů. | A-01–04, A-06 |
| **9** | Baseline a sledování | Uložení baseline, zadávání % hotovo a skutečných nákladů, dashboard Plán vs. skutečnost a Earned Value. | G-08, A-05 |
| **10** | Učení a přívětivost | Průvodce prvním projektem, vzorové projekty ze strojírenství, kontextová nápověda, kontrola kvality plánu. | U-01–04 |
| **11** | Napojení na AI | Export pro AI, generování plánu z textu přes prompt a import JSON s validací. | AI-01–04 |
| **12** | Myšlenková mapa | Editor mapy, převod na činnosti, import odsazeného textu. | MM-01–03 |
| **13** | Doladění a export | Export do PDF/obrázku, import MS Project/GanttProject, dotyk, přístupnost, výkon. Vytvoření nové činnosti tažením v prázdném místě grafu, ukládání sbalených fází, ochrana proti „nafouknutým“ souborům XLSX, rychlejší náhled při posunu mnoha vybraných úseček. | I-05, I-06, G-09, K-04 |

> ✅ **Roadmapa fází 0–13 je dokončená (17. 11. 2026, zadání v1.28).** Další rozvoj (např. kreslení jen viditelných řádků pro velmi velké plány, tažení řádků prstem) podle potřeby.

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

Od fáze 9 je vzorový projekt **„v běhu“**: začíná 8 týdnů před dneškem, má baseline „Schválený plán“ uloženou k začátku, % hotovo odpovídá stavu o týden pozadu a skutečné náklady do včerejška jsou o 6 % vyšší než hodnota hotové práce (milníky přesně) – pohled Sledování tak ukazuje mírné zpoždění a předražení.

---

## 12. Kritéria přijetí (verze 1.0 / MVP)

Student bez předchozí zkušenosti s PM dokáže **do 15 minut a bez návodu**:

1. Vytvořit nový projekt a pojmenovat ho.
2. Přidat tři fáze a do nich 10 činností textem a termíny upravit tažením v grafu.
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
| 4 | Průběžný náklad „za měsíc" u činnosti, která nezačíná na začátku měsíce | ✅ Rozhodnuto (v1.13): poměrně po kalendářních dnech – každý den = částka ÷ počet dní jeho měsíce (stejně v nákladech i v náběhu) |
| 5 | Skutečné náklady (AC) pro Earned Value | ✅ Rozhodnuto (v1.16): ručně jako položky k datu u činností (datum, částka, poznámka; panel Detail činnosti a list Skutečnost v sešitu); do AC se počítají jen položky do data stavu včetně |
| 6 | Pracovní název a logo aplikace | ✅ Rozhodnuto (v1.11): **MiRo project**, logo a barvy podle brand kitu (N-13). Přípony souborů `.ganttbudget.json` / `.ganttbudget-lib.json` a klíče v prohlížeči zůstávají kvůli kompatibilitě s uloženými projekty |
| 7 | Licence | ✅ Rozhodnuto (v1.30, 20. 11. 2026): **všechna práva vyhrazena**, držitel Miroslav Žilka (viz N-07). Původní MIT platí jen pro verze do commitu `7434bd3` |
| 8 | Použití ve výuce: potřeba odevzdávat projekty učiteli | Zatím soubor projektu (.json), sešit celého projektu (XLSX, I-07) nebo PDF e-mailem či přes LMS |
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
| 1.5 | 14. 11. 2026 | Fáze 4c – typy vazeb: FS = následník začne další pracovní den po konci předchůdce; SS = začne nejdřív v den začátku předchůdce; FF = skončí nejdřív v den konce předchůdce; SF = skončí nejdřív pracovní den před začátkem předchůdce; prodleva i předstih v pracovních dnech; více vazeb a omezení – platí nejpozdější hranice; milník leží na konci dne (FS, FF, SF) nebo na začátku dne (SS, omezení, začátek projektu). Zápis: `3SS+2`, zobrazení vždy FS/SS/FF/SF (výchozí FS se nepíše), lze psát i česky KZ/ZZ/KK/ZK; mezi dvěma činnostmi nejvýš jedna vazba; fáze zatím vazby nemají. Kreslení v grafu: z koleček u začátku / konce úsečky, levá polovina cíle = do začátku, pravá = do konce; kruh a fáze se odmítnou s vysvětlením, existující vazba se nahradí novým typem. Vzorový projekt obsahuje všechny typy (úprava podlahy SS+10, programování PLC FF, nová činnost „Náhradní ruční výroba do zkušebního provozu“ SF) |
| 1.6 | 14. 11. 2026 | Fáze 5 – ukládání a výměna dat: projekt se ukládá jako `název.ganttbudget.json` (čitelný JSON se `schemaVersion`, limit 5 MB; soubor z novější verze → srozumitelná hláška); kontrola souboru navíc hlídá podřízené jen pod fází, kruh v nadřazených, hloubku max. 6, vazby na sebe / na fázi / duplicitní. Uložit v Chrome/Edge přímo do souboru, jinde stažením; „● neuloženo“ a varování před zahozením změn. Záloha v IndexedDB 1 s po změně, po otevření se obnoví sama (také ověřená schématem). Export XLSX (ExcelJS, načtený až při použití) a CSV (UTF-8 s BOM, středník, CRLF) se sloupci Č., WBS, Úroveň, Název, Typ, Začátek, Konec, Délka, Předchůdci, Začít nejdříve, % hotovo, Poznámka; hierarchie se při importu bere ze sloupce Úroveň (Excel mění WBS „1.2“ v CSV na datum). Ochrana proti CSV injection: apostrof před `= + - @`, tabulátor a CR, import ho odstraní. Import nahradí činnosti (název a kalendář zůstanou) po náhledu, jeden krok Zpět; jakákoli chyba (s číslem řádku) import celý zablokuje; limit 5 MB / 5 000 řádků; české i anglické hlavičky a typy; vzorce z XLSX se nespouštějí. Název projektu jde změnit kliknutím v záhlaví. Kritérium 12.2 upraveno (činnosti textem, termíny tažením); tvorba činnosti tažením v grafu, ukládání sbalených fází a ochrana proti „nafouknutým“ XLSX přesunuty do fáze 13. Nasazení: GitHub Actions (testy + build + Pages), Dependabot jednou týdně |
| 1.7 | 14. 11. 2026 | Doplněk po fázi 5 – hromadný výběr (nový požadavek F-11): Ctrl+klik / Shift+klik v tabulce i na úsečkách, Esc zruší, počet vybraných v liště. S vybranou fází jdou i její položky. Hromadné akce: Odsadit (souvislý blok pod řádek nad prvním, nesouvislé každý pod řádek nad sebou), Předsadit (pořadí zůstane), Nahoru/Dolů (blok o jedno místo), Duplikovat (kopie souvislého bloku za blok), Smazat (jedno potvrzení s počtem položek), přetažení řádků za ⠿ (celý výběr ve stejném pořadí) a posun úseček (tažená se přichytí na pracovní den, ostatní o stejný počet pracovních dnů, každá dostane omezení „začít nejdříve“; okraje jen u jedné úsečky, fáze se neposouvají). Každá akce = jeden krok Zpět; když nejde u jednoho řádku, nezmění se nic. Výkon: puštění 300 úseček ≈ 0,3 s, krok náhledu ≈ 70 ms – zrychlení ve fázi 13 |
| 1.8 | 15. 11. 2026 | Zdroje a náklady – architektura před fází 6: číselníky (databáze) v projektu – profese, pracovníci, stroje, materiály a díly, kategorie; exportovatelné jako knihovna `.ganttbudget-lib.json` (Z-05). Kalkulace hodinové sazby z mzdy, odvodů, režie a produktivních hodin, s ruční sazbou navíc (Z-04). Na činnosti jeden seznam řádků `Task.lines` (člověk, stroj, materiál, jednorázový, průběžný náklad) místo `assignments` + `CostItem`; člověk = profese a volitelně pracovník (sazba pracovníka, jinak profese); cena materiálu z databáze se propíše, na řádku jde přepsat; délka činnosti se zdroji nemění. Fáze 6 rozdělena na 6a (databáze zdrojů), 6b (zdroje a náklady na činnostech), 6c (kritická cesta a vytížení); fáze 7 zúžena na rozpočet v čase |
| 1.9 | 15. 11. 2026 | Fáze 6a – databáze zdrojů: nový číselník **střediska** (kód, název; Worker.departmentId volitelně) jako dimenze pro analytiku; pořadí podzáložek Zdrojů lze měnit (tažení, Alt+Shift+←/→, pamatuje si prohlížeč, „Výchozí pořadí“). Pravidla: názvy v číselníku jedinečné (bez ohledu na velikost písmen); používanou kategorii jde smazat jen s přesunem položek do náhradní; profesi ani středisko s pracovníky smazat nejde. Kalkulace sazby – výchozí odvody 33,8 %, dovolená 25 dní, nemoc 5 dní, 8 h/den, produktivita 85 %, režie % z mzdy nebo Kč/rok; fond = pracovní dny roku začátku projektu podle kalendáře projektu. Knihovna: párování podle názvů, odkazy se přemapují podle názvů, jiná měna se odmítne, náhled nové/změněné/beze změny, jeden krok Zpět. Formát projektu v2 s převodem v1. Vzorový projekt má vzorovou databázi |
| 1.10 | 15. 11. 2026 | Fáze 6b – zdroje a náklady na činnostech: panel **Detail činnosti** pod plánem (sbalitelný, výška tažením); pravidla výpočtu nákladů v R-02 (týden a měsíc podle kalendářních dnů, den podle pracovních); řádky smí mít činnosti i fáze, milník jen jednorázový náklad a materiál; sloupec Náklady s rozpadem a náklady projektu v záhlaví (R-05); řádek bez sazby má náklad 0 a varování. Návaznosti: zdroj použitý na činnostech nejde smazat (hláška s výpisem činností); smazání kategorie přesune i řádky; změna profese pracovníka se propíše do jeho řádků; změna na milník se zeptá a odebere nepovolené řádky; import z tabulky řádky nepřenáší a předem varuje; duplikace kopíruje řádky s novými ID. **Volné štítky** u řádků (R-03) přesunuty do fáze 7. Vzorový projekt má náklady na většině položek |
| 1.11 | 15. 11. 2026 | Vizuální identita (mezi kroky fáze 6c): aplikace přejmenována na **MiRo project**; nový požadavek **N-13** – logo, písmo Lato (WOFF2), barvy značky (grafit, papír, teplá šedá; žlutá = důležité, nově **tyrkysová** jako doplňkový akcent pro interakci a běžné úsečky činností; kritická cesta žlutě místo červeně); kontrast WCAG AA ověřen výpočtem (tlumená šedá ztmavena na 4,6 : 1). Otevřená otázka 6 uzavřena; přípony souborů beze změny kvůli kompatibilitě. Fáze 6c pokračuje jako v1.12 |
| 1.12 | 16. 11. 2026 | Fáze 6c – kritická cesta a vytížení: F-09, K-05 a Z-03 upřesněny podle implementace (pravidla rezerv a kritičnosti; vytížení = h/den × % v pracovních dnech, kapacita profese = součet pracovníků, nepřítomnost nemění termíny); nový třetí pohled **Vytížení** (základ A-04); varování v Detailu činnosti; datový model: vypočtené pozdní termíny a rezervy, `Worker.absences` s limitem 731 dnů na záznam (ochrana proti zamrznutí podvrženým souborem) |
| 1.13 | 16. 11. 2026 | Fáze 7 – rozpočet v čase: R-03 (štítky), R-04 (náběh na haléř, materiál v den začátku, pohled **Náklady** jako čtvrtý pohled s tabulkou, skládaným grafem v odstínech značky a filtry s více volbami), R-06 (limity projektu a kategorií, varování s datem překročení) a I-04 (export XLSX s listy Řádky a Náběh, CSV; import řádků s náhledem, nahrazení řádků činností ze souboru) upřesněny podle implementace; A-03 má základní graf; datový model: `TaskLine.tags`, `Project.budget`; otevřená otázka 4 uzavřena. Úpravy rozhraní: tlačítko „Přidat činnost“ v druhé řadě před „Předsadit“, jazyk a vzhled na řádku loga, ikona Náklady (euro + křivka) |
| 1.14 | 16. 11. 2026 | Doplněk po fázi 7 – celý projekt v Excelu: nový požadavek **I-07** (export sešitu se všemi daty projektu, vypočtené sloupce šedé a při importu ignorované, import celého sešitu s náhledem a nahrazením projektu); I-04 – list Řádky má navíc vypočtené h/den a Sazba Kč/h, aby bylo vidět, jak náklad vznikl; otevřená otázka 8 doplněna o sešit XLSX. Výpočet náběhu nákladů zrychlen (≈ 33 → 12 ms pro 300 činností) – rezerva pro testy výkonu i automatické nasazení |
| 1.15 | 17. 11. 2026 | Fáze 8 – analytika a dashboardy: A-01 (pohled **Analýza**; dimenze rozšířeny o druh nákladu, profesi a středisko, metrika Kč / hodiny, agregace, filtry „Vybrat vše / Odebrat vše“, štítky v Celkem jednou, export XLSX/CSV), A-02 (4 typy grafů, blokace klamavých typů, rozložení vedle sebe / pod sebou s rozdělovníkem), A-03 (ukazatele, S-křivka / Cash flow s jedinou osou, čára Dnes; cash flow jen výdaje), A-04 (filtry, ukazatele, souhrnný histogram po druzích zdrojů) a A-06 (5 přednastavených a vlastní pohledy v projektu) upřesněny podle implementace; datový model: `Project.views` |
| 1.16 | 17. 11. 2026 | Fáze 9 – baseline a sledování: G-08 (% hotovo jako výplň úsečky, % fáze spočítané, milník splněno, přepínač Baseline se stínovou úsečkou a posunem v bublině) a A-05 (pohled **Sledování**: až 10 baseline, datum stavu, Earned Value s vysvětlivkami, graf PV / AC / EV, tabulka a export) upřesněny podle implementace; I-07 doplněn o list Skutečnost a pravidlo, že činnost se stejným WBS, názvem a druhem si při importu (i I-03) ponechá ID a skutečné náklady; datový model: `Task.actuals`, `Baseline` (snímek po dnech s limity), `Project.activeBaselineId`, `Project.statusDate`; vzorový projekt „v běhu“ (kap. 11); otevřená otázka 5 uzavřena |
| 1.17 | 17. 11. 2026 | Plán fáze 10 – učení a přívětivost: U-01 (průvodce bez požadovaného konce, nabízený oknem Nový projekt a úvodní obrazovkou), U-02 (nové šablony 20–30 položek bez baseline), U-03 (jednotné ⓘ a okno Slovníček), U-04 (definice „vazby do minulosti“, „Jak to opravit“, varování se neskrývají) upřesněny |
| 1.18 | 17. 11. 2026 | Fáze 10 – učení a přívětivost: U-01 (průvodce v pěti krocích, nabídka měn, volitelná první činnost v každé fázi, úvodní obrazovka prázdného plánu), U-02 (pět šablon v okně Nový projekt, společný popis šablon a testy), U-03 (ⓘ na konkrétních místech, Slovníček s hledáním) a U-04 (tlačítko s počtem varování, výjimky pro chybějící vazby, akce u varování) upřesněny podle implementace. Datový model beze změny (`schemaVersion` 2) |
| 1.19 | 17. 11. 2026 | Plán fáze 11 – napojení na AI: AI-01 jako Markdown s volbou jmen a sazeb (výchozí bez), AI-02 vrací plán a hrubý rozpočet a vytvoří nový projekt, okno AI (ikona hvězdičky) v liště a karta v okně Nový projekt; AI-03 ověřit na skutečných odpovědích; AI-04 limit 500 kB |
| 1.20 | 17. 11. 2026 | Fáze 11 – napojení na AI: AI-01 až AI-04 upřesněny podle implementace (okno AI se dvěma kartami a ikonou čtyřcípé hvězdičky, obsah exportu, přednastavené otázky, náhled a vytvoření projektu, prompt na opravu, seznam hlášených chyb); formát „AI plán“ doplněn do kap. 7; prompty ověřeny na ChatGPT a Claude v češtině i angličtině. Datový model projektu beze změny (`schemaVersion` 2) |
| 1.21 | 17. 11. 2026 | Plán fáze 12 – myšlenková mapa: sedmý pohled „Mapa“ uložený v projektu (`Project.mindMap`, nepovinné), klasická mapa do dvou stran, vlastní SVG místo React Flow (kap. 6), převod na plán s volbou Přidat na konec / Nahradit (činnosti 5 dnů bez vazeb), odsazený text tam i zpět |
| 1.22 | 17. 11. 2026 | Fáze 12 – myšlenková mapa: MM-01 až MM-03 upřesněny podle implementace (ovládání klávesnicí, myší a tlačítky, tažení uzlů, rozpoznání středního tématu v osnově); `Project.mindMap` doplněno do kap. 7; osnova mapy v exportu pro AI. Mimo fázi: lépe viditelná výplň % hotovo v tmavém vzhledu (činnost, fáze, kritická činnost) |
| 1.23 | 17. 11. 2026 | Plán fáze 13 – doladění a export, rozdělená na 13a (export SVG / PNG / PDF přes tisk), 13b (import MS Project a GanttProject – jen plán; ochrana proti „nafouknutým“ XLSX), 13c (tablet, nová činnost tažením v grafu, ukládání sbalených fází `Project.collapsedIds` mimo historii Zpět, výkon), 13d (svátky SK, PL, DE, AT – `calendar.holidayCountry`; přístupnost); commit a nasazení po každé části |
| 1.24 | 17. 11. 2026 | Fáze 13a – export Gantta: I-05 upřesněn podle implementace (SVG, PNG, okno Tisk / PDF s Ctrl+P, A4 / A3, automatické měřítko, stránkování po řádcích; tisk do PDF ověřen uživatelem) |
| 1.25 | 17. 11. 2026 | Fáze 13b – import plánu a ochrana XLSX: I-06 upřesněn podle implementace (MS Project XML a GanttProject .gan, převod typů a prodlev vazeb, upozornění na vynechané vazby, začátek projektu, vlastní bezpečný čtenář XML místo DOMParseru – testy běží bez prohlížeče); N-10 doplněn o kontrolu archivu XLSX před ExcelJS (50 MB, 2 000 souborů, poměr 200 : 1, ověření skutečné velikosti). Mimo fázi (na žádost uživatele): **menu Soubor má dvě úrovně** – nahoře Nový, Otevřít, Uložit, Uložit jako, Tisk / PDF a podnabídky **Exportovat** a **Importovat** (otevřou se najetím myší, kliknutím nebo klávesou → / Enter, ← / Esc zavře), aby se menu vešlo na obrazovku notebooku. Oprava: v náhledu importu celého projektu se u chybějícího listu Činnosti / Řádky ukazoval technický klíč místo věty |
| 1.26 | 17. 11. 2026 | Fáze 13c – tablet, tvorba tažením, sbalení, výkon: G-09 upřesněn podle implementace (větší úchyty pro prst, dlouhý stisk = hromadný výběr; řádky se na dotyku přesouvají tlačítky – tažení řádků prstem nebylo realizováno); F-01 doplněn o novou činnost tažením v pruhu pod plánem; `Project.collapsedIds` doplněno do kap. 7 (sbalené fáze v souboru a záloze, mimo historii Zpět; sbalení neoznačí projekt jako neuložený); N-02 doplněn o naměřené hodnoty. Puštění úsečky s 270 navázanými následníky trvá ≈ 0,2 s – další zrychlení (kreslit jen viditelné řádky) zatím ne |
| 1.27 | 17. 11. 2026 | Během fáze 13d na žádost uživatele: **brand kit 2.0** a audit přehlednosti rozhraní. N-13 přepsán: nové logo „Monolinka“ a ikona aplikace (dark); písmo Lato nahrazeno trojicí **Inter Tight** (nadpisy) / **Inter** (text, čísla) / **JetBrains Mono** (strojový text; čísla původně také, na přání uživatele vrácena na tradičnější Inter) – Inter a JetBrains Mono staženy z oficiálních repozitářů (OFL) a přibaleny jako WOFF2; tmavá tyrkysová `#08708C` → `#0E7490`, světlá `#C4F3FF` → `#C9F4FF`; ukazatel přetahování z modré na barvu interakce značky. Rozvržení: záhlaví ve dvou řadách místo čtyř až pěti, nové menu **Nápověda** (Zkratky, Slovníček, Průvodce, Vzorový projekt, Kde jsou moje data) a panel **⚙ Zobrazení** (jazyk, vzhled), záložky pohledů a podkarty jako podtržené záložky, úpravy struktury plánu pod 1280 px jen ikonami, panel detailu bez výběru jako úzký pruh (plán ukáže zhruba dvojnásobek řádků), skrývatelná jednořádková informace o datech. Odstavec README o barvách opraven (dva akcenty). Na přání uživatele jsou čísla, data a částky písmem Inter (stejně široké číslice), JetBrains Mono jen pro strojový text |
| 1.28 | 17. 11. 2026 | Fáze 13d – svátky dalších zemí a přístupnost, **uzavření roadmapy**: K-04 upřesněn podle implementace (SK, PL, DE celostátní, AT; pravidla vázaná na roky ověřená proti zákonům, zdroje uvedeny); U-06 doplněn o výsledky kontroly (test kontrastu, audit popisků, rámeček fokusu, „Přeskočit na obsah“, oprava 11 slabě kontrastních textů a ikon, struktura stromu mapy). Roadmapa fází 0–13 dokončena |
| 1.29 | 17. 11. 2026 | Doplňky po fázi 13 na žádost uživatele: **popisky vedle úseček Gantta** (G-07 – Název, Termín, Délka, % hotovo, Náklady; i v exportu) a **mobilní verze jen pro prohlížení** (N-05 – displej pod 768 px, spodní lišta pěti pohledů, Plán jako seznam karet nebo úsporný Gantt, ostatní pohledy bez upravovacích prvků, přepínač Plná / Mobilní verze). Mimo to: export Gantta v měřítku Měsíce / Čtvrtletí nekreslí víkendy (jako obrazovka); Slovníček má zavírací ✕ v přilepeném záhlaví; tlačítka ⓘ jsou na dotykovém displeji 28 × 28 px |
| 1.30 | 20. 11. 2026 | Na žádost uživatele: **dokumentace** ve složce `dokumentace/` (uživatelský manuál, průvodce prvním projektem – case study „Zavedení CNC obráběcího centra“, správcovský metodický manuál; Word ve vizuálu brand kitu 2.0). **Změna licence** z MIT na „všechna práva vyhrazena“ (N-07, kap. 2, otevřená otázka 7; soubor `LICENSE`, `package.json` UNLICENSED); verze do commitu `7434bd3` zůstávají pod MIT. README: sešit celého projektu má 13 listů (přibyl list Skutečnost), ukazatel VAC, odkaz na dokumentaci a nová sekce Licence. Připravuje se omezený přístup studentů na dobu semestru (Cloudflare Pages s přihlašovací bránou; schválen vývojový nástroj `wrangler`) – zatím neimplementováno |
| 1.31 | 20. 11. 2026 | Nezávislý audit aplikace (`dokumentace/audit-2026-11.md`) a první opravy. **Zpět / Znovu přes Otevřít, Nový a Vzorový projekt** vrací i napojení na soubor, vzorový projekt se od otevřeného souboru odpojí – Ctrl+S už nepřepíše jiný soubor (audit V1, V2). **Limit souboru projektu 5 → 50 MB** (I-01): projekt se 4 000 činnostmi (5,1 MB) dřív šel uložit, ale ne otevřít; limit 5 MB zůstává pro importy. Záloha v prohlížeči bez odsazení (I-02, asi poloviční velikost); varování při uložení souboru nad limit (audit R1, R8) |
| 1.32 | 20. 11. 2026 | Opravy výpočtů podle auditu (krok 3): **vazby SS, SF a FF z milníku** počítají s okamžikem milníku (dřív o pracovní den vedle; F-07 doplněno o pravidlo milníku a prodlevu v pracovních dnech). **Čtení částky**: „,50“ = 0,50 (dřív 50 Kč), jediná čárka se třemi číslicemi („12,500“) a tři desetinná místa za tisíci s mezerou se odmítnou místo tiché změny řádu. **Velký pátek** je v ČR svátkem až od 2016 (K-02). **Materiál** se zaokrouhluje přesně na haléře (dřív 1,005 × 1 Kč = 1,00 Kč). **Fáze jen s milníky** má délku 0 dní. **% hotovo fáze** v Ganttu (s baseline) se počítá stejně jako ve Sledování (Earned Value, včetně vlastních nákladů vnořených fází). Beze změny: zaokrouhlení produktivních hodin na desetiny v kalkulaci sazby (Z-04, výpočet krok po kroku pak přesně vychází) |
| 1.33 | 20. 11. 2026 | Odolnost importu a exportu podle auditu (krok 4, N-10): kontrola ZIP odmítne archiv s předsazenými daty (dřív šla obejít, B1); **list XLSX nejvýš 60 000 řádků a 5 milionů buněk** se srozumitelnou hláškou (B2); vlastní čtenář XML čte atributy lineárně – dlouhá značka dřív zamrazila záložku na desítky sekund (B3); záchytná síť proti bílé stránce s tlačítkem Obnovit a výpočet osnovy bez limitu argumentů Safari (B5); ochrana CSV/XLSX proti vzorcům i po úvodních mezerách, u plnošířkových ＝＋－＠ a nového řádku na začátku (B6, N-11); export SVG/PNG vynechá řídicí znaky (B7). B4 (záloha při víc otevřených záložkách) zatím ne |
| 1.34 | 20. 11. 2026 | Paměť a rychlost přepočtu podle auditu (krok 5, N-02): výsledky výpočtů jen pro poslední 3 verze projektu (R2); odznaky v záhlaví (rozpočet, přetížení, kontrola plánu) se počítají z odložené verze projektu – změna se ukáže hned (R4); převod data ↔ číslo dne a zjištění roku čistou aritmetikou, pamatování pracovních dnů v kalendáři (R5, R9 – 1 000 posunů o 200 dní 37 → 3 ms); tažení vazby kontroluje kruh jen při změně cíle (R10); kontrola platného data bez objektu Date (R11). Přepočet 2 000 činností 146 → 64 ms. Chování aplikace beze změny |
| 1.35 | 20. 11. 2026 | Menší aplikace podle auditu (krok 6, R7, N-02): pohledy Zdroje, Vytížení, Náklady, Analýza, Sledování a Mapa, všech 12 dialogů, mobilní verze a vzorový projekt se stahují až při prvním použití (`React.lazy`, soubor `src/ui/lazyParts.tsx`); než pohled dorazí, ukáže se „Načítám…“. Při otevření se stáhne 854 kB místo 1 127 kB (266 místo 330 kB po kompresi). Načítání jen zvoleného jazyka zatím ne (oba jazyky potřebují importy) |
