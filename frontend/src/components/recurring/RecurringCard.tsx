import { ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import type { RecurringTransaction, RecurringFrequency } from '../../api/recurring'
import type { Category } from '../../api/categories'
import { useCurrency } from '../../hooks/useCurrency'

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Ogni settimana',
  monthly: 'Ogni mese',
  bimonthly: 'Ogni 2 mesi',
  quarterly: 'Ogni 3 mesi',
}

interface Props {
  recurring: RecurringTransaction
  category?: Category
  onEdit: (r: RecurringTransaction) => void
}

export default function RecurringCard({ recurring, category, onEdit }: Props) {
  const cur = useCurrency()
  const amountColor = recurring.type === 'expense' ? 'text-expense' : 'text-income'

  return (
    <button
      onClick={() => onEdit(recurring)}
      className={`w-full flex items-center gap-4 bg-surface rounded-xl px-4 py-4 active:bg-surface-overlay transition ${!recurring.is_active ? 'opacity-50' : ''}`}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ backgroundColor: (category?.color ?? '#6366f1') + '22' }}
      >
        {category?.icon ?? '🔁'}
      </div>

      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {recurring.description || category?.name || 'Ricorrenza'}
        </p>
        <p className="text-xs text-white/30">
          {FREQUENCY_LABELS[recurring.frequency]}
          {recurring.next_occurrence && ` · prossima: ${dayjs(recurring.next_occurrence).format('DD/MM/YYYY')}`}
          {!recurring.is_active && ' · disattivata'}
        </p>
      </div>

      <div className="text-right flex-shrink-0 flex items-center gap-2">
        <span className={`text-base font-bold tabular-nums ${amountColor}`}>
          {cur} {recurring.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        </span>
        <ChevronRight size={16} className="text-white/20" />
      </div>
    </button>
  )
}
