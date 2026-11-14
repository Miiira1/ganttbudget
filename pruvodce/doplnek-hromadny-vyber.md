# Doplněk po fázi 5 – Hromadný výběr činností

## 1. Cíl

Klávesou **Ctrl** jde vybrat více činností najednou (Shift vybere souvislý rozsah) a pracovat
s nimi naráz: odsadit, předsadit, posunout nahoru / dolů, duplikovat, smazat, přetáhnout
v tabulce i posunout jejich úsečky v grafu. Každá taková akce je jeden krok Zpět.

## 2. Co se naučíte z vibe codingu

**Nová funkce mimo zadání.** Hromadný výběr v `ZADANI.md` nebyl. Claude to řekl dřív, než začal,
navrhl ho jako samostatný doplněk před fází 6 a zápis do zadání (v1.7) až po dokončení
a s vaším souhlasem. Zadání tak pořád odpovídá tomu, co aplikace umí.

**Pravidla předem, ne až v kódu.** Než vznikl první řádek kódu, rozhodli jste tři věci:
jak se vybírá (Ctrl i Shift), které akce fungují hromadně a co když akce nejde
u jednoho z řádků („nic nezměnit“). Právě tato rozhodnutí pak určila testy – např.
„blok na kraji se nepohne, ani jeho část“.

**Měřit, ne odhadovat.** U posunu 300 vybraných úseček Claude změřil puštění (≈ 0,3 s, v limitu)
i jednotlivé kroky tažení (≈ 70 ms – náhled je znatelně trhaný) a řekl to otevřeně, místo
„funguje to“. Zrychlení je zapsané do fáze 13.

## 3. Příprava

- Hotová a nasazená fáze 5 (MVP 1.0).

## 4. Prompty krok za krokem

1. `Zapracuj to, aby šlo s klávesou CTRL označit více činností najednou. Použije se např. pro
   hromadné přesouvání činností, nebo hromadné odsazení apod.`
2. Odpovězte na otázky (Ctrl i Shift, které akce, co když akce nejde) a schvalte plán.
3. Po každém kroku: ověřit → `Funguje, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | jádro: hromadné operace ve stromu + testy | `npm test` (v prohlížeči nic nového) |
| 2 | výběr Ctrl / Shift / Esc, zvýraznění, počet | výběr v tabulce i v grafu |
| 3 | Odsadit, Předsadit, Nahoru, Dolů, Ctrl+D, Ctrl+Delete hromadně | blok na kraji, jedno potvrzení mazání |
| 4 | tažení více řádků za ⠿ | pořadí po přesunu, Ctrl+Z |
| 5 | posun více úseček v grafu | stejný počet pracovních dnů, 📌, Ctrl+Z |
| 6 | přehled zkratek (F1), průvodce, zadání v1.7 | F1 |

## 5. Jak ověřit výsledek

```powershell
npm test          # přes 310 testů
npm run dev
```

1. Vzorový projekt: klik na řádek 2, **Shift+klik** na řádek 3 → v liště „Vybrány 2 řádky“.
2. **Alt+Shift+←** předsadí oba, **Ctrl+Z** je vrátí jedním krokem.
3. **Ctrl+klik** na tři úsečky v grafu, jednu táhnout doprava → posunou se všechny tři.
4. **Ctrl+D** zkopíruje vybrané, **Ctrl+Delete** se zeptá jednou a smaže je.
5. **Esc** zruší hromadný výběr. **F1** – nové řádky v části „Myší“.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Ctrl+klik začne psát do pole | `Ctrl+klik do pole Název v řádku 5 nevybere řádek, ale začne psaní.` |
| Hromadná akce udělá něco jiného, než čekám | `Vybral jsem řádky 4, 6 a 7 a dal Odsadit. Čekal jsem <co>, stalo se <co>.` |
| Tažení skupiny je pomalé | `Posun <počet> vybraných úseček trvá <jak dlouho>. Změř to a navrhni zrychlení.` |

## 7. Uložení do Gitu

`Hromadný výběr funguje. Udělej commit s popisem v češtině a pošli ho na GitHub.`

## 8. Kontrolní otázky / mini-úkol

1. Proč se při hromadném posunu nahoru nepohne nic, když první vybraný řádek už výš nemůže?
2. Proč se ostatní úsečky posunou o stejný počet *pracovních* dnů, a ne kalendářních?
3. **Mini-úkol:** vyberte Shiftem tři činnosti jedné fáze a přetáhněte je za ⠿ do jiné fáze.
   Pak vše vraťte jedním Ctrl+Z.
