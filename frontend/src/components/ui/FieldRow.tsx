import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

interface Props {
  label: string
  value?: ReactNode
  placeholder?: string
  onClick: () => void
  disabled?: boolean
}

export default function FieldRow({ label, value, placeholder, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-between gap-2 bg-surface-overlay rounded-xl px-3 py-2.5 text-left transition disabled:opacity-40 active:bg-white/5"
    >
      <div className="min-w-0">
        <p className="text-[11px] text-white/40 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium truncate">
          {value || <span className="text-white/30">{placeholder}</span>}
        </p>
      </div>
      {!disabled && <ChevronRight size={16} className="text-white/30 flex-shrink-0" />}
    </button>
  )
}
