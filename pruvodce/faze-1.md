# Fáze 1 – Kostra a tabulka činností

## 1. Cíl fáze

Na konci fáze se aplikace spustí v prohlížeči a ukáže tabulku činností. Činnosti jde přidávat,
upravovat a mazat, chybu vrátit tlačítkem Zpět (Ctrl+Z), přepnout češtinu/angličtinu
a světlý/tmavý vzhled. Termíny se zatím nepočítají (ukazují „—“) a nic se neukládá.

## 2. Co se naučíte z vibe codingu

**Plán před kódem.** Claude nejdřív v režimu plánování přečte zadání, shrne ho a navrhne
postup. Teprve po vašem schválení píše kód. Nejasnosti řeší otázkami, ne odhadem
(v této fázi: co mají ukazovat sloupce s termíny, jestli má být Zpět vidět už teď, jak velký
má být vzorový projekt).

## 3. Příprava

- Hotová fáze 0: Node.js, Git, VS Code, Claude Code, složka projektu se `ZADANI.md` a `CLAUDE.md`.
- Claude Code otevřený **ve složce projektu** (pozor, ať neběží v jiné složce – soubory pak „nenajde“).

## 4. Prompty krok za krokem

1. *(v režimu plánování)*
   `Přečti si ZADANI.md a CLAUDE.md. Dokonči Fázi 0: shrň zadání vlastními slovy a navrhni plán Fáze 1. Zatím nic nepiš.`
2. Odpovězte na doplňující otázky a plán schvalte.
3. `Ano, začni.` – Claude založí Git, napíše kostru, nainstaluje knihovny, napíše testy a tabulku.

Pokud chcete menší kroky, požádejte o ně jednotlivě, např.:
`Udělej jen krok 2 plánu (kostru projektu) a řekni mi, jak to ověřím.`

## 5. Jak ověřit výsledek

V terminálu ve složce projektu:

```powershell
npm test          # mají projít všechny testy (zelené „passed“)
npm run dev       # pak otevřete http://localhost:5173
```

V prohlížeči zkontrolujte:

1. Prázdný projekt ukáže výzvu „Projekt je zatím prázdný“.
2. **Přidat činnost** → kurzor je rovnou v názvu, napište název a stiskněte Enter.
3. Změňte délku a % hotovo. Do % napište 150 → uloží se 100.
4. Změňte typ na **Milník** → délka se nastaví na 0 a nejde měnit; u názvu je ◆.
5. Klikněte jinam (mimo pole) a stiskněte **Ctrl+Z** → změna se vrátí, **Ctrl+Y** → znovu se provede.
6. Smažte řádek křížkem → aplikace se zeptá; po smazání jde vrátit přes Zpět.
7. **Vzorový projekt** → zobrazí se 28 řádků; pokud už něco v plánu je, aplikace nejdřív varuje.
8. Přepněte **Jazyk** na English → přeloží se všechno. Obnovte stránku (F5) → jazyk zůstane.
9. Přepněte **Vzhled** Světlý / Tmavý / Podle systému.
10. Bezpečnostní pravidla: `npm run build`, pak `npm run preview` a otevřete http://localhost:4173.
    Stiskněte F12 → záložka Console nesmí hlásit chyby „Content Security Policy“.

Po obnovení stránky plán zmizí – ukládání přijde ve fázi 5. To je v pořádku.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Červený text v terminálu po `npm run dev` nebo `npm run build` | `Spustil jsem npm run build a vypsala se tato chyba: <vložte celý text>. Vysvětli, co znamená, a oprav ji.` |
| Prázdná bílá stránka | Stiskněte F12 → Console, zkopírujte červené řádky: `Stránka je prázdná, v konzoli je: <text>.` |
| Test neprošel | `npm test hlásí chybu v testu „<název>“: <text>. Je chyba v testu, nebo v kódu? Nejdřív vysvětli, pak oprav.` |
| Něco vypadá jinak, než chcete | Pošlete screenshot: `Na obrázku je tabulka. Sloupec Typ je moc úzký, chci ho širší.` |
| Claude nenašel soubory zadání | Zkontrolujte, že Claude Code běží ve složce projektu, a napište cestu ke složce. |

## 7. Uložení do Gitu

Po ověření napište Claude:
`Fáze 1 je ověřená. Udělej commit s popisem v češtině.`

Nebo sami v terminálu:

```powershell
git add .
git commit -m "Fáze 1: kostra aplikace a tabulka činností"
```

## 8. Kontrolní otázky / mini-úkol

1. Proč se změna názvu zapíše do historie až po opuštění pole, a ne po každém písmenu?
2. Kde v projektu najdete text tlačítka „Přidat činnost“? Proč tam a ne přímo v kódu?
3. K čemu slouží schéma Zod a co by se stalo bez něj při načtení poškozeného souboru?
4. **Mini-úkol:** požádejte Claude, ať přidá do patičky odkaz na zadání. Ověřte, že text odkazu
   je v obou překladových souborech a že `npm test` pořád projde.
