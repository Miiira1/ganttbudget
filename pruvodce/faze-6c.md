# Fáze 6c – Kritická cesta a vytížení zdrojů

## 1. Cíl fáze

Plán teď odpoví na dvě otázky každého projektového manažera:

1. **Které činnosti nesmějí nabrat zpoždění?**
   - Tlačítko **Kritická cesta** žlutě zvýrazní činnosti bez rezervy.
   - Sloupec **Rezerva** ukáže, o kolik pracovních dnů se smí činnost zpozdit, aniž se posune konec projektu. V bublině je navíc volná rezerva: o kolik se smí zpozdit, aniž posune následníka.
2. **Nejsou lidé a stroje přetížení?**
   - Pracovníkům jde zadat **nepřítomnost**: dovolenou, nemoc nebo školení.
   - Nový pohled **Vytížení** ukáže pracovníky, profese a stroje po dnech, týdnech nebo měsících:
     - tyrkysová barva = práce v rámci kapacity,
     - červená = přetížení,
     - klik na zdroj = histogram a seznam činností.
   - Panel **Detail činnosti** upozorní ⚠, když je pracovník během činnosti nepřítomný nebo je zdroj přetížený.

Termíny činností se vytížením **nemění**. Aplikace jen upozorní a rozhodnutí nechá na vás: jiný pracovník, posun činnosti, nebo přesčas.

Uprostřed fáze přibyla **vizuální identita MiRo project**:
- logo, písmo Lato,
- barvy: grafit a papír jako základ,
- žlutá pro důležité věci (hlavní tlačítko, kritická cesta),
- tyrkysová pro interakci (výběr, dnešek, běžné úsečky činností).

## 2. Co se naučíte z vibe codingu

**Dopředu a pozpátku.**
- Termíny se počítají dopředu: nejdřívější začátek podle předchůdců.
- Kritická cesta potřebuje i výpočet pozpátku: nejpozdější konec, aby se neposunul konec projektu.
- Rozdíl obou výpočtů je rezerva.

Jádro zůstalo čistou funkcí, takže stačilo přidat zpětný průchod a ručně spočítané sítě v testech. Uživatelské rozhraní se nemuselo dotknout.

**Jeden výpočet pro dvě věci.** Náklady i vytížení potřebují „kolik hodin denně řádek znamená“. Výpočet je v jedné funkci (`lineHoursPerDay`), takže se hodiny v nákladech a ve vytížení nikdy nerozejdou.

**Barva má mít význam.** Původně byla kritická cesta červená, pak žlutá podle značky. Červená zůstala jen pro chyby (přetížení, mazání). Tyrkysová znamená „kde jsem a co dělám“ (výběr, dnešek), žlutá „tohle je důležité“. Když má každá barva jednu roli, stačí uživateli pohled.

**Kontrast se počítá, ne odhaduje.**
- Žlutá `#FFC000` na bílé má kontrast jen 1,6 : 1, proto nikdy jako text.
- Tlumená šedá musela ztmavnout na 4,6 : 1, protože norma WCAG AA chce pro text aspoň 4,5 : 1.

Výpočet kontrastu trvá vteřinu a ušetří stížnosti lidí se slabším zrakem.

**Podvržený soubor jako test odolnosti.** Při bezpečnostní kontrole se ukázalo, že nepřítomnost „od roku 1 do roku 9999“ by aplikaci zamrazila. Schéma (Zod) proto hlídá nejen tvar dat, ale i rozumné meze.

## 3. Příprava

- Hotová fáze 6b (řádky zdrojů a náklady na činnostech).
- Volitelně brand kit (logo, barvy, písmo). Do veřejného repozitáře nepatří, aplikace používá jen kopie v `src/assets`.

## 4. Prompty krok za krokem

1. `Navrhni plán implementace fáze 6c.` → otázky (přepínač, nebo trvale; vliv nepřítomnosti na termíny; kde histogram; které zdroje hlídat) → schválit plán.
2. Po každém kroku: ověřit → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | zpětný průchod jádra: pozdní termíny, rezervy, kritičnost (testy předem) | `npm test` |
| 2 | tlačítko Kritická cesta, zvýrazněné úsečky a vazby, sloupec Rezerva | prodloužit kritickou a nekritickou činnost |
| 3 | nepřítomnosti pracovníků (dialog, sloupec, schéma) | přidat dovolenou, Ctrl+Z |
| — | vizuální identita: barvy, logo, písmo, kontrast, tyrkysový akcent | světlý i tmavý vzhled |
| 4 | výpočet vytížení `src/model/load.ts` (testy předem, výkon pod 100 ms) | `npm test` |
| 5 | pohled Vytížení: mřížka, histogram, činnosti, odznak | týdny / měsíce, klik na zdroj a činnost |
| 6 | varování v panelu Detail činnosti, přehled zkratek | ⚠ u přetíženého řádku, F1 |
| 7 | audit, průvodce, README, zadání v1.12 | viz níže |

Užitečné doplňující prompty:
- `Spočítej mi ručně rezervu činnosti <název> a porovnej s aplikací.`
- `Proč je <pracovník> v týdnu <T> přetížený? Vypiš činnosti a hodiny po dnech.`
- `Zkontroluj kontrast barev <A> a <B> podle WCAG.`

## 5. Jak ověřit výsledek

```powershell
npm test          # přes 420 testů
npm audit         # 0 vulnerabilities
npm run dev
```

1. **Vzorový projekt** → **Kritická cesta** → žluté úsečky vedou bez přerušení od začátku do konce projektu, ostatní činnosti mají ve sloupci Rezerva kladné číslo.
2. Prodlužte nekritickou činnost o méně dnů, než je její rezerva → konec projektu se nezmění. Prodlužte kritickou → konec se posune.
3. **Vytížení** → odznak „2“ (dva přetížené zdroje). Přepněte na **Měsíce** → Eva Horáková má v červnu a červenci 2027 červené buňky.
4. Klik na Evu Horákovou → histogram s červenými sloupci nad čarou kapacity a tři činnosti. Klik na činnost → plán ji vybere a najede na ni.
5. Činnost 6.3 → panel Detail činnosti → červené ⚠ „přetížení během činnosti – 5 dnů“.
6. Zdroje → Pracovníci → Nepřítomnost u Evy 22.–23. 6. 2027 → v Detailu činnosti 6.3 přibude zlaté ⚠ → Ctrl+Z.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Kritická cesta „má díru“ | `Kritická cesta končí u <činnost>, ale projekt pokračuje. Spočítej ručně rezervy a napiš test.` |
| Vytížení nesedí s ručním výpočtem | `<Zdroj> má v týdnu <T> podle mě <X> h, aplikace ukazuje <Y> h. Napiš test a oprav výpočet.` |
| Barva je špatně čitelná | `<Prvek> je v <světlém/tmavém> vzhledu špatně čitelný. Spočítej kontrast a navrhni lepší odstín.` |

## 7. Uložení do Gitu

`Fáze 6c je ověřená. Udělej commit s popisem v češtině a pošli ho na GitHub.`

## 8. Kontrolní otázky / mini-úkol

1. Proč nepřítomnost pracovníka neposune termín činnosti? Kdy by to vadilo?
2. Jaký je rozdíl mezi celkovou a volnou rezervou?
3. Proč profese bez pracovníků nehlásí přetížení?
4. **Mini-úkol:** odstraňte přetížení Evy Horákové jen změnou plánu, ne zdrojů. Posuňte jednu z jejích souběžných činností, nebo jí snižte %. Jak se změnil konec projektu a proč?
