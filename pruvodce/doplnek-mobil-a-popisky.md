# Doplněk po fázi 13 – Mobilní verze a popisky u úseček

## 1. Cíl

**Mobilní verze (jen prohlížení).** Na telefonu (displej užší než 768 px) se aplikace sama přepne do zjednodušené
podoby pro **prohlížení** hotového projektu – třeba na poradě nebo na stavbě:

- úzké záhlaví se symbolem loga, názvem a termíny projektu, ⚙ (jazyk, vzhled) a menu **⋯**
  (Otevřít projekt, Vzorový projekt, Slovníček, Kde jsou moje data, Plná verze),
- dole lišta pěti pohledů: **Plán, Náklady, Sledování, Analýza, Mapa**,
- **Plán** jako seznam karet po fázích (klepnutím detail), nebo jako **Gantt** posouvatelný prstem,
- ostatní pohledy bez upravovacích prvků, nastavení sbalené, čísla hned vidět.

Projekt se do telefonu dostane **otevřením souboru** `.ganttbudget.json` (např. z cloudového disku) – aplikace
nic neposílá na server, takže se plán z počítače sám nepřenese. Pro výjimečnou úpravu je v menu ⋯ **Plná verze**.

**Popisky vedle úseček.** V plné verzi má lišta plánu tlačítko **„Popisky ▾“**: zaškrtnete, co se má ukázat
vedle úseček – Název, Termín, Délka, % hotovo, Náklady. Stejné popisky jsou i v exportu obrázku a PDF.

## 2. Co se naučíte z vibe codingu

**Plán podle tří otázek.** Než vznikl kód, rozhodli jste: které pohledy na telefonu (Plán, Náklady, Sledování,
Analýza, Mapa), jak má vypadat plán (seznam karet + Gantt) a jestli půjde přepnout na plnou verzi (ano).
Tím byla jasná práce na pět kroků M1–M5.

**Jedno místo pro „jen čtení“.** Místo úprav v každém tlačítku zvlášť vznikl sdílený přepínač „jen pro čtení“
(React context). Mobilní obal ho zapne a pohledy podle něj skryjí upravovací prvky; u mapy jsou úpravy
zablokované přímo ve funkcích, takže nejdou ani klávesou nebo dvojklikem.

**Znovupoužití místo nového kódu.** Gantt na telefonu kreslí stejná funkce jako export obrázku – jen v úsporné
variantě bez tabulky. Při tom se ukázalo, že export kreslil víkendy i v měřítku Měsíce jako husté pruhy;
oprava pomohla i exportu na počítači.

**Nový požadavek uprostřed práce.** Popisky u úseček přišly, když byla hotová jen kostra mobilní verze. Claude
krok M1 dokončil, popisky naplánoval zvlášť, udělal je a pak pokračoval krokem M2 – nic se nepromíchalo.

**Testovat i na „prst“.** Audit na emulovaném telefonu našel malé ikonky ⓘ (20 px) – na dotykovém displeji mají
teď 28 px – a Slovníček, který šel zavřít jen tlačítkem úplně dole.

## 3. Prompty

| Krok | Co přibude | Co ověřit |
|---|---|---|
| M1 | kostra mobilní verze: záhlaví, menu ⋯, spodní lišta, Plná verze | zúžit okno pod 768 px |
| – | popisky vedle úseček (nejdřív testy) | Popisky ▾ → zaškrtnout Délku a % hotovo |
| M2 | Plán jako seznam karet (nejdřív testy) | klepnout na kartu, sbalit fázi |
| M3 | Gantt na telefonu, přepínač Seznam / Gantt | posunout diagram prstem |
| M4 | Náklady, Sledování, Analýza, Mapa jen k prohlížení | v Mapě nejde nic změnit |
| M5 | doladění, audit, dokumentace | Slovníček zavřít ✕ nahoře |

## 4. Jak ověřit výsledek

1. Otevřete aplikaci na telefonu (nebo v prohlížeči zužte okno pod 768 px).
2. **⋯ → Vzorový projekt** → v Plánu klepněte na kartu činnosti → rozbalí se detail; klepněte na fázi → sbalí se.
3. Přepněte **Gantt** a posuňte diagram prstem do strany; zkuste měřítko Čtvrtletí.
4. Projděte **Náklady, Sledování, Analýza, Mapa** – nikde nejde nic změnit.
5. **⋯ → Plná verze (úpravy)** → běžné rozhraní; zpět přes **Nápověda → Mobilní verze**.
6. Na počítači: **Popisky ▾** → zaškrtněte Délku a % hotovo → **Soubor → Exportovat → Gantt jako PNG**.

## 5. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Na telefonu se něco nevejde nebo přetéká | `Na telefonu <model, prohlížeč> v pohledu <pohled> přetéká <co>. Posílám screenshot.` |
| Popisky se překrývají se šipkami nebo úsečkami | `Popisky u úseček se v měřítku <měřítko> překrývají s <co>. Posílám screenshot.` |

## 6. Kontrolní otázky

1. Proč se projekt do telefonu nepřenese sám a co musíte udělat?
2. Proč je dobré mít „jen pro čtení“ na jednom místě, a ne v každém tlačítku zvlášť?
3. **Mini-úkol:** uložte svůj projekt do souboru, otevřete ho na telefonu a najděte činnost s nejmenší rezervou.
