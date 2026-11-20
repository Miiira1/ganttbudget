/**
 * Barvy úseků skládaných sloupců v pohledu Náklady – odstíny značky MiRo project
 * (tyrkysová, žlutá, zlatá, grafit, šedá), zvlášť pro světlý a tmavý vzhled.
 * Pořadí střídá tmavé a světlé tóny, aby se sousední úseky dobře odlišily.
 * Barva patří skupině podle jejího pořadí (kategorie v databázi, fáze v plánu, druh), takže
 * se při filtrování nemění. Víc než 10 skupin barvy zopakuje – rozliší je bublina a legenda.
 *
 * Obrys (audit U4): barvy, které mají proti pozadí méně než 3 : 1 (značková žlutá a jasná
 * tyrkysová, bledé tóny; v tmavém vzhledu tmavé tóny), dostanou tenký obrys v tmavším /
 * světlejším odstínu téže barvy – tvar úseku je pak vidět i na bílé. Barvy značky zůstávají.
 * Kontrolu dělá palette.test.ts.
 */
export interface SeriesColor {
  /** Výplň úseku v SVG. */
  fill: string
  /** Obrys úseku (stroke) u barev se slabým kontrastem k pozadí; jinak bez obrysu. */
  edge: string
  /** Čtvereček v legendě a u řádku tabulky (u slabých barev s obrysem ring). */
  swatch: string
  /** Barva čáry (čárový graf). */
  stroke: string
}

const NO_EDGE = 'stroke-none'

export const SERIES_COLORS: readonly SeriesColor[] = [
  // tyrkysová
  { fill: 'fill-[#0e7490] dark:fill-[#3bdaff]', edge: NO_EDGE, swatch: 'bg-[#0e7490] dark:bg-[#3bdaff]', stroke: 'stroke-[#0e7490] dark:stroke-[#3bdaff]' },
  // žlutá (ve světlém vzhledu obrys tmavým zlatem)
  {
    fill: 'fill-[#ffc000] dark:fill-[#ffc000]',
    edge: 'stroke-[#8f6b00] dark:stroke-none',
    swatch: 'bg-[#ffc000] dark:bg-[#ffc000] ring-1 ring-inset ring-[#8f6b00] dark:ring-0',
    stroke: 'stroke-[#ffc000] dark:stroke-[#ffc000]',
  },
  // grafit / světle šedá
  { fill: 'fill-[#4a4a47] dark:fill-[#b2b1ab]', edge: NO_EDGE, swatch: 'bg-[#4a4a47] dark:bg-[#b2b1ab]', stroke: 'stroke-[#4a4a47] dark:stroke-[#b2b1ab]' },
  // jasná / tmavá tyrkysová
  {
    fill: 'fill-[#3bdaff] dark:fill-[#0b6b85]',
    edge: 'stroke-[#0e7490] dark:stroke-[#3797b0]',
    swatch: 'bg-[#3bdaff] dark:bg-[#0b6b85] ring-1 ring-inset ring-[#0e7490] dark:ring-[#3797b0]',
    stroke: 'stroke-[#3bdaff] dark:stroke-[#0b6b85]',
  },
  // zlatá
  { fill: 'fill-[#b38600] dark:fill-[#d9a400]', edge: NO_EDGE, swatch: 'bg-[#b38600] dark:bg-[#d9a400]', stroke: 'stroke-[#b38600] dark:stroke-[#d9a400]' },
  // světlá tyrkysová / tmavá tyrkysová
  {
    fill: 'fill-[#a5ecff] dark:fill-[#1f5868]',
    edge: 'stroke-[#0e7490] dark:stroke-[#3797b0]',
    swatch: 'bg-[#a5ecff] dark:bg-[#1f5868] ring-1 ring-inset ring-[#0e7490] dark:ring-[#3797b0]',
    stroke: 'stroke-[#a5ecff] dark:stroke-[#1f5868]',
  },
  // grafit / papír
  { fill: 'fill-[#262626] dark:fill-[#f6f5f0]', edge: NO_EDGE, swatch: 'bg-[#262626] dark:bg-[#f6f5f0]', stroke: 'stroke-[#262626] dark:stroke-[#f6f5f0]' },
  // světle žlutá / tmavé zlato
  {
    fill: 'fill-[#ffe699] dark:fill-[#8a6a00]',
    edge: 'stroke-[#8f6b00] dark:stroke-[#d9a400]',
    swatch: 'bg-[#ffe699] dark:bg-[#8a6a00] ring-1 ring-inset ring-[#8f6b00] dark:ring-[#d9a400]',
    stroke: 'stroke-[#ffe699] dark:stroke-[#8a6a00]',
  },
  // šedá
  {
    fill: 'fill-[#8a8a85] dark:fill-[#6a6a66]',
    edge: 'stroke-none dark:stroke-[#b2b1ab]',
    swatch: 'bg-[#8a8a85] dark:bg-[#6a6a66] dark:ring-1 dark:ring-inset dark:ring-[#b2b1ab]',
    stroke: 'stroke-[#8a8a85] dark:stroke-[#6a6a66]',
  },
  // světle šedá
  {
    fill: 'fill-[#d9d8d2] dark:fill-[#4a4a47]',
    edge: 'stroke-[#6f6f6a] dark:stroke-[#b2b1ab]',
    swatch: 'bg-[#d9d8d2] dark:bg-[#4a4a47] ring-1 ring-inset ring-[#6f6f6a] dark:ring-[#b2b1ab]',
    stroke: 'stroke-[#d9d8d2] dark:stroke-[#4a4a47]',
  },
]

export const seriesColor = (index: number): SeriesColor => SERIES_COLORS[((index % SERIES_COLORS.length) + SERIES_COLORS.length) % SERIES_COLORS.length]!
