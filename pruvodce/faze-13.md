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
