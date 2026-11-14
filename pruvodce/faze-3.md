# Fáze 3 – Ganttův graf

## 1. Cíl fáze

Vedle tabulky se objeví Ganttův diagram: každá činnost má na svém řádku úsečku, milník je
kosočtverec a vazby jsou šipky. Časová osa jde přepínat (Dny / Týdny / Měsíce / Čtvrtletí),
víkendy, svátky, odstávky a dnešek jsou vyznačené. Graf se zatím jen **zobrazuje** – tažení
úseček přijde ve fázi 4b.

## 2. Co se naučíte z vibe codingu

**Iterace nad vizuálním výsledkem.** U grafu nestačí, že testy projdou – musíte se podívat.
Fáze proto běžela v šesti malých krocích a po každém přišlo ověření v prohlížeči
(rozdělené okno → osa → úsečky → šipky → doladění). Popisujte Claude, **co vidíte a co chcete**:
„šipka mezi řádky 2 a 3 dělá zbytečnou kličku, chci ji rovně dolů“.

Druhá dovednost: **měřit, ne odhadovat.** Při kontrole výkonu s 300 činnostmi se ukázalo, že
graf je pomalý. Měření našlo konkrétní příčinu (opakované vytváření formátovače data)
a jedna malá oprava graf zrychlila 3–4×. Dobré je také vědět, co měření zkresluje
(vývojový režim, skrytá karta prohlížeče).

## 3. Příprava

- Hotová a commitnutá fáze 2.
- Terminál ve složce projektu, `npm run dev` běží.

## 4. Prompty krok za krokem

1. `Přečti si ZADANI.md a CLAUDE.md a podívej se na stav projektu. Navrhni plán implementace fáze 3, nic ještě nepiš.`
2. Odpovězte na otázky (sloupce tabulky, odlišení volných dnů, pamatování zoomu) a projděte
   **pravidla kreslení** v plánu (kde leží milník, kudy vede šipka). Nesouhlas řekněte teď.
3. Plán schvalte. Pak po každém kroku: ověřit v prohlížeči → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | výpočty osy a geometrie + testy | `npm test` (v prohlížeči nic nového) |
| 2 | rozdělené okno, oddělovač, společný posun | řádky tabulky a grafu lícují |
| 3 | hlavička osy, zoom, volné dny, dnešek | bubliny svátků, přepínání měřítka |
| 4 | úsečky a milníky | úsečky na správných řádcích a dnech |
| 5 | šipky vazeb | šipky bez zbytečných kliček, bubliny |
| 6 | výkon, přístupnost, průvodce | viz níže |

Užitečné doplňující prompty:
- `Vysvětli mi, proč má hlavička tabulky stejnou výšku jako hlavička grafu.`
- `Ukaž mi test, který kontroluje trasu šipky, a nakresli mi ho jako obrázek z čárek.`

## 5. Jak ověřit výsledek

```powershell
npm test          # mají projít všechny testy (přes 120)
npm run dev       # pak otevřete http://localhost:5173
```

V prohlížeči klikněte na **Vzorový projekt**:

1. Vpravo je graf. Úsečka každé činnosti je na stejném řádku jako v tabulce; kolečko myši
   posouvá tabulku i graf zároveň.
2. Oddělovač mezi tabulkou a grafem jde táhnout myší i šipkami (po kliknutí na něj).
   Po obnovení stránky (F5) zůstane na místě.
3. Přepínač **Dny / Týdny / Měsíce / Čtvrtletí** mění osu a při přepnutí zůstanete
   na stejném datu. Volba přežije obnovení stránky.
4. Víkendy jsou šedé, svátky žluté šrafované (najeďte myší – 17. 11. ukáže
   „Den boje za svobodu a demokracii“), dnešek je červená čára.
5. **Kalendář** → přidejte odstávku 21. 12. – 31. 12. → v grafu fialový šrafovaný pruh
   s názvem v bublině a činnosti přes Vánoce se protáhnou.
6. Milníky jsou kosočtverce, mezi navázanými činnostmi vedou šipky. Bublina šipky ukáže
   i prodlevu („prodleva 5 pracovních dní“).
7. Prodlužte řádek 2 z 10 na 20 dní → úsečky i šipky se posunou. Ctrl+Z (mimo pole) vrátí.
8. Přepněte do angličtiny a do tmavého režimu – hlavička osy je anglicky, graf čitelný.

Fáze (souhrnné řádky) zatím **nemají úsečku**: nemají ještě žádné podřízené činnosti,
takže nemají termín. Zařazování činností do fází přijde ve fázi 4a.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Řádky tabulky a grafu se postupně rozjíždějí | `Na řádku 20 je úsečka o kus níž než řádek v tabulce. Změř výšku řádků v tabulce i v grafu a oprav to.` |
| Šipka vede divně (klička, přes jiné úsečky) | Pošlete screenshot: `Šipka z řádku 5 na řádek 6 vypadá takhle. Chci, aby vedla … Napiš na to nejdřív test.` |
| Po přepnutí zoomu skočí graf jinam | `Po přepnutí z Dnů na Měsíce nevidím stejné datum. Mělo by zůstat <datum> u levého okraje.` |
| Graf je s velkým plánem pomalý | `Graf s 300 činnostmi reaguje pomalu. Změř, co trvá nejdéle (v produkční verzi: npm run build a npm run preview), a navrhni opravu.` |
| V konzoli je červená chyba po úpravě kódu | Obnovte stránku (F5). Pokud chyba zůstane, vložte ji Claude doslova. |

## 7. Uložení do Gitu

`Fáze 3 je ověřená. Udělej commit s popisem v češtině.`

## 8. Kontrolní otázky / mini-úkol

1. Proč se výpočty polohy úseček a šipek píšou jako čisté funkce mimo React?
2. Proč graf neukazuje víkendy v měřítku Měsíce a Čtvrtletí?
3. Proč jsou svátky kromě barvy odlišené i šrafováním?
4. **Mini-úkol:** u řádku 5 vzorového projektu napište do Předchůdců `3-3` (předstih 3 dny).
   Nejdřív si na papír nakreslete, kudy by měla vést šipka, a pak porovnejte s grafem.
   Pak se Claude zeptejte: `Kdy jde šipka svisle do úsečky a kdy oklikou? Ukaž mi to v testech.`
