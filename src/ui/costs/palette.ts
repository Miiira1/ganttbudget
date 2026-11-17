/**
 * Barvy úseků skládaných sloupců v pohledu Náklady – odstíny značky MiRo project
 * (tyrkysová, žlutá, zlatá, grafit, šedá), zvlášť pro světlý a tmavý vzhled.
 * Pořadí střídá tmavé a světlé tóny, aby se sousední úseky dobře odlišily.
 * Barva patří skupině podle jejího pořadí (kategorie v databázi, fáze v plánu, druh), takže
 * se při filtrování nemění. Víc než 10 skupin barvy zopakuje – rozliší je bublina a legenda.
 */
export interface SeriesColor {
  /** Výplň úseku v SVG. */
  fill: string
  /** Čtvereček v legendě a u řádku tabulky. */
  swatch: string
  /** Barva čáry (čárový graf). */
  stroke: string
}

export const SERIES_COLORS: readonly SeriesColor[] = [
  { fill: 'fill-[#08708c] dark:fill-[#3bdaff]', swatch: 'bg-[#08708c] dark:bg-[#3bdaff]', stroke: 'stroke-[#08708c] dark:stroke-[#3bdaff]' }, // tyrkysová
  { fill: 'fill-[#ffc000] dark:fill-[#ffc000]', swatch: 'bg-[#ffc000] dark:bg-[#ffc000]', stroke: 'stroke-[#ffc000] dark:stroke-[#ffc000]' }, // žlutá
  { fill: 'fill-[#4a4a47] dark:fill-[#b2b1ab]', swatch: 'bg-[#4a4a47] dark:bg-[#b2b1ab]', stroke: 'stroke-[#4a4a47] dark:stroke-[#b2b1ab]' }, // grafit / světle šedá
  { fill: 'fill-[#3bdaff] dark:fill-[#0b6b85]', swatch: 'bg-[#3bdaff] dark:bg-[#0b6b85]', stroke: 'stroke-[#3bdaff] dark:stroke-[#0b6b85]' }, // jasná / tmavá tyrkysová
  { fill: 'fill-[#b38600] dark:fill-[#d9a400]', swatch: 'bg-[#b38600] dark:bg-[#d9a400]', stroke: 'stroke-[#b38600] dark:stroke-[#d9a400]' }, // zlatá
  { fill: 'fill-[#a5ecff] dark:fill-[#1f5868]', swatch: 'bg-[#a5ecff] dark:bg-[#1f5868]', stroke: 'stroke-[#a5ecff] dark:stroke-[#1f5868]' }, // světlá tyrkysová
  { fill: 'fill-[#262626] dark:fill-[#f6f5f0]', swatch: 'bg-[#262626] dark:bg-[#f6f5f0]', stroke: 'stroke-[#262626] dark:stroke-[#f6f5f0]' }, // grafit / papír
  { fill: 'fill-[#ffe699] dark:fill-[#8a6a00]', swatch: 'bg-[#ffe699] dark:bg-[#8a6a00]', stroke: 'stroke-[#ffe699] dark:stroke-[#8a6a00]' }, // světle žlutá / tmavé zlato
  { fill: 'fill-[#8a8a85] dark:fill-[#6a6a66]', swatch: 'bg-[#8a8a85] dark:bg-[#6a6a66]', stroke: 'stroke-[#8a8a85] dark:stroke-[#6a6a66]' }, // šedá
  { fill: 'fill-[#d9d8d2] dark:fill-[#4a4a47]', swatch: 'bg-[#d9d8d2] dark:bg-[#4a4a47]', stroke: 'stroke-[#d9d8d2] dark:stroke-[#4a4a47]' }, // světle šedá
]

export const seriesColor = (index: number): SeriesColor => SERIES_COLORS[((index % SERIES_COLORS.length) + SERIES_COLORS.length) % SERIES_COLORS.length]!
