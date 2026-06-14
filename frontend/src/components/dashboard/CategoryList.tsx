import type { CategoryStat } from '../../api/stats'
import { useCurrency } from '../../hooks/useCurrency'

interface Props {
  data: CategoryStat[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export default function CategoryList({ data, selectedId, onSelect }: Props) {
  const cur = useCurrency()
  const max   = Math.max(...data.map(c => c.total), 1)
  const shown = selectedId ? data.filter(c => c.category_id === selectedId) : data

  if (shown.length === 0) return null

  return (
    <div className="px-4 pb-4 space-y-2">
      {shown.map(cat => {
        const pct = Math.round((cat.total / max) * 100)
        const active = selectedId === cat.category_id

        return (
          <button
            key={cat.category_id}
            onClick={() => onSelect(active ? null : cat.category_id)}
            className={`w-full flex items-center gap-3 bg-surface rounded-xl px-4 py-3 transition active:scale-[0.98] ${active ? 'ring-1 ring-white/20' : ''}`}
          >
            <span className="text-xl w-7 text-center flex-shrink-0">{cat.icon}</span>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-medium text-white truncate">{cat.name}</span>
                <span className="text-sm font-semibold text-white/80 tabular-nums ml-2 flex-shrink-0">
                  {cur} {cat.total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: cat.color }}
                />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
