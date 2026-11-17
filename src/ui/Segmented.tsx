/** Přepínač s několika volbami (jedna aktivní) – sdílený pohledy Náklady a Analýza. */
export function Segmented<T extends string>({ label, options, value, onChange, text }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; text: (v: T) => string }) {
  return (
    <div role="group" aria-label={label} title={label} className="inline-flex">
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={`border px-3 py-1.5 text-sm font-medium focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            i === 0 ? 'rounded-l-md' : '-ml-px'
          } ${i === options.length - 1 ? 'rounded-r-md' : ''} ${
            value === o
              ? 'border-miro-graphite bg-miro-graphite text-miro-paper dark:border-miro-paper dark:bg-miro-paper dark:text-miro-graphite'
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          {text(o)}
        </button>
      ))}
    </div>
  )
}
