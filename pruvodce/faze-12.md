# Fáze 12 – Myšlenková mapa

## 1. Cíl fáze

Než student začne řešit termíny, potřebuje si rozmyslet, **z čeho projekt sestává**. K tomu slouží myšlenková mapa:

- **Sedmý pohled „Mapa“**: uprostřed střední téma (název projektu), kolem větve a podvětve. Hlavní větve se rozkládají vlevo a vpravo, každá má svou barvu.
- **Ovládání klávesnicí** jako v programech na myšlenkové mapy: Tab = podřízený uzel, Enter = sourozenec, F2 nebo psaní = přejmenovat, Delete = smazat, šipky = pohyb, mezerník = sbalit, Alt+Shift+↑/↓ = pořadí.
- **Myší**: tažením uzlu ho přesunete (doprostřed jiného uzlu = pod něj, k okraji = před / za něj), kolečko přibližuje, tažení pozadí posouvá. Všechno jde i tlačítky v liště.
- **Vytvořit plán z mapy**: větve se stanou fázemi, koncové uzly činnostmi (5 pracovních dnů, bez vazeb). Náhled, volba „Přidat na konec plánu“ / „Nahradit plán“, jeden krok Zpět.
- **Odsazený text**: osnovu z Wordu, poznámek nebo od AI jde vložit jako mapu (odrážky a číslování se samy odstraní) a mapu zase zkopírovat jako osnovu.
- Mapa se **ukládá do projektu** a je i v exportu pro AI.

Mimo fázi (na přání uživatele): v tmavém vzhledu je lépe vidět výplň **% hotovo** v Ganttově diagramu.

## 2. Co se naučíte z vibe codingu

**Rozhodnutí zapsané v zadání ušetří knihovnu.** Zadání nechávalo na fázi 12 volbu mezi knihovnou React Flow a vlastním kreslením. Rozložení stromu do dvou stran se dá napsat jako krátká čistá funkce s testy – stejně jako Ganttův diagram. Jedna závislost méně = méně aktualizací a méně bezpečnostních rizik.

**Geometrie se dá testovat.** Testy rozložení nehledí na obrázek, ale na čísla: žádné dva rámečky se nepřekrývají, rodič je uprostřed svých podřízených, podřízení leží směrem ven, sbalená větev mapu zmenší. Stejně se testuje, kam uzel „spadne“ po puštění myši.

**Testovací prohlížeč není skutečný prohlížeč.** Mapa se v náhledu napoprvé vůbec nevykreslila: pomocná funkce čekala na zprávu o velikosti okna, která v neviditelném panelu nepřišla. Oprava (změřit hned) pomohla i zbytku aplikace. A schránka v testu nefunguje bez skutečného kliknutí – proto zkoušku „Zkopírovat“ udělal člověk.

**Nepovinné pole = žádná migrace.** Mapa je v souboru projektu nové, ale **nepovinné** pole. Starší soubory se otevřou beze změny, verze formátu zůstává 2. Test hlídá, že ani import celého projektu z Excelu mapu nezahodí.

**Uživatel se může ozvat uprostřed kroku.** Během kroku 4 přišel požadavek na lepší barvu % hotovo v tmavém vzhledu. Byl malý a jasný, proto se udělal hned a krok pak pokračoval. Ověření: výpočet barev v náhledu a snímek obrazovky.

**Rozpoznat úmysl, ne jen formát.** Osnova od AI často vypadá jako nadpis a pod ním odrážky na stejném odsazení. Podle pouhého odsazení by to byly dvě „střední témata“; podle smyslu je nadpis střed mapy. Test na to pamatuje.

## 3. Příprava

- Hotová fáze 11 (napojení na AI).
- Rozmyslet si jeden svůj projekt, na kterém mapu vyzkoušíte.

## 4. Prompty krok za krokem

