# Fáze 13 – Doladění a export

Poslední fáze roadmapy je rozdělená na čtyři části; každá končí commitem a nasazením:
**13a** export Gantta · **13b** import z MS Project a GanttProject · **13c** tablet, tvorba tažením, sbalení, výkon · **13d** svátky dalších zemí, přístupnost.

---

## 13a – Export Gantta (SVG, PNG, PDF)

### 1. Cíl

Student potřebuje plán **odevzdat** – vložit do Wordu, poslat jako obrázek nebo PDF:

- **Soubor → Exportovat Gantt jako SVG / PNG**: obrázek plánu tak, jak je vidět (měřítko osy, sbalené fáze, kritická cesta) s nadpisem, tabulkou, časovou osou, úsečkami, % hotovo a šipkami vazeb.
- **Soubor → Tisk / PDF…** (nebo **Ctrl+P**): papír A4 / A3 na šířku, automatické nebo ruční měřítko osy, kritická cesta; plán se rozdělí na stránky (na každé nadpis a osa) a otevře se tisk prohlížeče, kde jde zvolit **Uložit jako PDF**.

### 2. Co se naučíte z vibe codingu

**Jeden obrázek, tři výstupy.** Obrázek kreslí jedna čistá funkce (`renderGanttSvg`). SVG je její přímý výstup, PNG vznikne vykreslením SVG do plátna, PDF je tisk stránek složených ze stejného SVG. Jedna funkce s testy = tři funkce, které se nerozejdou.

**Knihovna, kterou nepotřebujete.** PDF umí každý prohlížeč („Uložit jako PDF“). Místo velké knihovny stačí tisková stránka a pár pravidel CSS (`@page`, `@media print`).

**Bezpečnost i u obrázků.** Název činnosti se do SVG vkládá jako text, ne jako kód – všechny znaky `< > & "` se převedou na bezpečné. Test zkouší název `<script>…`.

**Co testovací prohlížeč nezvládne, ověří člověk.** Okno tisku ani skutečný PDF náhled se v automatickém testu otevřít nedají. Aplikace se proto otestovala „zevnitř“ (připravené stránky, třída `printing`, úklid po tisku) a výsledný PDF zkontroloval uživatel.

**Vidět výsledek.** Hotové PNG si Claude prohlédl a našel chybu, kterou testy nezachytily: nadpis sloupce „Délka (dny)“ se nevešel. Testy hlídají logiku, oči vzhled.

### 3. Prompty

1. `Navrhni plán implementace fáze 13, zatím nic nepiš.` → otázky (rozdělení fáze, způsob PDF, rozsah importu, sady svátků) → schválit.
2. Po každém kroku ověřit → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | funkce `renderGanttSvg` (nejdřív testy) | `npm test` |
| 2 | Exportovat Gantt jako SVG / PNG | otevřít oba soubory, vložit SVG do Wordu |
| 3 | Tisk / PDF, Ctrl+P, stránkování (nejdřív testy) | uložit PDF na A4 i A3 |

### 4. Jak ověřit výsledek

1. **Vzorový projekt** → měřítko **Měsíce**, zapnout **Kritickou cestu** → **Soubor → Exportovat Gantt jako PNG** → otevřít obrázek.
2. **Ctrl+P** → A4, Automaticky → **Tisknout…** → **Uložit jako PDF** → v PDF je jen Gantt na šířku.
3. Totéž s **A3** a měřítkem **Týdny** → víc stránek, na každé nadpis a osa.

### 5. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| PDF je prázdné nebo na výšku | `Při tisku do PDF vyšla <popis>. Prohlížeč <název>, papír <A4/A3>. Posílám screenshot náhledu tisku.` |
| V obrázku je něco useknuté nebo přes sebe | `V exportovaném PNG se <co> překrývá / je useknuté. Posílám výřez obrázku.` |

### 6. Kontrolní otázky

1. Proč je pro odevzdání do Wordu lepší SVG než PNG?
2. Proč se plán tiskne bez řádků ve sbalených fázích a kdy je to výhoda?
3. **Mini-úkol:** vytiskněte do PDF svůj projekt na A4 tak, aby se vešel na jednu stránku a byl čitelný (měřítko osy, sbalení fází).

---

## 13b – Import z MS Project a GanttProject, ochrana XLSX

### 1. Cíl

Kdo už má plán v jiném programu, nemusí ho přepisovat:

