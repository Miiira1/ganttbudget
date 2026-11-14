# Fáze 4a – Hierarchie a přeskupování

## 1. Cíl fáze

Činnosti se dají seskupovat do fází (i fáze ve fázi, nejvýš 6 úrovní). Fáze si sama spočítá
začátek, konec a délku, jde sbalit a v grafu má sumární úsečku. Řádky se přesouvají tlačítky,
klávesami i tažením myší, každý řádek má WBS číslo (1, 1.1, 1.2.1…) a každou změnu vrátí Ctrl+Z.

## 2. Co se naučíte z vibe codingu

**Domluvit pravidla dřív než kód.** U přesouvání řádků existuje víc „správných“ chování
(kam se dostane předsazená činnost? co když odsadím pod obyčejnou činnost?). Claude proto
v plánu nejdřív položil tři otázky a sepsal **pravidla stromu** – teprve pak psal kód.
Rozhodnutí je dobré si zapsat (do plánu, případně do ZADANI.md), ať se k nim dá vrátit.

Druhá dovednost: **testy jako čitelná specifikace.** Testy stromu používají osnovu:
`['F', '  A', '  B', 'C']` = fáze F s činnostmi A, B a pak C. Test „předsadit B“ pak čte
i člověk bez programování: z `['F', '  A', '  B', '  C', 'D']` vznikne `['F', '  A', '  C', 'B', 'D']`.

Třetí: **vědět, co nástroj neověří.** Tažení myší Claude nedokázal vyzkoušet automaticky
(automatizovaná myš nespustí vestavěné tažení v prohlížeči) – ověřoval ho simulací a o
skutečnou zkoušku požádal člověka. Ověřuje vždy člověk.

## 3. Příprava

- Hotová a commitnutá fáze 3.
- Terminál ve složce projektu, `npm run dev` běží.

## 4. Prompty krok za krokem

1. `Navrhni plán implementace fáze 4a, nic ještě nepiš.`
2. Odpovězte na otázky (odsazení pod činnost, číslování, předsazení) a projděte pravidla stromu.
3. Plán schvalte. Pak po každém kroku: ověřit v prohlížeči → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | funkce stromu + délka fáze, testy | `npm test` (v prohlížeči nic nového) |
| 2 | vzorový projekt ve fázích, WBS, odsazení, délka fáze | sloupec WBS, termíny fází, úsečky fází |
| 3 | sbalení a rozbalení fází ▸/▾ | čísla řádků se nemění |
| 4 | výběr řádku, Odsadit / Předsadit / Nahoru / Dolů, Alt+Shift+šipky | potvrzení, hlášky, Ctrl+Z |
| 5 | přetahování řádků za úchyt ⠿ | čára / rámeček, nepovolená místa |
| 6 | test Zpět/Znovu, výkon, průvodce | viz níže |

Užitečné doplňující prompty:
- `Vysvětli mi na příkladu, proč se při předsazení řádek posune až za konec fáze.`
- `Ukaž mi test, který hlídá limit 6 úrovní, a vysvětli, co přesně zkouší.`

## 5. Jak ověřit výsledek

```powershell
npm test          # mají projít všechny testy (přes 160)
npm run dev       # pak otevřete http://localhost:5173
```

V prohlížeči klikněte na **Vzorový projekt**:

1. Činnosti jsou odsazené pod fázemi, sloupec **WBS** ukazuje 1, 1.1, 1.2…; fáze mají
   začátek, konec a délku (fáze 1 = 25 pracovních dnů) a v grafu tmavou sumární úsečku.
2. **▾ / ▸** u fáze ji sbalí v tabulce i grafu; čísla ve sloupci Č. se nemění.
3. Klikněte do řádku (zmodrá v tabulce i grafu) a zkuste **Předsadit / Odsadit / Nahoru / Dolů**
   v liště i **Alt+Shift+← → ↑ ↓**. WBS, termíny i graf se hned přepočítají.
4. Odsaďte „Výběrové řízení…“ pod „Přípravu zadávací dokumentace“ → aplikace se zeptá, protože
   se Příprava změní na fázi a přijde o vazby.
5. Fáze s činnostmi nejde změnit na činnost (volby v Typu jsou zašedlé).
6. Smažte fázi → otázka „…včetně N podřízených položek?“.
7. Přetáhněte řádek za **⠿** doprostřed jiné fáze (rámeček) a před jiný řádek (čára).
   Fázi do její vlastní činnosti pustit nejde. Esc tažení zruší.
8. **Přidat činnost** vloží řádek pod vybraný řádek.
9. Po každé změně **Ctrl+Z** (s kurzorem mimo pole) vrátí přesně jeden krok, **Ctrl+Y** ho obnoví.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Řádek se po přesunu objevil jinde, než čekáte | `Předsadil jsem řádek 7 a skončil na řádku 12. Čekal jsem řádek 9. Popiš pravidlo, podle kterého se to stalo, a napiš na můj případ test.` |
| Fáze má špatný začátek nebo délku | `Fáze 3 má podle mě trvat od 5. 2. do 5. 4. 2027 (40 dní), aplikace ukazuje <…>. Spočítej to ručně a napiš test.` |
| Tažení myší nic nedělá | `Tažení za ⠿ nefunguje v prohlížeči <Chrome/Firefox/Edge>. Co vidíš v konzoli?` (vložte i text z konzole F12) |
| Alt+Shift přepne jazyk klávesnice | `Zkratka Alt+Shift+šipka mi přepíná klávesnici. Navrhni jinou zkratku.` |
| Ctrl+Z vrátí víc kroků najednou | `Po <akce> vrátilo Ctrl+Z dva kroky. Napiš test, že tato akce je jeden krok, a oprav to.` |

## 7. Uložení do Gitu

`Fáze 4a je ověřená. Udělej commit s popisem v češtině.`

## 8. Kontrolní otázky / mini-úkol

1. Proč si číslo řádku (Č.) a WBS číslo nejsou rovny a k čemu je každé dobré?
2. Proč fáze zatím nemůže mít vazby a co se stane s vazbami činnosti, která se změní na fázi?
3. Proč sbalení fáze nejde vrátit přes Ctrl+Z?
4. **Mini-úkol:** požádejte Claude o test „přesun fáze i s jejími činnostmi před jinou fázi
   tažením“. Nejdřív si výslednou osnovu napište sami (ve tvaru `['F', '  A', …]`).
