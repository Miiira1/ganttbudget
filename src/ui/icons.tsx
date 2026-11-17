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

/** Vytížení: sloupce histogramu a vodorovná čára kapacity; jeden sloupec ji přesahuje. */
export function LoadIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M1.5 14.5h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      <rect x="2.5" y="9" width="2.6" height="5.5" rx="0.8" fill="currentColor" opacity="0.65" />
      <rect x="6.7" y="6.5" width="2.6" height="8" rx="0.8" fill="currentColor" opacity="0.8" />
      <rect x="10.9" y="3" width="2.6" height="11.5" rx="0.8" fill="currentColor" />
      <path d="M1 5.5h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.6 1.6" />
    </svg>
  )
}

/** Náklady: znak eura (peníze) vlevo nahoře a přes celou ikonu stoupající S-křivka (kumulativní náběh rozpočtu). */
export function CostsIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M7.6 2.3A3.2 3.2 0 1 0 7.6 7.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M1.6 4.3h4M1.6 5.8h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M1.5 14.5h13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
      <path d="M1.8 12.8C6 12.8 8 11.5 10 8.5S12.8 3.6 14.8 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14.8" cy="3.2" r="1.1" fill="currentColor" />
    </svg>
  )
}

/** Analýza: kontingenční tabulka – mřížka se zvýrazněnou hlavičkou a prvním sloupcem. */
export function AnalysisIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 5.5h13M5.5 1.5v13" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.2 2.2h12v2.6H6.2v9.1H2.2z" fill="currentColor" opacity="0.35" />
      <path d="M5.5 10h9M10 5.5v9" stroke="currentColor" strokeWidth="1" opacity="0.55" />
    </svg>
  )
}

/** Sledování: plánovaná (čárkovaná) a skutečná křivka s bodem data stavu. */
export function TrackingIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M1.5 1.5v13h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <path d="M3 12.5C6 12 8 8 13.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.6 1.6" strokeLinecap="round" />
      <path d="M3 12.5C5.5 12.2 7.5 10.5 9.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9.5" cy="8.5" r="1.7" fill="currentColor" />
    </svg>
  )
}

/** AI: velká čtyřcípá hvězdička (jiskra) a vpravo nahoře menší – obvyklý symbol umělé inteligence. */
export function AiIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M6.5 3.5Q7 9 12.5 9.5Q7 10 6.5 15.5Q6 10 0.5 9.5Q6 9 6.5 3.5Z" fill="currentColor" />
      <path d="M12.5 0.8Q12.8 3.2 15.2 3.5Q12.8 3.8 12.5 6.2Q12.2 3.8 9.8 3.5Q12.2 3.2 12.5 0.8Z" fill="currentColor" opacity="0.65" />
    </svg>
  )
}
