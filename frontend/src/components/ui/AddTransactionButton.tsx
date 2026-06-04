import { Plus } from 'lucide-react'

interface Props { onClick: () => void }

export default function AddTransactionButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-brand shadow-lg shadow-brand/40 flex items-center justify-center active:scale-95 transition-transform"
      aria-label="Aggiungi transazione"
    >
      <Plus size={28} className="text-white" />
    </button>
  )
}
