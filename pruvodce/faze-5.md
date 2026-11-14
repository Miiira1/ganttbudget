# Fáze 5 – Ukládání, export a import → MVP 1.0

## 1. Cíl fáze

Projekt jde **uložit do souboru** (`název.ganttbudget.json`) a znovu otevřít. Aplikace si ho navíc
sama **zálohuje v prohlížeči**, takže po zavření a otevření prohlížeče je plán zpátky. Činnosti jde
**exportovat do Excelu nebo CSV**, upravit je tam a **naimportovat zpět**. Aplikace se
automaticky **nasazuje na GitHub Pages** – na veřejnou adresu, kterou můžete poslat komukoli.
Projekt jde také **přejmenovat** kliknutím na název v záhlaví. Tím je hotové **MVP 1.0**.

## 2. Co se naučíte z vibe codingu

**Nedůvěřovat datům zvenku.** Je to první fáze, kdy aplikace čte soubory, které nevytvořila sama.
Soubor může být poškozený, upravený ručně, z novější verze aplikace, nebo dokonce záměrně zlý
(např. buňka `=HYPERLINK(...)`, kterou by Excel spustil jako vzorec). Proto platí:

- každý soubor se před použitím ověří **schématem Zod** (popis, jak mají data vypadat),
- neplatná data se **nepoužijí ani částečně** – buď vše, nebo nic a srozumitelná hláška,
- při exportu dostane buňka začínající `=`, `+`, `-`, `@` na začátek apostrof (**CSV injection**),
- text ze souboru se zobrazí vždy jen jako text, nikdy jako HTML.

Druhá dovednost: **kontrola podle kritérií přijetí.** Na konci fáze Claude prošel kritéria MVP
ze zadání (kap. 12) jedno po druhém a našel tři mezery: projekt nešel přejmenovat, „přidávání
činností tažením v grafu“ neexistovalo a ukládání sbalených fází bylo slíbené na fázi 5.
Nic z toho tiše neopravil ani nevynechal – zeptal se. Výsledek: přejmenování se doplnilo hned,
zbylé dvě věci se v zadání v1.6 přesunuly do fáze 13.

Třetí dovednost: **nasazení a sdílení.** GitHub Actions po každém `git push` spustí testy,
sestaví web a zveřejní ho. Když testy selžou, nic se nezveřejní.

## 3. Příprava

- Hotová a commitnutá fáze 4c (a úpravy zoomu a šířky sloupců).
- Účet na GitHubu se skrytou e-mailovou adresou (`…@users.noreply.github.com`).
- Terminál ve složce projektu.

## 4. Prompty krok za krokem

1. `Navrhni plán implementace fáze 5, nic ještě nepiš.`
2. Odpovězte na otázky: knihovny pro CSV/XLSX (PapaParse a ExcelJS – **ne SheetJS**), obnova
   zálohy (sama / s dotazem), import (nahradit / přidat činnosti), kdo založí repozitář.
3. Plán schvalte. Pak po každém kroku: ověřit → `Ano, krok N`.

| Krok | Co přibude | Co ověřit |
|---|---|---|
| 1 | formát souboru + kontroly (testy předem) | `npm test` (v prohlížeči nic nového) |
| 2 | menu Soubor: Nový, Otevřít, Uložit, Uložit jako | uložit, změnit, „● neuloženo“, otevřít |
| 3 | automatická záloha v prohlížeči | zavřít a otevřít prohlížeč |
| 4 | export do XLSX a CSV (+ `npm audit`) | otevřít v Excelu, `=1+1` se nespustí |
| 5 | import z XLSX / CSV s náhledem a chybami | upravit v Excelu → import → Ctrl+Z |
| 6 | GitHub Actions + Dependabot, postup v README | založit repozitář, push, zapnout Pages |
| 7 | kritéria MVP, bezpečnost, průvodce, přejmenování projektu | celé kritérium 12 |

Užitečné doplňující prompty:
- `Co je CSV injection a proč ji musíme ošetřit?`
- `Proč se ExcelJS načítá až při prvním exportu?`
- `Projdi kritéria přijetí MVP ze zadání jedno po druhém a řekni, co chybí.`

## 5. Jak ověřit výsledek

```powershell
npm test          # mají projít všechny testy (přes 270)
npm audit         # 0 vulnerabilities
npm run dev       # pak otevřete http://localhost:5173
```

1. **Název:** klikněte na název projektu v záhlaví, přepište ho, Enter. Ctrl+Z ho vrátí.
2. **Uložit:** Soubor → Uložit (Ctrl+S). Změňte délku činnosti → v záhlaví „● neuloženo“.
   Zavřete záložku → prohlížeč varuje.
3. **Záloha:** zavřete prohlížeč, otevřete aplikaci znovu → modrá hláška „obnoveno ze zálohy“.
4. **Otevřít:** Soubor → Otevřít… uložený soubor → stejný plán. Zkuste otevřít obrázek nebo
   textový soubor → srozumitelná hláška, nic se nezmění.
5. **Export a import:** Soubor → Exportovat do Excelu → otevřít v Excelu, změnit délku → uložit →
   Soubor → Importovat z Excelu / CSV… → náhled → **Nahradit činnosti** → změna je v plánu.
   Ctrl+Z vrátí. Pokažený soubor (typ „Nesmysl“) → seznam chyb s čísly řádků, potvrdit nejde.
6. **Nasazení:** po `git push` v repozitáři záložka **Actions** zezelená a aplikace běží na
   `https://<uživatel>.github.io/ganttbudget/`.

## 6. Když se to rozbije

| Co vidíte | Co napsat Claude |
|---|---|
| Soubor nejde otevřít | `Soubor <název> nejde otevřít, hláška zní „<hláška>“. Soubor ti pošlu / popíšu, odkud je.` |
| Import hlásí chybu, kterou nechápu | `Import hlásí „Řádek 5: <hláška>“. V Excelu je na řádku 5 <obsah>. Co je špatně?` |
| Excel zobrazí místo WBS datum | Použijte XLSX místo CSV, nebo: `Excel v CSV mění „1.2“ na datum. Co s tím?` |
| Actions na GitHubu svítí červeně | Klikněte na běh, rozbalte červený krok a pošlete text: `GitHub Actions selhaly v kroku <krok>: <chyba>` |
| Pages ukazují prázdnou stránku | `Na adrese <adresa> je prázdná stránka. V konzoli prohlížeče (F12) je <chyba>.` |

## 7. Uložení do Gitu

`Fáze 5 je ověřená. Udělej commit s popisem v češtině.`

Pak (jen jednou) propojení s GitHubem – Claude ukáže příkazy a pošle kód až s vaším souhlasem:
`Repozitář ganttbudget je založený. Propoj ho a pošli tam kód.`

## 8. Kontrolní otázky / mini-úkol

1. Proč aplikace při chybném importu nepoužije aspoň ty řádky, které jsou v pořádku?
2. Co by se mohlo stát, kdyby export nepřidal apostrof před buňku `=HYPERLINK(...)`?
3. Kde jsou vaše data, když používáte aplikaci na adrese GitHub Pages? Posílá je někam?
4. **Mini-úkol:** exportujte vzorový projekt do Excelu, přidejte tam novou fázi se dvěma
   činnostmi (sloupec Úroveň 1 a 2) a vazbu `3SS+2`, naimportujte a zkontrolujte graf.
