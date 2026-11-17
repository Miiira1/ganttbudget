# Fáze 9 – Baseline a sledování

## 1. Cíl fáze

Aplikace dosud uměla jen plánovat. Teď ví i to, jak projekt opravdu běží:

- **Baseline:** uložený snímek schváleného plánu (termíny a plánované náklady po dnech). Projekt jich může mít až 10 a jedna je vybraná ke srovnání.
- **% hotovo:**
  - u činností se zadává ručně,
  - u fáze se počítá z jejích činností,
  - u milníku je zaškrtávátko „splněno“.
- **Skutečné náklady** jsou položky k datu (datum, částka, poznámka) v panelu Detail činnosti.
- **V Ganttově diagramu:**
  - % hotovo je tmavší výplň úsečky,
  - tlačítko **Baseline** ukáže šedou stínovou úsečku s původním termínem,
  - bublina úsečky napíše, o kolik se konec posunul.
- **Pohled Sledování** (šestý přepínač):
  - správa baseline a datum stavu,
  - dlaždice Earned Value s vysvětlivkami ⓘ,
  - graf PV / AC / EV,
  - tabulka činností s exportem do Excelu a CSV.
- **Sešit celého projektu** má list Skutečnost. Činnosti se stejným WBS a názvem si při importu ponechají vazbu na baseline i skutečné náklady.
- **Vzorový projekt** je „v běhu“: začal před 8 týdny, má baseline, je asi o týden pozadu a o 6 % dražší.

| Pojem | Co znamená |
|---|---|
| baseline | schválený plán uložený ke srovnání; dál se nemění |
| datum stavu | den, ke kterému se počítá, co mělo být hotovo a co se utratilo (prázdné = dnes) |
| BAC | kolik měl projekt celkem stát podle baseline |
| PV | kolik práce (v Kč) mělo být hotovo k datu stavu |
| EV | kolik práce je opravdu hotovo, oceněno plánovanou cenou |
| AC | kolik se opravdu utratilo do data stavu |
| SPI = EV / PV | pod 1 = zpoždění |
| CPI = EV / AC | pod 1 = dráž, než se plánovalo |
| EAC = BAC / CPI | odhad celkových nákladů na konci |

## 2. Co se naučíte z vibe codingu

**Snímek, ne odkaz.** Baseline neukládá „odkaz na plán“, ale kopii čísel: termíny a náklad každé položky po dnech. Proto dál platí, i když se plán změní nebo činnost zmizí. Smazaná činnost zůstane ve Sledování šedě jako „není v plánu“ a nová činnost dostane štítek „nová“.

**Identita přežije import.** Při kontrole kroku 7 se ukázalo, že import z Excelu dával činnostem nová vnitřní označení. Baseline by je pak nepoznala a skutečné náklady by se tiše ztratily. Teď platí pravidlo: stejné WBS a stejný název znamenají stejnou činnost. Takové chyby najdete jen tak, že si položíte otázku „co se stane s daty, která už existují?“.

**Dělit nulou je běžné, ne výjimečné.** Na začátku projektu je PV i AC nula, takže SPI a CPI nejde spočítat. Aplikace nespadne ani neukáže „NaN“. Ukáže „–“ a vysvětlí proč („zatím nic neutraceno“).

**Ukázková data musí něco ukazovat.** Vzorový projekt začínající dneškem by měl všude nuly. Proto začíná před 8 týdny a % hotovo a skutečnost se dopočítají z plánu. Testy hlídají, že vyjde „mírně pozadu a mírně dražší“ (SPI a CPI pod 1). První verze vyšla omylem levnější: činnost s platbou na konci měla hotovou práci, ale ještě žádný výdaj. Test to odhalil dřív než uživatel.

**Jedna osa, různé tvary.** V grafu je plán čárkovaný, skutečnost plná zlatá a hotová práce je bod. Rozliší je i člověk, který nevidí barvy. Červená zůstává vyhrazená problémům.

## 3. Příprava

- Hotová fáze 8 (analytika a dashboardy).
- Vzorový projekt načtený znovu (tlačítko **Vzorový projekt**), protože nově obsahuje baseline a skutečnost.

