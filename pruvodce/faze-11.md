# Fáze 11 – Napojení na AI

## 1. Cíl fáze

Aplikace spolupracuje s chatovou AI (ChatGPT, Claude) **bez serveru a bez API klíčů**: připraví text ke zkopírování a přijme vloženou odpověď. Nic se neposílá samo – data opustí počítač, až když je uživatel sám vloží do AI.

- **Tlačítko AI** (ikona čtyřcípé hvězdičky) v liště otevře okno se dvěma kartami:
  - **Zkopírovat projekt pro AI** – celý projekt jako Markdown (přehled, tabulka plánu, rozpočet, zdroje, varování, Earned Value) a na konci otázka. Pět přednastavených otázek, vlastní otázka, náhled textu. Jména pracovníků a sazby jsou ve výchozím stavu vynechané.
  - **Vytvořit plán s AI** – popíšete projekt vlastními slovy, aplikace z toho udělá prompt, vy ho vložíte do AI a odpověď zpět. Aplikace ji zkontroluje, ukáže náhled a vytvoří nový projekt s plánem a hrubým rozpočtem.
- Když odpověď AI neprojde kontrolou, aplikace vypíše chyby srozumitelně a nabídne **prompt na opravu**.
- Plán s AI je i jako volba v okně **Nový projekt**.

| Pojem | Co znamená |
|---|---|
| prompt | zadání pro AI – text, který vložíte do chatu |
| JSON | strojově čitelný zápis dat; AI v něm vrací plán |
| Markdown | prostý text s nadpisy (`#`) a tabulkami (`|`), dobře čitelný pro člověka i AI |
| schránka | místo v počítači, kam se ukládá zkopírovaný text (Ctrl+C / Ctrl+V) |

## 2. Co se naučíte z vibe codingu

**AI je nespolehlivý dodavatel dat – ověřujte všechno.** Odpověď AI se nikdy nepoužije „jak je“. Aplikace ji čte jen jako data (`JSON.parse`, nikdy jako kód), ověří schématem Zod, zkontroluje vazby, strom i kruhy a nakonec stejnou kontrolou jako soubor projektu. Při jakékoli chybě nevznikne nic – ani část projektu.

**Chyba má mít dvě podoby.** Pro člověka věta „Položka č. 3 (B): předchůdce „Z“ neexistuje.“, pro AI navíc technický detail. Prompt na opravu tak AI dostane přesně to, co potřebuje, a uživatel nevidí nic, čemu by nerozuměl.

**Příklad v promptu je kód – testujte ho.** AI nejvíc napodobuje příklad. Test proto ověřuje, že příklad formátu uvnitř promptu sám projde kontrolou. Kdyby ho někdo při úpravě textů rozbil, test spadne dřív, než AI začne vracet chybné odpovědi.

**Soukromí je výchozí nastavení, ne dodatečná volba.** Jména a mzdy jsou osobní údaje. Export je bez nich, dokud je uživatel vědomě nezaškrtne; test ověřuje, že se v textu neobjeví ani jedno jméno ze vzorového projektu.

**Ověření ve skutečném světě dělá člověk.** Claude Code nemůže psát do ChatGPT. Krok 5 proto udělal uživatel: zkusil prompt v obou AI a v obou jazycích. Výsledky potvrdily, že další úpravy nejsou potřeba – i to je výsledek.

**Malá vizuální změna = malý krok.** Výměna emoji 🤖 za vlastní ikonu hvězdičky proběhla jako samostatná úprava ve stejném stylu jako ostatní ikony (SVG, barva textu, světlejší vedlejší prvek).

## 3. Příprava

- Hotová fáze 10 (učení a přívětivost).
- Účet v ChatGPT nebo Claude (stačí bezplatný).

## 4. Prompty krok za krokem

1. `Navrhni plán implementace fáze 11, zatím nic nepiš.` → Claude se zeptá: co má AI vracet, co se stane s výsledkem, jak naložit se jmény a mzdami, kde budou funkce v aplikaci → odpovědět a schválit plán.
2. Po každém kroku ověřit → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | formát „AI plán“ a převod na projekt (nejdřív testy) | `npm test` |
| 2 | prompty, texty chyb, export do Markdownu (nejdřív testy) | `npm test` |
| 3 | tlačítko AI a karta Zkopírovat projekt pro AI | vzorový projekt → bez jmen → Zkopírovat → vložit do AI |
| 4 | karta Vytvořit plán s AI, volba v okně Nový projekt | ukázková odpověď s chybou a bez chyby |
| 5 | zkouška se skutečnou AI (dělá uživatel) | ChatGPT / Claude, česky i anglicky |
| 6 | zadání v1.20, průvodce, README, audit | viz níže |

Užitečné doplňující prompty:
- `AI mi vrátila tuto odpověď a aplikace hlásí „<chyba>“. Proč? Má se upravit prompt, nebo kontrola?`
- `Přidej do exportu pro AI ještě <údaj>. Nejdřív navrhni, kam, a dej pozor na osobní údaje.`
- `Navrhni šestou přednastavenou otázku pro AI k <téma>.`

## 5. Jak ověřit výsledek

```powershell
npm test          # přes 620 testů
npm audit         # 0 vulnerabilities
npm run dev
```

1. **Vzorový projekt** → **AI** → karta **Zkopírovat projekt pro AI**: v náhledu nejsou jména lidí. Zaškrtnout jména a sazby → objeví se. **Zkopírovat** → vložit do ChatGPT / Claude.
2. Karta **Vytvořit plán s AI**: název, popis (např. „Zavedení svařovacího robota do výroby rámů“) → **Zkopírovat prompt** → vložit do AI → odpověď zkopírovat celou zpět → **Zkontrolovat** → náhled → **Vytvořit projekt** → Kontrola plánu → Ctrl+Z.
3. Do pole odpovědi vložit nesmysl (např. „Ahoj“) → hláška „V textu není žádný plán…“. V JSON změnit id předchůdce na neexistující → chyba s číslem položky → **Zkopírovat prompt na opravu**.
4. **Soubor → Nový projekt… → Plán s pomocí AI → Pokračovat** otevře rovnou kartu plánu.
5. Přepnout jazyk na angličtinu → prompt i export jsou anglicky.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Aplikace hlásí neplatný JSON, ale odpověď vypadá v pořádku | `Odpověď AI je v příloze, aplikace hlásí „<chyba>“. Najdi, co v JSON vadí, a navrhni, zda to má kontrola tolerovat.` |
| AI pořád dělá stejnou chybu i po promptu na opravu | `AI opakovaně <chyba>. Uprav pravidla v promptu (cs i en) tak, aby tomu předešla, a doplň test.` |
| Tlačítko Zkopírovat nic nezkopíruje | `Zkopírovat v prohlížeči <název> hlásí „<text>“. Funguje Ctrl+C z označeného textu?` |

## 7. Uložení do Gitu

`Fáze 11 je ověřená. Udělej commit s popisem v češtině a pošli ho na GitHub.`

## 8. Kontrolní otázky / mini-úkol

1. Proč aplikace nevolá AI přímo (přes API), ale nechává uživatele text kopírovat?
2. Proč se ID položek z odpovědi AI nepřenášejí do projektu?
3. Kdy je v pořádku zaškrtnout „Zahrnout jména pracovníků a sazby“ a kdy ne?
4. **Mini-úkol:** nechte AI vytvořit plán stejného projektu dvakrát (dva chaty). Porovnejte délku a rozpočet obou plánů. Co z toho plyne pro důvěru ve výstupy AI?
