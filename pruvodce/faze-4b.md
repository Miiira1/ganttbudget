# Fáze 4b – Tažení v grafu a klávesové zkratky

## 1. Cíl fáze

Termíny jde měnit přímo v grafu: táhnout celou úsečku (posun), její levý okraj (začátek)
nebo pravý okraj (konec). Pohyb se přichytává na pracovní dny. Posunutá činnost dostane
omezení „začít nejdříve k datu“ (ikona 📌). Začátek a Konec jde zadat i v tabulce.
Přibyly klávesové zkratky (Ctrl+Enter, Ctrl+D, Ctrl+Delete) a jejich přehled (F1).

## 2. Co se naučíte z vibe codingu

**Měřit výkon dřív, než začne bolet.** Před tažením Claude změřil, jak rychle reaguje tabulka
s 300 řádky (výběr řádku 158 ms). Příčina: každý řádek se překresloval při každé změně.
Po úpravě (řádek se překreslí, jen když se změní jeho údaje) trvá výběr 9 ms. Při měření
je důležité vědět, co ho zkresluje: vývojový režim (`npm run dev`) je pomalejší než hotová
aplikace (`npm run build` + `npm run preview`) a skrytá karta prohlížeče se nepřekresluje vůbec.

Druhá dovednost: **popsat vzhled slovy a nechat si ho upravit.** Ikony kalendáříku byly moc
výrazné („šedivé, lehce průhledné“), v tmavém režimu pak neviditelné („světlejší modrá, která
po najetí myší zesvětlá“). Šipky do milníků nedosedaly na špičku. Stačilo popsat, co vidím
a co chci – Claude k tomu napsal i testy, aby se oprava později nerozbila.

## 3. Příprava

- Hotová a commitnutá fáze 4a.
- Terminál ve složce projektu, `npm run dev` běží, panel prohlížeče je vidět.

## 4. Prompty krok za krokem

1. `Navrhni plán implementace fáze 4b, nic ještě nepiš.`
2. Odpovězte na otázky (levý okraj, tažení fází, Začátek/Konec v tabulce) a projděte
   **pravidla** posunu, okrajů a omezení. Rozmyslete si zkratky (Ctrl+D v prohlížeči jinak přidá záložku).
3. Plán schvalte. Pak po každém kroku: ověřit → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | omezení v jádře, výpočty tažení, duplikování + testy | `npm test` |
| 2 | zrychlení tabulky | měření s 300 řádky (výběr, sbalení, úprava) |
| 3 | tažení úseček (posun, okraje, náhled, Esc) | přichycení na pracovní dny, „drží vazba“ |
| 4 | ikona 📌 a omezení v bublině | kliknutí na 📌 omezení zruší |
| 5 | Začátek a Konec v tabulce | konec před začátkem → hláška |
| 6 | Ctrl+Enter, Ctrl+D, Ctrl+Delete, F1 / ⌨ Zkratky | přehled zkratek |
| 7 | ověření výkonu, průvodce | viz níže |

Užitečné doplňující prompty:
- `Proč se úsečka po puštění vrátila zpátky? Vysvětli mi omezení „začít nejdříve“ a vazby na příkladu.`
- `Uprav vzhled <čeho>: teď vidím <popis>, chci <popis>.` (+ screenshot)

## 5. Jak ověřit výsledek

```powershell
npm test          # mají projít všechny testy (téměř 200)
npm run dev       # pak otevřete http://localhost:5173
```

V prohlížeči klikněte na **Vzorový projekt** (graf na měřítku Týdny):

1. Táhněte úsečku činnosti doprava → přichytí se na pracovní den (ne na víkend ani svátek),
   navazující činnosti se posunou, u názvu se objeví 📌. **Ctrl+Z** vrátí celé tažení.
2. Najeďte na okraj úsečky (kurzor ↔): pravý okraj mění konec (délku), levý začátek
   (konec zůstane). Během tažení ukazuje bublina nová data, **Esc** tažení zruší.
3. Táhněte „Studii proveditelnosti“ doleva přes konec „Analýzy“ → vrátí se k vazbě a nahoře
   se objeví vysvětlení. Ikona 📌 je bledší.
4. Klikněte na 📌 → omezení zmizí a činnost se vrátí tam, kam ji pustí vazby.
5. Fázi táhnout nejde (bublina vysvětlí proč). Šipky do milníků vedou do jejich špičky.
6. V tabulce změňte Začátek (objeví se 📌) a Konec (změní se délka); zkuste konec před začátkem.
7. Klikněte do řádku: **Ctrl+Enter** (nová činnost pod něj), **Ctrl+D** (kopie, u fáze i s činnostmi),
   **Esc** a pak **Ctrl+Delete** (smazat). **F1** nebo **⌨ Zkratky** otevře přehled.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Úsečka se přichytí na špatný den | `Táhl jsem činnost z <datum> o <N> dní, skončila na <datum>, čekal jsem <datum>. Napiš na to test v drag.test.ts a oprav to.` |
| Úsečka se po puštění vrátí, i když vazbu nemá | `Činnost na řádku N se po tažení vrátí na <datum>. Nemá předchůdce. Co ji drží?` |
| Graf nebo tabulka reagují pomalu | `S <počet> řádky trvá <akce> dlouho. Změř to na produkční verzi (npm run build, npm run preview) a navrhni zrychlení.` |
| Zkratka dělá něco jiného (např. přidá záložku) | `Ctrl+<klávesa> v prohlížeči <název> dělá <co>. Navrhni jinou zkratku.` |
| Ikona nebo šipka nevypadá dobře | Pošlete screenshot: `Tady <co> vypadá <jak>. Chci, aby <jak>.` |

## 7. Uložení do Gitu

`Fáze 4b je ověřená. Udělej commit s popisem v češtině.`

## 8. Kontrolní otázky / mini-úkol

1. Co je omezení „začít nejdříve k datu“ a proč ho posun úsečky nastaví?
2. Proč může zůstat úsečka „přilepená“ k vazbě, i když jsem ji táhl dřív?
3. Proč se během tažení projekt nemění a zapíše se až po puštění? (Nápověda: Zpět a výkon.)
4. **Mini-úkol:** požádejte Claude o test „posun činnosti přes Vánoce s odstávkou 21.–31. 12.“.
   Nejdřív si v kalendáři spočítejte, kde má činnost začít a skončit.