1. `Navrhni plán implementace fáze 12, zatím nic nepiš.` → Claude se zeptá: kde mapa bude a kam se ukládá, jak má vypadat, co s existujícím plánem při převodu, jakou délku a vazby dostanou činnosti → odpovědět a schválit plán.
2. Po každém kroku ověřit → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | formát mapy v projektu a úpravy uzlů (nejdřív testy) | `npm test` |
| 2 | rozložení mapy do dvou stran (nejdřív testy) | `npm test` |
| 3 | pohled Mapa, klávesnice, tlačítka, Zpět | Tab / Enter / psaní / Delete / šipky / mezerník |
| 4 | tažení uzlů, Alt+Shift+↑/↓ (+ barva % hotovo) | přetáhnout uzel, Esc, Ctrl+Z |
| 5 | Vytvořit plán z mapy | prázdný plán, Přidat na konec, Nahradit, Ctrl+Z |
| 6 | odsazený text ↔ mapa | osnova s odrážkami, chyba s číslem řádku |
| 7 | osnova v exportu pro AI, zadání v1.22, průvodce, README, audit | viz níže |

Užitečné doplňující prompty:
- `Napiš mi osnovu projektu <popis> jako odsazený seznam s odrážkami, nejvýš 3 úrovně.` (do chatu s AI – výsledek pak vložte tlačítkem **Vložit text…**)
- `Uzel <název> se mi v mapě kreslí přes jiný. Posílám screenshot. Proč a jak to opravit (s testem)?`

## 5. Jak ověřit výsledek

```powershell
npm test          # přes 660 testů
npm audit         # 0 vulnerabilities
npm run dev
```

1. Pohled **Mapa** → klik do mapy → **Tab** (nový uzel), napsat název, **Enter** → **Enter** (sourozenec) … postavit 3 větve s podřízenými.
2. Šipkami se pohybovat, **mezerníkem** sbalit větev (ukáže „+N“), přetáhnout uzel pod jiný, **Esc** během tažení, **Ctrl+Z**.
3. **Vytvořit plán z mapy** → náhled → **Vytvořit plán** → pohled Plán → doplnit délky a vazby; **Kontrola plánu** ukazuje, kde chybí.
4. Znovu **Vytvořit plán z mapy** → volba **Nahradit plán** → varování s počty → Ctrl+Z.
5. **Vložit text…** → vložit osnovu s odrážkami → náhled → **Nahradit mapu**; **Zkopírovat jako text** → vložit do Wordu.
6. Uložit projekt (Ctrl+S), zavřít, otevřít – mapa zůstala. Okno **AI** → export obsahuje oddíl „Myšlenková mapa“.
7. Tmavý vzhled → pohled Plán → výplň % hotovo je dobře vidět u činnosti, fáze i s Kritickou cestou.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Mapa je prázdná šedá plocha | `Pohled Mapa nic nekreslí. V konzoli je <chyba>. Okno má šířku <N> px.` |
| Klávesy v mapě nereagují | `V mapě nefunguje <klávesa>. Je fokus na mapě (rámeček)? Co se má stát?` |
| Osnova se načte se špatnými úrovněmi | `Vložil jsem tuto osnovu: <text>. Čekal jsem <strom>, vyšlo <strom>. Uprav převod a přidej test.` |

## 7. Uložení do Gitu

`Fáze 12 je ověřená. Udělej commit s popisem v češtině a pošli ho na GitHub.`

## 8. Kontrolní otázky / mini-úkol

1. Proč se z mapy vytvoří činnosti bez vazeb? Co by se stalo, kdyby je aplikace propojila „za sebou“?
2. Proč mapa nemá termíny ani náklady?
3. Kdy je lepší začít mapou a kdy rovnou šablonou nebo průvodcem?
4. **Mini-úkol:** nechte AI napsat osnovu vašeho projektu, vložte ji do mapy, upravte ji (přesuny, nové uzly) a vytvořte z ní plán. Doplňte délky a vazby tak, aby Kontrola plánu ukazovala ✓.
