# Fáze 6b – Zdroje a náklady na činnostech

## 1. Cíl fáze

Každá činnost (i fáze a milník) má v panelu **Detail činnosti** pod plánem seznam **řádků**.
Každý řádek je jeden zdroj nebo jedna nákladová položka:

| Řádek | Co se zadává | Jak se počítá |
|---|---|---|
| **Člověk** | profese, volitelně konkrétní pracovník, % zapojení | dny × hodin/den × % × sazba |
| **Stroj** | stroj, % využití | hodiny × sazba (nebo dny × % × denní sazba) |
| **Materiál** | materiál z databáze, množství, volitelně vlastní cena | množství × cena |
| **Jednorázový** | název, částka, kdy (začátek / konec / datum) | částka |
| **Průběžný** | název, částka za pracovní den / týden / měsíc | podle délky činnosti |

V tabulce plánu přibyl sloupec **Náklady** (u fáze součet), v záhlaví **náklady projektu**.
Délka činnosti se zdroji nemění – prodloužením činnosti se ale náklady práce zvýší samy.

## 2. Co se naučíte z vibe codingu

**Ruční příklad je nejlepší test.** Každé pravidlo výpočtu má test s příkladem, který jde spočítat
na papíře: „5 pracovních dnů × 8 h × 50 % = 20 h × 500 Kč = 10 000 Kč“. Když se pravidlo jednou
změní, test hned ukáže, co všechno se tím posunulo.

**Svátek není víkend a měsíc není 30 dní.** Při rozhodování „jak počítat nájem za měsíc“ jste
zvolili kalendářní dny: nájem kontejneru se platí i ve svátek a listopad má 30 dní, prosinec 31.
Takové rozhodnutí patří do zadání, ne jen do kódu – jinak se za půl roku nikdo nedozví proč.

**Data musí zůstat v pořádku i po změně jinde.** Řádek „člověk“ odkazuje na pracovníka a profesi.
Co když pracovník změní profesi, kategorie se smaže nebo se činnost změní na milník? Pro každý
takový případ je pravidlo (propsat, přesunout, zeptat se a odebrat) a test. Bez toho by
se soubor projektu časem rozbil a aplikace by ho odmítla otevřít.

**Výkon hned od začátku.** Náklady se počítají jednou pro každou verzi projektu a do řádků tabulky
jdou jen čísla – po změně jedné činnosti se nepřekresluje celá tabulka. Test hlídá, že výpočet
pro 300 činností × 3 řádky trvá pod 50 ms.

## 3. Příprava

- Hotová fáze 6a (databáze zdrojů).

## 4. Prompty krok za krokem

1. `Navrhni plán implementace fáze 6b, zatím nic nepiš.` → otázky (kde panel, jak počítat
   týden a měsíc, fáze a milníky, sloupec v tabulce) → schválit plán.
2. Po každém kroku: ověřit → `Funguje, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | schéma řádků, výpočet nákladů, akce úložiště (testy předem) | `npm test` |
| 2 | panel Detail činnosti: člověk a stroj | hodiny a náklad, ruční výpočet |
| 3 | materiál, jednorázový a průběžný náklad | vlastní cena, k datu, za měsíc; milník |
| 4 | sloupec Náklady, náklady projektu | součet fáze, bublina s rozpadem |
| 5 | návaznosti, vzorový projekt s náklady | mazání, změna na milník, import |
| 6 | dokončení, průvodce, zadání v1.10 | viz níže |

Užitečné doplňující prompty:
- `Spočítej mi ručně náklad činnosti <název> ze vzorového projektu a porovnej s aplikací.`
- `Proč se průběžný náklad za měsíc počítá po kalendářních dnech?`

## 5. Jak ověřit výsledek

```powershell
npm test          # přes 380 testů
npm audit         # 0 vulnerabilities
npm run dev
```

1. **Vzorový projekt** → záhlaví „Náklady: 6 274 822,49 Kč“ (při začátku projektu 15. 11. 2026).
2. Klik na „Analýza současného stavu výroby“ → panel: konstruktér 50 % → 40 h → 31 510,40 Kč.
3. ＋ Materiál, ＋ Jednorázový, ＋ Průběžný → náklad činnosti i fáze se změní.
4. Prodloužit činnost v grafu → náklad práce vzroste.
5. Zdroje → smazat profesi, která je na činnostech → hláška s výpisem činností.
6. Změnit činnost s lidmi na milník → otázka → Ctrl+Z.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Náklad nesedí s ručním výpočtem | `Činnost <název>: <řádek> mi ručně vychází <částka>, aplikace ukazuje <částka>. Napiš na to test a oprav výpočet.` |
| U řádku je ⚠ | `U řádku <člověk> je varování „chybí sazba“. Proč, když profese sazbu má?` |
| Soubor po úpravách nejde otevřít | `Po <co jsem udělal> soubor hlásí „<hláška>“. Najdi, kde se data rozešla, a přidej test.` |

## 7. Uložení do Gitu

`Fáze 6b je ověřená. Udělej commit s popisem v češtině a pošli ho na GitHub.`

## 8. Kontrolní otázky / mini-úkol

1. Proč se délka činnosti při přidání druhého člověka nezkrátí?
2. Proč milník nesmí mít člověka ani průběžný náklad?
3. Kdy je lepší přiřadit profesi a kdy konkrétního pracovníka?
4. **Mini-úkol:** ve vzorovém projektu přidejte k „Montáž a zapojení zařízení“ jednorázový náklad
   „Doprava zařízení“ 25 000 Kč na začátku. O kolik vzroste náklad fáze a projektu?
