# Fáze 2 – Kalendář a plánovací jádro

## 1. Cíl fáze

Aplikace sama spočítá začátek a konec každé činnosti z její délky, předchůdců a kalendáře.
Přeskakuje víkendy, české státní svátky (včetně Velikonoc) a vlastní odstávky.
Když prodloužíte jednu činnost, posunou se všechny, které na ni navazují.

## 2. Co se naučíte z vibe codingu

**Testy před kódem.** U výpočtů se chyba z obrazovky špatně pozná – termín „vypadá rozumně“,
i když je o den vedle. Proto Claude nejdřív napsal testy s ručně spočítanými příklady
(např. „činnost na 3 dny od pondělí 16. 11. 2026 skončí ve čtvrtek 19. 11., protože 17. 11. je svátek“)
a teprve pak kód, který je splní. Testy pak hlídají, že se výpočet později nerozbije.

Druhá dovednost: **ověřovat fakta, ne jen kód.** Seznam svátků se před zakódováním porovnal
s aktuálním zněním zákona.

## 3. Příprava

- Hotová a commitnutá fáze 1.
- Terminál ve složce projektu (`cd "C:\Users\mirek\Documents\Vibe-code\miro-project"`).

## 4. Prompty krok za krokem

1. `Navrhni plán implementace fáze 2, nic ještě nepiš.`
2. Odpovězte na otázky (zápis předchůdců, date-fns ano/ne) a projděte pravidla výpočtu.
   Pokud s pravidlem nesouhlasíte (např. kdy začíná činnost po milníku), řekněte to **teď**.
3. `Ano, začni.`

Užitečné doplňující prompty:
- `Vysvětli mi na příkladu, jak se počítá konec činnosti, která trvá 5 dní a začíná v pátek.`
- `Ukaž mi test, který ověřuje svátky, a vysvětli, co přesně kontroluje.`

## 5. Jak ověřit výsledek

```powershell
npm test          # mají projít všechny testy (přes 80)
npm run dev       # pak otevřete http://localhost:5173
```

V prohlížeči:

1. **Vzorový projekt** → sloupce Začátek a Konec mají data, nahoře je „Konec: …“.
2. Ověřte ručně jednu činnost: řádek 2 (10 dní od 16. 11. 2026) končí 30. 11. – 17. 11. je svátek.
3. Prodlužte řádek 2 z 10 na 15 dní → všechny další činnosti a konec projektu se posunou.
4. U řádku 5 napište do Předchůdců `3+5` → začne o 5 pracovních dní později.
5. Napište do Předchůdců řádku 5 `3; 7` → objeví se žluté upozornění na **kruh 5 → 6 → 7 → 5**
   a vrátí se původní hodnota. Zkuste i `abc` nebo `99`.
6. **Kalendář** → přidejte odstávku 21. 12. – 31. 12. → činnosti přes Vánoce se protáhnou.
7. V Kalendáři rozbalte svátky: je tam Velký pátek 3. 4. 2026 a Velikonoční pondělí 6. 4. 2026.
   Odškrtněte 28. 9. a sledujte, jak se termíny posunou.
8. Zavřete dialog, klikněte mimo pole a stiskněte **Ctrl+Z** → poslední změna kalendáře se vrátí.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| `npm test` hlásí chybu v `schedule.test.ts` | `Test „<název>“ neprošel: <text>. Čekal jsem <datum>, vyšlo <datum>. Je chyba v testu, nebo ve výpočtu? Nejdřív to spočítej ručně.` |
| Termín nesedí s tím, co spočítáte v kalendáři | `Činnost na řádku 4 má trvat 10 dní od 22. 12., podle mě má skončit 7. 1., aplikace ukazuje <datum>. Napiš na to test a oprav výpočet.` |
| `npm` hlásí ENOENT / nenašel package.json | Terminál je ve špatné složce – nejdřív `cd` do složky projektu. |
| Stránka po změně zamrzne | `Po <akce> stránka zamrzla. Mohl by výpočet běžet donekonečna? Přidej test na tento případ.` |

## 7. Uložení do Gitu

`Fáze 2 je ověřená. Udělej commit s popisem v češtině.`

## 8. Kontrolní otázky / mini-úkol

1. Proč je konec činnosti „poslední pracovní den“, a ne „den po skončení“? Co by se změnilo?
2. Proč se Velikonoce počítají algoritmem, a ne seznamem dat na 10 let dopředu?
3. Co je „kruh“ ve vazbách a proč ho aplikace nesmí přijmout?
4. **Mini-úkol:** požádejte Claude o test „projekt začínající 24. 12. 2026 – první činnost začne 28. 12.“.
   Nejdřív si výsledek spočítejte sami v kalendáři, pak test spusťte.
