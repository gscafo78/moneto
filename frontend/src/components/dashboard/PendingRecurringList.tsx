import dayjs from 'dayjs'
import 'dayjs/locale/it'
import type { PendingItem } from '../../api/stats'
import type { Category } from '../../api/categories'
import type { Account } from '../../api/accounts'
import { useCurrency } from '../../hooks/useCurrency'

dayjs.locale('it')

interface Props {
  items: PendingItem[]
  categoryMap: Record<string, Category>
  accountMap:  Record<string, Account>
}

export default function PendingRecurringList({ items, categoryMap, accountMap }: Props) {
  const cur = useCurrency()

  return (
    <div className="pb-4">
      <div className="flex items-center justify-between px-4 pt-5 pb-1.5">
        <span className="text-xs font-semibold text-white/40">Ricorrenze previste</span>
      </div>

      <div className="bg-surface mx-4 rounded-xl overflow-hidden divide-y divide-white/5">
        {items.map(item => {
          const cat   = item.category_id ? categoryMap[item.category_id] : null
          const acc   = accountMap[item.account_id]
          const icon  = cat?.icon ?? '💸'
          const label = cat?.name ?? 'Spesa'

          return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: (cat?.color ?? '#6366f1') + '22' }}
              >
                {icon}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{label}</p>
                <p className="text-xs text-white/30 truncate">
                  {acc?.name ?? '—'}{item.note ? ` · ${item.note}` : ''} · {dayjs(item.date).format('D MMM')} · 🔁 Ricorrente
                </p>
              </div>

              <span className="text-sm font-semibold tabular-nums flex-shrink-0 text-expense">
                -{cur} {item.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