- **Soubor → Importovat → Plán z MS Project (XML)…**: v MS Project nejdřív **Soubor → Uložit jako → XML**. Převezmou se fáze (souhrnné úkoly), činnosti, milníky, vazby s prodlevou, % hotovo, poznámky, omezení začátku a začátek projektu.
- **Soubor → Importovat → Plán z GanttProject (.gan)…**: totéž ze souboru GanttProject.
- Zdroje a náklady se nepřenášejí – ty se doplní v aplikaci.
- Před potvrzením je vidět **náhled** s upozorněním, co se vynechalo (např. vazba na fázi), a nové datum začátku projektu. Import nahradí činnosti a jde vrátit **Ctrl+Z**.
- Všechny importy z Excelu (XLSX) navíc odmítnou **„nafouknutý“ soubor** – malý soubor, který by se po rozbalení zvětšil na stovky megabajtů a zahltil prohlížeč.

Mimo plán (na přání uživatele): **menu Soubor má dvě úrovně** – podnabídky **Exportovat** a **Importovat** – aby se vešlo na obrazovku notebooku.

### 2. Co se naučíte z vibe codingu

**Formát cizího programu je smlouva, kterou jste nepodepsali.** MS Project ukládá délku jako `PT40H0M0S` (40 hodin), prodlevu v desetinách minuty a strom podle čísla úrovně. GanttProject ukládá vazbu u předchůdce a typy čísly 1–4. Claude si formáty nastudoval a převod zapsal jako čistou funkci s testy na ukázkových souborech.

**Co nejde převést, se nezamlčí.** U nás fáze nesmějí mít vazby, v MS Project mohou. Taková vazba se vynechá – ale náhled to napíše i s počtem. Tichá ztráta dat je horší než hláška.

**Odchylka od plánu se hlásí.** Plán počítal s vestavěnou čtečkou XML prohlížeče (DOMParser). Ta ale v automatických testech (bez prohlížeče) neexistuje, a tak Claude napsal malou vlastní čtečku – odmítá DOCTYPE (tím i „externí entity“, známý útok přes XML) a má limity hloubky a počtu prvků. Uživateli to řekl a nabídl alternativu.

**ZIP bomba.** Soubor XLSX je ZIP archiv. Kontrola nevěří jen tomu, co archiv „tvrdí“ v seznamu souborů: každý soubor zkusmo rozbalí po kouscích a jen počítá bajty. Když se rozbalí víc, než hlavička slibuje, hned skončí.

**Testy najdou i cizí chyby.** Při zkoušce podvrženého souboru se ukázala starší chyba: v importu celého projektu se místo věty zobrazil technický klíč `import.error.missingSheet`. Opravilo se to hned.

### 3. Prompty

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 5 | převod MS Project XML (nejdřív testy) | `npm test` |
| 6 | převod GanttProject .gan (nejdřív testy) | `npm test` |
| 7 | položky v menu Importovat, náhled s upozorněními | import ukázkového souboru, Ctrl+Z |
| 8 | kontrola archivu XLSX (nejdřív testy) | běžný XLSX projde, podvržený ne |
| 9 | uzavření: zadání, průvodce, README, `npm audit` | — |

### 4. Jak ověřit výsledek

1. V MS Project otevřete plán → **Soubor → Uložit jako → XML** (nebo v GanttProject uložte `.gan`).
2. V aplikaci **Soubor → Importovat → Plán z MS Project (XML)…** → vyberte soubor.
3. V náhledu zkontrolujte strom, typy (fáze / činnost / milník), délky a předchůdce; přečtěte si upozornění.
4. **Nahradit činnosti** → v Ganttu sedí termíny i vazby → **Ctrl+Z** vrátí původní plán.
5. **Soubor → Importovat → Činnosti z Excelu / CSV…** s běžným souborem z exportu aplikace → načte se jako dřív.

### 5. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Import hlásí chybu, ale soubor je podle vás v pořádku | `Import z <MS Project/GanttProject> hlásí „<text chyby>“. Verze programu <…>. Přikládám soubor (bez citlivých údajů).` |
| Termíny po importu nesedí s původním programem | `Po importu z <program> má činnost <název> začátek <datum>, v původním programu <datum>. Kalendář projektu: <…>.` |

### 6. Kontrolní otázky

1. Proč se vazba z fáze na činnost při importu vynechá, a ne převede?
2. Proč nestačí věřit velikosti, kterou o sobě uvádí archiv ZIP?
3. **Mini-úkol:** vytvořte v GanttProject tři úkoly s vazbami (jeden s prodlevou), uložte `.gan`, naimportujte ho a porovnejte termíny.

---

## 13c – Tablet, nová činnost tažením, sbalené fáze, výkon

### 1. Cíl

