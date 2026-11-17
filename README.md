# MiRo project

Jednoduchá webová aplikace pro plánování projektů (Ganttův diagram) s navázaným rozpočtem.
Je určená studentům a praktikům bez zkušenosti s projektovým řízením. Běží jen v prohlížeči –
**data zůstávají ve vašem počítači, nic se neposílá na server.**

**▶ Vyzkoušet aplikaci: https://miiira1.github.io/ganttbudget/** (nic se neinstaluje, stačí prohlížeč)

> Stav: **fáze 13a – export Gantta.** Termíny se počítají z délek, vazeb FS, SS, FF, SF
> (s prodlevou), omezení „začít nejdříve“ a kalendáře (víkendy, české svátky, odstávky) a zobrazují
> se v tabulce i v Ganttově diagramu. Vazby se zapisují textem (`3SS+2`) nebo kreslí tažením v grafu.
> Činnosti se seskupují do fází (WBS, sbalení, sumarizace), úsečky se v grafu táhnou s přichycením
> na pracovní dny, řádky se přesouvají tlačítky, klávesami i tažením; přehled zkratek otevře F1.
> Ctrl+klik / Shift+klik vybere více řádků a všechny tyto akce pak pracují s celým výběrem.
> Vše jde vrátit Ctrl+Z. Fáze 5 (**MVP 1.0**) přidala ukládání a otevírání projektu (`.ganttbudget.json`),
> automatickou zálohu v prohlížeči, export do Excelu / CSV a import z nich. Fáze 6a přidala obrazovku
> **Zdroje**: profese a pracovníky s kalkulací hodinové sazby, střediska, stroje, materiály a kategorie
> nákladů, přenositelné mezi projekty jako knihovna (`.ganttbudget-lib.json`). Fáze 6b napojila zdroje na plán:
> v panelu **Detail činnosti** pod plánem má každá činnost řádky (člověk, stroj, materiál, jednorázový
> a průběžný náklad), tabulka ukazuje sloupec Náklady a záhlaví náklady projektu. Fáze 6c přidala **kritickou cestu**
> (tlačítko a sloupec Rezerva), nepřítomnosti pracovníků a pohled **Vytížení** (pracovníci, profese, stroje po dnech,
> týdnech, měsících; histogram; přetížení červeně a jako varování v Detailu činnosti). Fáze 7 přidala pohled **Náklady**
> (náběh nákladů po týdnech, měsících a čtvrtletích, kumulativně, skládaný graf, filtry kategorií, fází, druhů a štítků),
> volné **štítky** u řádků, **limity rozpočtu** (projekt a kategorie, varování s datem překročení) a export / import
> rozpočtu do Excelu a CSV. Doplněk po fázi 7: **celý projekt v jednom sešitu Excelu** (12 listů – projekt, kalendář,
> činnosti, řádky, databáze zdrojů, náběh) jde exportovat, upravit a zase načíst; šedé sloupce „(vypočteno)“ import
> ignoruje. Fáze 8 přidala pohled **Analýza** (kontingenční tabulka nákladů a hodin podle fází, kategorií, štítků,
> zdrojů, středisek a období; čtyři typy grafů; přednastavené a vlastní pohledy uložené v projektu; export do Excelu
> a CSV) a dashboardy: v pohledu Náklady ukazatele a graf **S-křivka / Cash flow** s čarou „Dnes“, v pohledu
> Vytížení filtry, ukazatele a souhrnný histogram skupiny. Fáze 9 přidala **baseline** (uložený schválený plán,
> stínová úsečka v grafu), **% hotovo** (výplň úsečky, u fází spočítané), **skutečné náklady** k datu u činností
> a pohled **Sledování** s Earned Value (BAC, PV, EV, AC, SPI, CPI, EAC s vysvětlením pojmů), grafem a tabulkou;
> vzorový projekt je „v běhu“. Fáze 10 přidala **průvodce prvním projektem** (název a měna, začátek, kalendář,
> první fáze), okno **Nový projekt** s pěti **šablonami** ze strojírenství a výroby, tlačítka **ⓘ** s vysvětlením
> pojmů a **Slovníček**, a **Kontrolu plánu** (chybějící vazby, prázdné fáze, zpoždění, přetížení, překročený
> rozpočet – s radou „Jak to opravit“). Fáze 11 přidala tlačítko **AI**: projekt jde zkopírovat jako text pro
> ChatGPT / Claude (s otázkou, ve výchozím stavu bez jmen a sazeb) a z popisu projektu jde nechat AI navrhnout
> **plán s hrubým rozpočtem** – aplikace připraví prompt, odpověď zkontroluje a vytvoří z ní nový projekt. Nic se
> neposílá samo a nepotřebuje to žádný klíč. Fáze 12 přidala pohled **Mapa**: myšlenkovou mapu ovládanou
> klávesnicí i myší (tažení uzlů), uloženou v projektu, z níž jde jedním tlačítkem **vytvořit plán** (větve = fáze,
> koncové uzly = činnosti); mapu jde vložit i zkopírovat jako **odsazený text**. Fáze 13a přidala export Ganttova
> diagramu jako obrázek **SVG / PNG** a **Tisk / PDF** (Ctrl+P) se stránkováním na A4 / A3 (viz [ZADANI.md](ZADANI.md), kap. 8).

