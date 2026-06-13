import type { ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  onCancel: () => void
  onConfirm: () => void
  canConfirm?: boolean
  children: ReactNode
}

export default function FieldDialog({ open, title, onCancel, onConfirm, canConfirm = true, children }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1a1a24] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[85dvh]">
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <h3 className="text-sm font-semibold text-white/70">{title}</h3>
        </div>
        <div className="px-4 overflow-y-auto flex-1">{children}</div>
        <div className="flex gap-2 p-4 pt-3 flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-surface-overlay rounded-xl py-2.5 text-sm font-semibold text-white/70 transition active:bg-white/10"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="flex-1 bg-brand hover:bg-brand-dark disabled:opacity-40 rounded-xl py-2.5 text-sm font-semibold text-white transition"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
