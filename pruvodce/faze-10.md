# Fáze 10 – Učení a přívětivost

## 1. Cíl fáze

Aplikace už umí hodně. Teď ji má zvládnout i člověk, který nikdy neplánoval projekt:

- **Nápověda ⓘ** vysvětlí pojem přímo tam, kde ho uživatel potká:
  - ve sloupcích tabulky (WBS, Rezerva, Předchůdci, % hotovo…),
  - u přepínačů Kritická cesta a Baseline,
  - v pohledech Vytížení, Náklady a Sledování.
- **Slovníček** (📖 v liště) má 36 pojmů na jednom místě a vyhledávání.
- **Kontrola plánu** (🔍 v liště se žlutým počtem varování) najde, co v plánu nejspíš chybí nebo nesedí. U každého varování je rada **Jak to opravit** a tlačítko, které ukáže problémové místo.
- **Okno Nový projekt** nabízí tři cesty: prázdný projekt, průvodce, nebo jednu z pěti šablon ze strojírenství a výroby.
- **Průvodce prvním projektem** projde pět kroků: název a měna → začátek → kalendář → první fáze → shrnutí.
- **Úvodní obrazovka prázdného plánu** nabízí průvodce, šablonu, první činnost i vzorový projekt.

| Šablona | Položky | Délka | Rozpočet | Co na ní ukázat |
|---|---|---|---|---|
| Zavedení automatizace do výroby | 29 | ≈ 9 měs. | 6,3 mil. Kč | všechny typy vazeb včetně SF |
| Vývoj nového výrobku | 26 | ≈ 7 měs. | 2,7 mil. Kč | milníky jako „brány“, FMEA souběžně (FF) |
| Zavedení nové výrobní linky | 28 | ≈ 7 měs. | 14,7 mil. Kč | přejímky FAT / SAT, platby v milnících, předstih |
| Investiční akce – výstavba haly | 26 | ≈ 10 měs. | 19,5 mil. Kč | dvě větve před smlouvou, měsíční fakturace |
| Plánovaná odstávka a údržba | 23 | ≈ 3 měs. | 1,6 mil. Kč | kritická je dodávka dílů, náklad za pracovní den |

## 2. Co se naučíte z vibe codingu

**Mezery v zadání se doplňují nahlas.** Zadání chtělo hlásit „vazbu vedoucí do minulosti“, ale neříkalo, co to přesně je. Claude navrhl dvě konkrétní pravidla, uživatel je schválil a teprve pak vznikl kód. Odpovědi se hned zapsaly do `ZADANI.md` (v1.17), aby se na ně v další konverzaci nezapomnělo.

**Varování, které křičí u správného plánu, je horší než žádné.** Doslovné pravidlo „každá činnost musí mít předchůdce“ by hlásilo i první činnost projektu. Proto platí výjimky:
- první položka bez předchůdce se nehlásí, stejně jako položka s pevným začátkem 📌,
- položka končící s koncem projektu nemusí mít následníka.

Testy na vzorovém projektu ověřují, že kontrola najde jen to, co opravdu najít má.

**Refaktoring s důkazem.** Vzorový projekt se přepsal na obecný popis šablony, aby další šablony byly jen data a texty. Jak ověřit, že se nic nerozbilo? Před úpravou se uložil celý vytvořený projekt do souboru, po úpravě znovu a oba soubory se porovnaly: byly **byte po bytu stejné**. „Myslím, že je to stejné“ nestačí.

**Jeden test pro všechny šablony.** Testy v `templates.test.ts` se spustí pro každou šablonu v seznamu. Kontrolují:
- že je šablona přeložená a platná,
- že má 20–30 položek a vazby bez kruhu,
- že nikde nechybí sazba,
- že kontrola plánu nehlásí nic nečekaného.

Pátá šablona tak dostala stejné testy jako první, aniž by se musel psát jediný nový test.

**Ukázková data mají učit.** Každá šablona ukazuje něco jiného:
- kritickou cestu přes dodávku dílů (ne přes schvalování),
- rezervu u přejímky,
- měsíční fakturaci stavby na S-křivce.

Pracovníci jsou rozvržení tak, aby nikdo nebyl přetížený, takže kontrola plánu začíná na ✓.

**Přístupnost se ověřuje, ne předpokládá.** Test v prohlížeči ukázal, že po otevření průvodce skončil kurzor na nadpisu místo v poli Název. Šlo psát, ale až po kliknutí. Oprava zajistí, že je kurzor hned v poli Název a že se při přechodu na další krok přesune na nadpis kroku, takže ho čtečka obrazovky přečte.

## 3. Příprava

- Hotová fáze 9 (baseline a sledování).
- Rozmyslet si, pro koho je nápověda: student bez zkušenosti s projektovým řízením, ne odborník.

