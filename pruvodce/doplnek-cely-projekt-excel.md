# Doplněk po fázi 7 – Celý projekt v Excelu

## 1. Cíl

V nabídce **Soubor** jsou dvě nové položky:

- **Exportovat celý projekt do Excelu…** uloží jeden sešit s 12 listy:

  | List | Obsah |
  |---|---|
  | Projekt | název, začátek, měna, limit, pracovní dny, svátky |
  | Kalendář | volna a odstávky |
  | Činnosti | činnosti projektu |
  | Řádky | řádky rozpočtu |
  | Kategorie | kategorie nákladů s limity |
  | Střediska, Profese, Pracovníci | databáze lidí, u profesí a pracovníků i kalkulace sazby |
  | Nepřítomnosti | dovolené a nemoci |
  | Stroje, Materiály | databáze strojů a materiálů |
  | Náběh | náklady po měsících |

- **Importovat celý projekt z Excelu…** sešit (třeba upravený v Excelu) zase načte. Ukáže náhled s počty za listy, nebo chyby s listem a řádkem. Po potvrzení nahradí celý projekt jedním krokem Zpět.

**Šedé sloupce** s dovětkem „(vypočteno)“ jsou jen pro kontrolu:
- termíny činností, sazby z kalkulace, h/den, hodiny, náklady a celý list Náběh,
- import je ignoruje a spočítá znovu,
- náklad v Excelu změníte jen přes vstupy: ruční sazbu nebo kalkulaci u profese či pracovníka, podíl %, h/den, nebo délku činnosti.

## 2. Co se naučíte z vibe codingu

**Nejdřív pochopit problém, pak navrhnout řešení.** Výchozí stížnost byla „v exportu rozpočtu je náklad, ale nejde z něj poznat, jak vznikl“. Claude nejdřív vysvětlil příčinu: data jsou rozdělená do tří samostatných exportů a náklad je výsledek výpočtu, ne vstup. Pak se zeptal, k čemu export slouží (úpravy v Excelu? report? záloha?) a jak zacházet s vypočtenými sloupci. Teprve potom navrhl řešení.

**Vstup a výsledek se nesmí plést.** Kdyby import bral sloupec Náklad jako zadanou hodnotu, mohl by se rozejít se sazbou a hodinami a v projektu by byla dvě různá čísla. Proto jsou vypočtené sloupce vidět, ale šedé a import je ignoruje.

**Nejlepší test: tam a zpátky.** Vzorový projekt → export → import musí dát stejný projekt: stejné činnosti, řádky, sazby, náklady na haléř, konec projektu, kalendář i limity. Test to dělá i přes skutečný soubor Excelu. Takový test odhalí každý sloupec, na který se zapomnělo.

**Znovupoužití místo kopírování.** List Činnosti načítá stávající import činností, list Řádky stávající import rozpočtu. Opravy a pravidla tak platí všude stejně.

**Měřit i „náhodné“ chyby.** Během práce jednou selhal test výkonu. Claude nejdřív změřil, kde se čas tráví, a výpočet náběhu zrychlil ze 33 na 12 ms. Neodpustil to jako „náhodu“: stejná chyba by mohla zablokovat automatické nasazení na GitHubu.

## 3. Příprava

- Hotová fáze 7 (rozpočet v čase).
- Excel nebo LibreOffice.

## 4. Prompty krok za krokem

1. `Mám trochu problém s exportem a importem dat… Navrhni možnosti řešení a případně se doptej.` → otázky (k čemu export slouží, co s vypočtenými sloupci) → návrh → schválit.
2. Po každém kroku ověřit → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | export sešitu s 12 listy, šedé vypočtené sloupce (testy předem) | otevřít v Excelu, sazby na listu Profese |
| 2 | import sešitu (testy předem: tam a zpátky, chyby) | `npm test` |
| 3 | nabídka a dialog s náhledem, zrychlení náběhu | export → úprava → import → Ctrl+Z |
| 4 | audit, průvodce, README, zadání v1.14 | viz níže |

## 5. Jak ověřit výsledek

```powershell
npm test          # přes 470 testů
npm audit         # 0 vulnerabilities
npm run dev
```

1. Vzorový projekt → **Soubor → Exportovat celý projekt do Excelu…**.
2. V Excelu na listu **Profese** zvyšte ruční sazbu jedné profese, nebo mzdu v kalkulaci. Uložte.
3. **Soubor → Importovat celý projekt z Excelu…** → náhled (Činnosti 29, Řádky 46, Pracovníci 7…) → **Nahradit projekt** → náklady v záhlaví vzrostou.
4. **Ctrl+Z** vrátí původní projekt.
5. Na listu **Pracovníci** napište u někoho neexistující profesi → import vypíše „List ‚Pracovníci‘, řádek N: profese s tímto názvem není na listu Profese“ a nic nezmění.

**Pozor na citlivá data:** sešit obsahuje celý projekt včetně mezd z kalkulace sazeb (stejně jako soubor projektu .json). Nesdílejte ho s někým, kdo je vidět nemá.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Po exportu a importu se něco liší | `Po exportu a importu celého projektu se změnilo <co>. Doplň to do testu „tam a zpátky“ a oprav.` |
| Import hlásí chybu, kterou nechápu | `Import celého projektu hlásí: „<text>“. Na listu je <obsah řádku>. Co je špatně?` |
| Excel přepsal WBS nebo datum na jiný tvar | `Excel mi v sešitu změnil <hodnotu>. Jak ji zapsat, aby ji import přijal?` |

## 7. Uložení do Gitu

`Doplněk je ověřený. Udělej commit s popisem v češtině a pošli ho na GitHub.`

## 8. Kontrolní otázky / mini-úkol

1. Proč import ignoruje sloupec Náklad? Co by se stalo, kdyby ho bral vážně?
2. Proč si položky databáze se stejným názvem ponechají při importu své ID?
3. Kdy použít export celého projektu do Excelu a kdy soubor projektu (.json)?
4. **Mini-úkol:** v sešitu přidejte na list Profese novou profesi a na listu Řádky ji přiřaďte jedné činnosti (podíl 50 %). Po importu ověřte v panelu Detail činnosti hodiny a náklad.
