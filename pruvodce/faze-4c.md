# Fáze 4c – Všechny typy vazeb

## 1. Cíl fáze

Činnosti jde propojit všemi čtyřmi typy vazeb: **FS** (konec → začátek), **SS** (začátek → začátek),
**FF** (konec → konec) a **SF** (začátek → konec), s prodlevou i předstihem. Vazba se zapíše
textem ve sloupci Předchůdci (`3SS+2`) nebo se nakreslí tažením v grafu. Aplikace termíny hned
přepočítá a nedovolí vytvořit kruh.

## 2. Co se naučíte z vibe codingu

**Zkontrolovat, že příklad opravdu odpovídá pravidlu.** V plánu stál příklad vazby SF
„zaškolení musí skončit nejpozději den před zkušebním provozem“. Při psaní testů se ukázalo,
že SF říká opak (*nejdříve*). Claude chybu přiznal, vysvětlil ji a nabídl lepší příklad
(„náhradní ruční výroba běží, dokud nezačne zkušební provoz“). Plán není neomylný – ani váš,
ani Claudův. Proto testy píšeme dřív než kód: odhalí i chybu v myšlence, nejen v programu.

Druhá dovednost: **psát testy s ručně spočítanými daty.** U každého typu je v testu komentář,
jak se výsledek spočítal (např. „16. 11. + 5 pracovních dnů = 18., 19., 20., 23., 24. → 24. 11.“).
Dva testy měly chybu v počítání – odhalilo se to dřív, než vznikl kód.

## 3. Příprava

- Hotová a commitnutá fáze 4b.
- Terminál ve složce projektu, `npm run dev` běží.

## 4. Prompty krok za krokem

1. `Navrhni plán implementace fáze 4c, zatím nic nepiš.`
2. Odpovězte na otázky (zkratky FS/SS/FF/SF nebo české KZ/ZZ/KK/ZK, vazby fází, způsob kreslení)
   a projděte **tabulku pravidel výpočtu** – hlavně SF.
3. Plán schvalte. Pak po každém kroku: ověřit → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | jádro: SS, FF, SF + testy | `npm test` (v prohlížeči nic nového) |
| 2 | zápis typů ve sloupci Předchůdci | `3SS+2`, `3ZZ+2`, `3FF`, `3SF`, kruh |
| 3 | vzorový projekt se všemi typy | SS+10 u haly, FF u programování, SF u ruční výroby |
| 4 | kreslení vazeb tažením z koleček | typ podle odkud/kam, kruh, Esc, Ctrl+Z |
| 5 | výkon, průvodce | viz níže |

Užitečné doplňující prompty:
- `Vysvětli mi na příkladu ze vzorového projektu rozdíl mezi FS a SS.`
- `Kdy se v praxi používá SF? Dej mi příklad ze strojírenství.`

## 5. Jak ověřit výsledek

```powershell
npm test          # mají projít všechny testy (přes 220)
npm run dev       # pak otevřete http://localhost:5173
```

V prohlížeči klikněte na **Vzorový projekt**:

1. Ve sloupci Předchůdci jsou vidět `12SS+10` (úprava podlahy), `10+5; 12FF` (programování PLC)
   a `26SF` (náhradní ruční výroba). Šipky v grafu vedou ze začátku / konce podle typu;
   bublina šipky typ vysvětlí („SS – začne se začátkem…“).
2. U řádku 5 napište do Předchůdců `3SS+2` (nebo `3ZZ+2`) → začne 2 pracovní dny po začátku řádku 3,
   zobrazí se `3SS+2`. Zkuste `3FF` a `3SF` a sledujte termíny.
3. U řádku 3 napište `5SS` (když řádek 5 navazuje na 3) → hláška o kruhu, vrátí se původní hodnota.
4. V grafu najeďte na úsečku → u začátku a konce se objeví kolečka. Táhněte z pravého kolečka
   na levou polovinu jiné činnosti → vznikne FS; na pravou polovinu → FF; z levého kolečka → SS / SF.
   Táhněte zpět na činnost, která už na tuto navazuje → červené „Vznikl by kruh“.
5. Esc během kreslení zruší, Ctrl+Z vrátí novou vazbu.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Termín po vazbě SS/FF/SF nesedí | `Řádek 5 má vazbu 3FF, podle mě má skončit <datum>, aplikace ukazuje <datum>. Spočítej to ručně a napiš na to test.` |
| Zápis vazby aplikace odmítá | `Zápis „<text>“ aplikace odmítá s hláškou „<hláška>“. Mělo by to jít?` |
| Kolečka se neobjeví nebo kreslení nefunguje | `Kolečka u úsečky se neobjeví / tažení z nich nic nedělá v prohlížeči <název>. Co vidíš v konzoli?` |
| Šipka vede z nesprávného konce | Pošlete screenshot: `Vazba SS z řádku 12 na 16 vede z konce, má vést ze začátku.` |

## 7. Uložení do Gitu

`Fáze 4c je ověřená. Udělej commit s popisem v češtině.`

## 8. Kontrolní otázky / mini-úkol

1. Čím se liší FS a SS? Kdy použijete prodlevu u SS (např. `SS+10`)?
2. Proč vazba SF klade *dolní* hranici konce (nejdříve), a ne horní (nejpozději)?
3. Proč aplikace nedovolí kruh ani přes jiné typy než FS?
4. **Mini-úkol:** najděte ve vzorovém projektu dvojici činností, kterou by šlo propojit FF.
   Nakreslete vazbu tažením a ověřte, že obě skončí ve stejný den.