## 4. Prompty krok za krokem

1. `Navrhni plán implementace fáze 9, zatím nic nepiš.` → otázky (jak zadávat skutečné náklady, kolik baseline, datum stavu, kde dashboard) → schválit plán.
2. Po každém kroku: ověřit → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | data: baseline, skutečné náklady, datum stavu (testy předem) | `npm test` |
| 2 | jádro: snímek baseline a Earned Value (testy předem, výkon) | ručně spočítaný příklad v testu |
| 3 | % hotovo v úsečkách, stínová baseline, % fází | zadat 50 % → výplň úsečky |
| 4 | Skutečné náklady v panelu Detail činnosti | přidat, upravit, smazat, Ctrl+Z |
| 5 | pohled Sledování: baseline, datum stavu, dlaždice s ⓘ | Uložit baseline → BAC = náklady |
| 6 | graf PV / AC / EV, tabulka činností, export | najetí myší, Excel |
| 7 | list Skutečnost v sešitu, ponechání ID při importu | Excel tam a zpět |
| 8 | vzorový projekt v běhu, audit, průvodce, README, zadání v1.16 | viz níže |

Užitečné doplňující prompty:
- `Proč je SPI 0,94? Ukaž mi, které činnosti zpoždění způsobují.`
- `Spočítej ručně EV činnosti <název> a porovnej s tabulkou ve Sledování.`
- `Kdy mám uložit novou baseline a kdy ponechat starou?`

## 5. Jak ověřit výsledek

```powershell
npm test          # přes 520 testů
npm audit         # 0 vulnerabilities
npm run dev
```

1. **Vzorový projekt** → **Sledování**: baseline „Schválený plán“, SPI i CPI kolem 0,94 (červeně, „zpoždění“ a „dráž“), EAC vyšší než BAC.
2. Klik na **ⓘ** u CPI → vysvětlení pojmu a vzorec. Rozbalit **Jak číst Earned Value**.
3. **Datum stavu** posunout o měsíc dopředu → PV vzroste, AC zůstane (skutečnost v budoucnu ještě není), SPI klesne.
4. **Plán** → zapnout **Baseline** → prodloužit rozpracovanou činnost o 5 dní → šedá úsečka zůstane, bublina napíše „konec o … později“ → Ctrl+Z.
5. Vybrat činnost → panel Detail činnosti → **Skutečné náklady** → přidat 10 000 Kč → ve Sledování vzroste AC a klesne CPI → Ctrl+Z.
6. **Sledování** → **Uložit baseline…** (druhá) → přepnout srovnání → smazat → Ctrl+Z.
7. **Soubor → Exportovat celý projekt do Excelu** → v listu Skutečnost změnit částku → **Importovat celý projekt** → baseline zůstala, částka se změnila.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Ve Sledování je činnost „není v plánu“ a zároveň „nová“ | `Činnost <název> je ve Sledování dvakrát – jednou jako smazaná, jednou jako nová. Co se změnilo na WBS nebo názvu a jak ji spárovat s baseline?` |
| BAC nesedí s náklady projektu | `BAC je <X>, náklady v záhlaví <Y>. Změnil se plán po uložení baseline? Ukaž rozdíly po činnostech.` |
| Import sešitu hlásí chybu na listu Skutečnost | `Import hlásí na listu Skutečnost, řádek <N>: „<text>“. V řádku je <obsah>. Co je špatně?` |

## 7. Uložení do Gitu

`Fáze 9 je ověřená. Udělej commit s popisem v češtině a pošli ho na GitHub.`

## 8. Kontrolní otázky / mini-úkol

1. Proč se EV počítá z plánované ceny práce, a ne ze skutečně utracených peněz?
2. Projekt má SPI 1,1 a CPI 0,8. Co to znamená a co byste řekli zadavateli?
3. Proč aplikace nepočítá skutečné náklady s datem po datu stavu?
4. **Mini-úkol:** ve vzorovém projektu najděte činnost s největší zápornou odchylkou CV. Zjistěte, kolik by se muselo utratit, aby CPI celého projektu bylo 1, a ověřte to změnou skutečného nákladu (pak Ctrl+Z).
