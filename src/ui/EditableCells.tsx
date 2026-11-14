/**
 * Upravitelné buňky tabulky.
 * Text se během psaní drží jen v buňce; do projektu (a do historie Zpět) se zapíše
 * až po opuštění pole nebo klávese Enter. Klávesa Esc úpravu zruší.
 */
import { useState, type KeyboardEvent } from 'react'

const inputClass =
  'w-full rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-slate-300 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 dark:hover:border-slate-600'

function handleKeys(event: KeyboardEvent<HTMLInputElement>, cancel: () => void): void {
  const input = event.currentTarget
  if (event.key === 'Enter') input.blur()
  if (event.key === 'Escape') {
    // Zrušíme rozepsaný text a pole opustíme až po překreslení, aby se nic neuložilo.
    cancel()
    requestAnimationFrame(() => input.blur())
  }
}

interface TextCellProps {
  value: string
  label: string
  /** Vrátí false, pokud hodnota není platná (pak se vrátí původní text). */
  onCommit: (value: string) => boolean | void
  className?: string
}

export function TextCell({ value, label, onCommit, className = '' }: TextCellProps) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      type="text"
      aria-label={label}
      className={`${inputClass} ${className}`}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft)
        setDraft(null)
      }}
      onKeyDown={(e) => handleKeys(e, () => setDraft(null))}
    />
  )
}

interface NumberCellProps {
  value: number
  label: string
  min: number
  max: number
  disabled?: boolean
  title?: string
  onCommit: (value: number) => void
}

export function NumberCell({ value, label, min, max, disabled, title, onCommit }: NumberCellProps) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      title={title}
      min={min}
      max={max}
      step={1}
      disabled={disabled}
      className={`${inputClass} text-right tabular-nums`}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null) {
          const parsed = Number(draft.replace(',', '.'))
          // Neplatné číslo (prázdné pole, text) se zahodí a zůstane původní hodnota.
          if (draft.trim() !== '' && Number.isFinite(parsed)) {
            const clamped = Math.min(max, Math.max(min, Math.round(parsed)))
            if (clamped !== value) onCommit(clamped)
          }
        }
        setDraft(null)
      }}
      onKeyDown={(e) => handleKeys(e, () => setDraft(null))}
    />
  )
}