## Soubory: co kdy použít

| Potřebuji… | Použijte (menu Soubor) |
|---|---|
| zálohovat projekt nebo ho přenést na jiný počítač | **Uložit** / **Otevřít** – soubor projektu `.ganttbudget.json` |
| upravit celý projekt v Excelu a vrátit ho | **Exportovat / Importovat celý projekt do / z Excelu** – jeden sešit, šedé sloupce jsou jen vypočtené |
| rychle upravit jen činnosti, nebo jen řádky rozpočtu | dílčí export a import činností / rozpočtu (XLSX, CSV) |
| přenést databázi zdrojů do jiného projektu | **Exportovat / Načíst knihovnu zdrojů** – `.ganttbudget-lib.json` |

Sešit celého projektu i soubor projektu obsahují všechna data včetně mezd z kalkulace sazeb – nesdílejte je s někým,
kdo je vidět nemá.

## Vzhled a značka

Aplikace používá vizuální styl značky **MiRo project**:
- **Barvy:** grafit `#262626`, papír `#F6F5F0` a žlutá `#FFC000` jako jediný barevný akcent
  (primární tlačítka, výběr, kritická cesta). Žlutý text na světlém pozadí se nepoužívá, místo něj
  tmavé zlato `#B38600`. Barvy jsou v `src/index.css` (`@theme`). Kontrast textu splňuje WCAG AA (≥ 4,5 : 1).
- **Písmo:** Lato (licence SIL OFL) jako WOFF2 v `src/assets/fonts/`. Načítá se z vlastní adresy,
  ne z Google Fonts, takže aplikace nic neposílá ven.
- **Logo:** `src/assets/brand/` (světlá a tmavá varianta), ikony prohlížeče v `public/`.

Přípony souborů (`.ganttbudget.json`, `.ganttbudget-lib.json`) a klíče v prohlížeči zůstávají
z pracovního názvu GanttBudget beze změny, aby šly dál otevřít dříve uložené projekty a zálohy.

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

## Nasazení na GitHub Pages

Web se nasazuje automaticky: po každém `git push` do větve `main` GitHub spustí testy a build
a hotovou složku `dist/` zveřejní na GitHub Pages (`.github/workflows/deploy.yml`). Když testy
nebo build selžou, nic se nezveřejní. Průběh je vidět v repozitáři v záložce **Actions**.

Jednorázové nastavení:

1. Na [github.com/new](https://github.com/new) založte **veřejný** repozitář (bez README,
   .gitignore a licence – ty už projekt má).
