/**
 * Vlastní ikony aplikace (čisté SVG, bez knihovny). Kreslí se barvou textu (currentColor),
 * takže se samy přizpůsobí světlému i tmavému vzhledu a vybranému tlačítku.
 * Jsou jen ozdobou – význam nese text tlačítka (aria-hidden).
 */
const common = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  'aria-hidden': true,
  focusable: false,
} as const

/** Plán: tři úsečky Ganttova diagramu na sebe navazující, s jemnou časovou osou. */
export function PlanIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M1.5 1.5v13h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <rect x="3.5" y="3" width="5" height="2.4" rx="1.2" fill="currentColor" />
      <rect x="6.5" y="6.8" width="5.5" height="2.4" rx="1.2" fill="currentColor" opacity="0.8" />
      <rect x="9.5" y="10.6" width="4.5" height="2.4" rx="1.2" fill="currentColor" opacity="0.65" />
    </svg>
  )
}

/** Zdroje: člověk (lidé) a kostka (materiál a stroje) – databáze všeho, co projekt spotřebuje. */
export function ResourcesIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="5" cy="4.4" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 13.5c0-2.5 1.8-4.3 4-4.3s4 1.8 4 4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11.8 6.2l3.2 1.6v3.6l-3.2 1.6-3.2-1.6V7.8z" fill="currentColor" opacity="0.25" />
      <path d="M11.8 6.2l3.2 1.6v3.6l-3.2 1.6-3.2-1.6V7.8l3.2-1.6zM8.6 7.8l3.2 1.6 3.2-1.6M11.8 9.4V13" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}