## 4. Prompty krok za krokem

1. `Přečti si ZADANI.md a CLAUDE.md. Fáze 0–9 jsou hotové. Navrhni plán implementace fáze 10, zatím nic nepiš.` Claude odpoví plánem a otázkami: co je „vazba do minulosti“, jak velké mají být šablony, zda se průvodce ptá na konec projektu, kdy se průvodce otevře a zda jde varování skrýt. Pak plán schválit.
2. Po každém kroku ověřit výsledek a napsat `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | ⓘ u pojmů a okno Slovníček | ⓘ u Rezervy, Esc, hledat „baseline“, angličtina |
| 2 | výpočet kontroly plánu (nejdřív testy) | `npm test` |
| 3 | tlačítko Kontrola plánu, okno s radami a akcemi | vzorový projekt → 4 varování → Ukázat v plánu |
| 4 | okno Nový projekt, společný popis šablon | šablona od zvoleného data, Ctrl+Z |
| 5a–5d | čtyři nové šablony (jedna na krok) | Kontrola plánu ✓, kritická cesta, Náklady |
| 6 | průvodce prvním projektem (výpočet s testy + okno) | projít 5 kroků, chybové hlášky, Ctrl+Z |
| 7 | zadání v1.18, průvodce, README, audit | viz níže |

Užitečné doplňující prompty:
- `Proč Kontrola plánu hlásí u <název> „bez následníka“? Ukaž, co na činnost navazuje.`
- `Navrhni šestou šablonu (např. zavedení ERP) ve stejném formátu jako ostatní. Nejdřív jen seznam fází a činností.`
- `Projdi texty ve slovníčku a najdi pojem, který je vysvětlený odborněji, než by student pochopil.`

## 5. Jak ověřit výsledek

```powershell
npm test          # přes 600 testů
npm audit         # 0 vulnerabilities
npm run dev
```

1. **Soubor → Nový projekt… → Prázdný projekt.** Na úvodní obrazovce klikněte na **Spustit průvodce**.
   - Klikněte na Další bez názvu → objeví se hláška.
   - Projděte všech 5 kroků a přidejte odstávku.
   - Výsledek: 3 fáze, každá s první činností propojenou za sebou. Kontrola plánu ukazuje ✓.
2. Ve vytvořeném plánu smažte druhé činnosti předchůdce → Kontrola plánu ukáže 2 varování: druhá činnost je bez předchůdce a na první už nic nenavazuje → **Jak to opravit** → **Ukázat v plánu** → Ctrl+Z.
3. **Soubor → Nový projekt…** → vyberte šablonu → změňte datum začátku a sledujte, jak se mění údaje na kartě → **Vytvořit**.
4. Klikněte na **ⓘ** u sloupce Rezerva a pak **📖 Slovníček** → hledejte „rezerv“.
5. Načtěte **Vzorový projekt** → Kontrola plánu ukáže několik varování (v listopadu 2026 to byla 4): přetížené zdroje, zpožděnou činnost a činnost bez následníka. Počet se může lišit podle dnešního data.
6. Přepněte jazyk na angličtinu a zkontrolujte, že šablony, slovníček, průvodce i varování jsou anglicky.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Kontrola plánu hlásí varování, které podle vás není chyba | `Kontrola plánu hlásí u <název> „<text>“. Podle mě je to v pořádku, protože <důvod>. Má to být výjimka? Navrhni úpravu pravidla a test.` |
| Bublina ⓘ se objeví mimo obrazovku nebo zakrývá, co nemá | `Bublina ⓘ u <místo> se při šířce okna <N> px zobrazí <kde>. Posílám screenshot.` |
| Šablona po vytvoření hlásí přetížení | `Šablona <název> po vytvoření hlásí přetížení zdroje <jméno>. Uprav rozvržení lidí tak, aby šablona začínala bez varování, a doplň test.` |

## 7. Uložení do Gitu

`Fáze 10 je ověřená. Udělej commit s popisem v češtině a pošli ho na GitHub.`

## 8. Kontrolní otázky / mini-úkol

1. Proč se varování v Kontrole plánu neblokují a nejdou skrýt? Jaké to má výhody a nevýhody?
2. Projekt má dvě činnosti, které obě začínají se začátkem projektu a nemají předchůdce. Kontrola hlásí jednu z nich. Co uděláte?
3. Proč šablona nezačíná dnešním dnem, ale nejbližším pondělím?
4. **Mini-úkol:** v šabloně Plánovaná odstávka a údržba prodlužte Dodávku náhradních dílů o 5 dní. O kolik se posune konec projektu? Proč se konec neposune, když o 5 dní prodloužíte Revizi elektro a tlakových zařízení? Ověřte to zapnutou Kritickou cestou a sloupcem Rezerva.