2. Propojte s ním místní repozitář a pošlete do něj kód:
   ```powershell
   git remote add origin https://github.com/<uživatel>/<repozitář>.git
   git push -u origin main
   ```
3. V repozitáři na GitHubu: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Po prvním úspěšném běhu v záložce **Actions** běží aplikace na adrese
   `https://<uživatel>.github.io/<repozitář>/`.

**Dependabot** (`.github/dependabot.yml`) jednou týdně navrhne aktualizace knihoven jako pull
requesty. Nic se nesloučí samo: u každého počkejte, až projdou testy, a sloučte ho ručně.

## Struktura kódu

| Složka | Obsah |
|---|---|
| `src/engine/` | plánovací jádro: kalendář (svátky, pracovní dny), výpočet termínů, rezervy a kritická cesta – čisté funkce s testy |
| `src/gantt/` | výpočty pro graf: časová osa, poloha úseček, trasy šipek, tažení, kreslení vazeb, export do SVG (`exportSvg.ts`) a stránkování tisku (`print.ts`) – čisté funkce s testy |
| `src/io/` | soubor projektu, automatická záloha (IndexedDB), export a import CSV/XLSX (činnosti, rozpočet, celý projekt – `workbookExport.ts`, `workbookImport.ts`; export analýzy – `analysisExport.ts`, sledování – `trackingExport.ts`), knihovna zdrojů – kontrola dat s testy |
| `src/model/` | formát projektu (schéma Zod), strom fází a přesuny (`hierarchy.ts`), práce s daty a zápis předchůdců, peníze v haléřích (`money.ts`), kalkulace sazby (`rates.ts`), náklady činností (`costs.ts`), vytížení zdrojů (`load.ts`), časový náběh nákladů, limity a ukazatele (`costTimeline.ts`), období (`periods.ts`), štítky (`tags.ts`), data pro analýzu (`facts.ts`), kontingenční tabulka (`pivot.ts`) a její grafy (`pivotChart.ts`), snímek baseline (`baseline.ts`) a Earned Value (`earnedValue.ts`), kontrola kvality plánu (`planCheck.ts`), průvodce prvním projektem (`wizard.ts`), formát odpovědi AI a jeho převod na projekt (`aiPlan.ts`) a prompty a export pro AI (`aiPrompts.ts`), myšlenková mapa – úpravy (`mindMap.ts`), rozložení (`mindMapLayout.ts`), převod na plán (`mindMapToPlan.ts`) a odsazený text (`outline.ts`) |
| `src/store/` | stav aplikace s historií změn (Zpět / Znovu) |
| `src/ui/` | obrazovky a komponenty (React); `src/ui/gantt/` kreslí Ganttův graf (SVG), `src/ui/resources/` obrazovku Zdroje, `src/ui/detail/` panel Detail činnosti, `src/ui/load/` pohled Vytížení, `src/ui/costs/` pohled Náklady, `src/ui/analysis/` pohled Analýza, `src/ui/tracking/` pohled Sledování, `src/ui/help/` nápověda ⓘ a Slovníček, `src/ui/check/` okno Kontrola plánu, `src/ui/ai/` okno AI, `src/ui/mindmap/` pohled Mapa |
| `src/i18n/` | překlady (`locales/cs.json`, `locales/en.json`) a formát data a čísel |
| `src/samples/` | šablony projektů (`templates.ts` – seznam, `template.ts` – společný stavitel) a jejich data: vzorový projekt „Zavedení automatizace do výroby“ (`automatizace.ts`), vývoj výrobku, výrobní linka, investiční akce, odstávka |
| `pruvodce/` | výuková case study – jedna kapitola na fázi vývoje |

## Přidání jazyka

1. Zkopírujte `src/i18n/locales/en.json` pod novým názvem (např. `de.json`) a přeložte texty.
2. Přidejte jeden řádek do pole `LANGUAGES` v `src/i18n/languages.ts`.
3. Spusťte `npm test` – test ověří, že v překladu žádný text nechybí.

## Licence

MIT