- **Tablet**: na dotykovém displeji jsou úchyty úseček větší, kolečka pro kreslení vazeb jsou u vybraných řádků stále vidět a **podržení prstu ½ s** přidá řádek nebo úsečku do výběru (tablet nemá Ctrl).
- **Nová činnost tažením**: pod posledním řádkem grafu je pruh „Táhněte sem vodorovně“. Tah vytvoří činnost s tímto začátkem (📌) a délkou.
- **Sbalené fáze se pamatují**: uloží se do souboru projektu i do automatické zálohy. Sbalování není v historii Zpět.
- **Rychlost**: plán s 300 činnostmi se táhne plynule.

### 2. Co se naučíte z vibe codingu

**Nejdřív měřit, pak opravovat.** Pocit „je to pomalé“ nestačí. Claude vytvořil plán s 300 navázanými činnostmi (přes import z GanttProject) a měřil. Výpočty termínů trvaly jen 7 ms – brzdilo překreslování stránky. Bez měření by se optimalizovalo něco, co nevadí.

**Měřicí přístroj musí být v pořádku.** Když byl panel prohlížeče skrytý, prohlížeč stránku šetřil a stejný krok trval jednou 2 ms, podruhé 190 ms. Claude to poznal, zastavil se a požádal o otevřený panel. Teprve pak čísla dávala smysl.

**Malé triky, velký účinek.** Řádek CSS `contain: strict` řekl prohlížeči, že změna v grafu neovlivní zbytek stránky – krok náhledu klesl z 35 na 16 ms. Pole s kalendářem v tabulce (540 kusů) nahradil text, pole se objeví až po kliknutí. Opakované překlady textů si aplikace pamatuje.

**Co nejde do historie Zpět.** Sbalení fáze je jen pohled, ne změna plánu. Proto se ukládá vedle projektu („přibalí se“ při uložení, „vybalí“ po otevření), a Ctrl+Z ho nevrací.

**Testovat dotyk bez tabletu.** Náhled umí předstírat dotykové zařízení. Claude posílal „prstové“ události a ověřil klepnutí, dlouhý stisk i tažení skupiny. Skutečný tablet to ale úplně nenahradí.

### 3. Prompty

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 10 | větší úchyty a dlouhý stisk na dotyku (nejdřív testy) | tablet / dotykový notebook: podržet prst na dvou úsečkách |
| 11 | nová činnost tažením pod plánem (nejdřív testy) | táhnout v pruhu pod plánem, Esc, Ctrl+Z |
| 12 | sbalené fáze v souboru a záloze (nejdřív testy) | sbalit, zavřít a otevřít aplikaci |
| 13 | měření a zrychlení na 300 činnostech | tažení úsečky ve velkém plánu |
| 14 | uzavření: zadání, průvodce, README, `npm audit` | — |

### 4. Jak ověřit výsledek

1. Otevřete **Vzorový projekt**, sjeďte pod poslední řádek grafu a **táhněte vodorovně** přes pár dní → vznikne „Nová činnost“ s 📌, kurzor je v názvu. **Ctrl+Z** ji odebere.
2. Sbalte dvě fáze (▾), zavřete záložku a otevřete aplikaci znovu → fáze zůstanou sbalené. Ctrl+Z sbalení nevrací.
3. **Uložit**, otevřít jiný projekt, znovu otevřít svůj soubor → sbalení je zpět.
4. Na tabletu / dotykovém displeji: podržte prst na dvou úsečkách → „Vybrány 2 řádky“; potáhněte jednu z nich → posunou se obě.
5. V tabulce klikněte na datum začátku → otevře se kalendář; vyberte den a potvrďte Enterem.

### 5. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Na tabletu nejde chytit úsečku nebo se místo tažení posouvá stránka | `Na tabletu <zařízení, prohlížeč> při tažení úsečky prstem <co se stane>. Posílám krátké video / screenshot.` |
| Velký plán se táhne trhaně | `Plán s <počet> činnostmi: tažení úsečky trvá <odhad>. Prohlížeč <název>. Můžeš to změřit?` |
| Po otevření souboru nejsou fáze sbalené | `Sbalil jsem fáze, uložil (Ctrl+S) a znovu otevřel soubor <název> – fáze jsou rozbalené.` |

### 6. Kontrolní otázky

1. Proč sbalení fáze nepatří do historie Zpět, i když se ukládá do souboru?
2. Proč je dobré nejdřív změřit, co je pomalé, a teprve potom optimalizovat?
3. **Mini-úkol:** naimportujte velký plán (např. z GanttProject) a zkuste, jestli je tažení úsečky plynulé. Všimněte si, jak dlouho trvá přepočet po puštění.
