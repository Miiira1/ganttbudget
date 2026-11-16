# Fáze 7 – Rozpočet v čase

## 1. Cíl fáze

Aplikace dosud znala, **kolik** stojí každá činnost. Teď ví i **kdy** se peníze utratí a hlídá limit rozpočtu.

- **Pohled Náklady** (čtvrtý přepínač vedle Plán | Zdroje | Vytížení) ukazuje tabulku nákladů po týdnech, měsících nebo čtvrtletích.
  - Řádky jsou podle kategorií, fází nebo druhu.
  - Zobrazení je za období, nebo kumulativně.
  - Nad tabulkou je graf: skládané sloupce v barvách členění, kumulativní čára a čára limitu.
- **Filtry s více volbami:** kategorie, fáze, druh a štítek.
- **Štítky řádků:** volné značky jako „dotace“ nebo „etapa 1“ v panelu Detail činnosti.
- **Limity rozpočtu** pro celý projekt a pro kategorie. Při překročení aplikace upozorní v záhlaví, v pohledu Náklady a v grafu a napíše i datum, kdy se limit překročí.
- **Export rozpočtu** do Excelu (list Řádky a Náběh po měsících) a do CSV.
- **Import rozpočtu** z Excelu nebo CSV s náhledem a seznamem chyb.

| Řádek | Kdy se náklad započítá |
|---|---|
| člověk, stroj | rovnoměrně do pracovních dnů činnosti |
| materiál | celý v den začátku činnosti |
| jednorázový | na začátku / na konci / k datu |
| průběžný | za den do pracovních dnů; za týden a měsíc do kalendářních dnů |

## 2. Co se naučíte z vibe codingu

**Haléř se nesmí ztratit.** 100 haléřů do tří dnů nejde rozdělit rovným dílem. Aplikace dá 34 + 33 + 33: zbytek dostane den s největším zbytkem po dělení. Test hlídá, že součet náběhu vzorového projektu se rovná nákladům projektu přesně na haléř. Bez toho by se součty v tabulce a v záhlaví lišily o „pár korun“ a nikdo by nevěděl proč.

**Jedno místo pro dělení času.** Vytížení i Náklady dělí čas na týdny a měsíce stejnou funkcí (`periods.ts`). Kdyby to dělal každý pohled po svém, týden by jednou začínal v pondělí a jindy v neděli.

**Export a import jsou dvojice.** Nejcennější test vezme vzorový projekt, vyexportuje rozpočet, znovu ho naimportuje a porovná. Musí vyjít úplně stejné řádky. Testy importu přitom našly skutečnou chybu: neznámé období „rok“ se tiše měnilo na „měsíc“. Tiché opravy jsou zrádné, proto je to teď chyba s číslem řádku.

**Barvy podle pravidel, ne podle nálady.** Úseky sloupců mají odstíny značky: tyrkysovou, žlutou, grafit, zlatou a šedé. Barva patří skupině podle jejího pořadí v projektu, takže se při filtrování nemění. Červená zůstává vyhrazená limitu a chybám.

**Každý vstup zvenku je podezřelý.** Import přijme jen známé hlavičky a hodnoty, hledá jen existující zdroje a hotový projekt ještě ověří schématem Zod. Export dá před text začínající `=` apostrof, aby ho Excel nespustil jako vzorec.

## 3. Příprava

- Hotová fáze 6c (vytížení zdrojů).
- Excel nebo LibreOffice na vyzkoušení exportu a importu.

## 4. Prompty krok za krokem

1. `Navrhni plán implementace fáze 7, zatím nic nepiš.` → otázky (kde zobrazit náběh, kdy započítat materiál, jaké limity, co umí import) → schválit plán.
2. Po každém kroku: ověřit → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | štítky řádků, limity v datech (testy předem) | štítek v panelu Detail činnosti, Ctrl+Z |
| 2 | výpočet náběhu `costTimeline.ts` (testy předem, výkon) | `npm test` |
| 3 | pohled Náklady: tabulka, členění, období, kumulativně | součet = náklady v záhlaví |
| 4 | graf, dialog Limity rozpočtu, varování | limit nižší než náklady → červeně |
| — | filtry s více volbami, skládané sloupce v barvách značky | odškrtnout Investice → součet bez nich |
| 5 | export rozpočtu do XLSX (2 listy) a CSV | otevřít v Excelu |
| 6 | import rozpočtu s náhledem a chybami | upravit částku v Excelu → import → Ctrl+Z |
| 7 | audit, průvodce, README, zadání v1.13 | viz níže |

Užitečné doplňující prompty:
- `Proč se materiál započítá celý na začátku činnosti? Co kdybych ho chtěl rozložit?`
- `Spočítej mi ručně náklady činnosti <název> v listopadu a porovnej s pohledem Náklady.`
- `Import hlásí „<chyba>“ na řádku <N>. Co je v souboru špatně?`

## 5. Jak ověřit výsledek

```powershell
npm test          # přes 450 testů
npm audit         # 0 vulnerabilities
npm run dev
```

1. **Vzorový projekt** → **Náklady**: řádek „Celkem za období“ i sloupec Celkem dávají 6 274 822,49 Kč, stejně jako záhlaví. Kumulativní řada končí stejnou částkou.
2. **Fáze** a **Čtvrtletí** → sloupce v grafu jsou rozdělené podle fází, legenda nad grafem.
3. **Filtr → Kategorie** → odškrtnout Investice → „zobrazeno 1 774 822,49 Kč z celkových 6 274 822,49 Kč“.
4. **Limity rozpočtu** → projekt 5 000 000 → červené záhlaví, hláška s datem překročení, v grafu čára limitu a červená tečka → Ctrl+Z.
5. Panel Detail činnosti → štítek „dotace“ na dva řádky → v pohledu Náklady filtr Štítek.
6. **Soubor → Exportovat rozpočet do Excelu** → změnit částku v listu Řádky → **Importovat rozpočet** → náhled → Nahradit řádky → v pohledu Náklady nová částka → Ctrl+Z.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Součet tabulky nesedí se záhlavím | `V pohledu Náklady je součet <X>, v záhlaví <Y>. Najdi, který řádek se rozkládá špatně, a napiš test.` |
| Import hlásí chybu, kterou nechápu | `Import rozpočtu hlásí na řádku <N>: „<text>“. V souboru je <obsah řádku>. Co je špatně?` |
| Excel zobrazuje WBS „1.10“ jako „1.1“ | `Excel mi v CSV převedl WBS na čísla. Jak soubor otevřít, aby zůstaly jako text?` (tip: používejte XLSX) |

## 7. Uložení do Gitu

`Fáze 7 je ověřená. Udělej commit s popisem v češtině a pošli ho na GitHub.`

## 8. Kontrolní otázky / mini-úkol

1. Proč se průběžný náklad „za měsíc“ počítá po kalendářních dnech a ne po pracovních?
2. Proč filtr v pohledu Náklady nemění varování o limitu v záhlaví?
3. Co se stane s limitem kategorie, když kategorii smažete?
4. **Mini-úkol:** nastavte limit projektu 6 000 000 Kč. Kdy ho kumulativní náklady přesáhnou? Najděte v plánu činnost, jejímž posunem o měsíc později se datum překročení posune, a vysvětlete proč.
