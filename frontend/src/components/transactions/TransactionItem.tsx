import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Transaction } from '../../api/transactions'
import type { Category } from '../../api/categories'
import type { Account } from '../../api/accounts'
import { useCurrency } from '../../hooks/useCurrency'

interface Props {
  tx: Transaction
  categoryMap: Record<string, Category>
  accountMap:  Record<string, Account>
  onDelete: (id: string) => void
  onTap:    (tx: Transaction) => void
}

const REVEAL = -76
const THRESHOLD = 40

export default function TransactionItem({ tx, categoryMap, accountMap, onDelete, onTap }: Props) {
  const cur = useCurrency()
  const [swiped, setSwiped] = useState(false)
  const [live,   setLive]   = useState(0)      // offset during drag
  const [isDragging, setDragging] = useState(false)
  const startX  = useRef(0)

  const cat = tx.category_id ? categoryMap[tx.category_id] : null
  const acc = accountMap[tx.account_id]

  const sign    = tx.type === 'income' ? '+' : '-'
  const color   = tx.type === 'income' ? 'text-income' : tx.type === 'expense' ? 'text-expense' : 'text-white/70'
  const amtStr  = `${sign}${cur} ${tx.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
  const icon    = cat?.icon ?? (tx.type === 'income' ? '💰' : tx.type === 'transfer' ? '🔄' : '💸')
  const label   = cat?.name ?? (tx.type === 'income' ? 'Entrata' : tx.type === 'transfer' ? 'Trasferimento' : 'Spesa')

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    setLive(swiped ? REVEAL : 0)
    setDragging(true)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isDragging) return
    const base  = swiped ? REVEAL : 0
    const delta = e.touches[0].clientX - startX.current
    setLive(Math.max(REVEAL, Math.min(0, base + delta)))
  }

  function onTouchEnd() {
    setDragging(false)
    if (live < (swiped ? REVEAL / 2 : -THRESHOLD)) {
      setSwiped(true)
      setLive(REVEAL)
    } else {
      setSwiped(false)
      setLive(0)
    }
  }

  function handleTap() {
    if (swiped) { setSwiped(false); setLive(0); return }
    onTap(tx)
  }

  const translateX = isDragging ? live : (swiped ? REVEAL : 0)

  return (
    <div className="relative overflow-hidden">
      {/* Delete button (under the item) */}
      <div className="absolute right-0 top-0 bottom-0 w-[76px] flex items-center justify-center bg-expense rounded-r-xl">
        <button
          onClick={() => onDelete(tx.id)}
          className="flex flex-col items-center gap-1 text-white active:opacity-70 transition"
        >
          <Trash2 size={18} />
          <span className="text-[10px] font-medium">Elimina</span>
        </button>
      </div>

      {/* Item row */}
      <div
        className="relative z-10 bg-[#0f0f13] transition-transform"
        style={{
          transform: `translateX(${translateX}px)`,
          transitionDuration: isDragging ? '0ms' : '200ms',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleTap}
      >
        <div className="flex items-center gap-3 px-4 py-3 active:bg-white/5 transition-colors">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ backgroundColor: (cat?.color ?? '#6366f1') + '22' }}
          >
            {icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{label}</p>
            <p className="text-xs text-white/30 truncate">
              {acc?.name ?? '—'}{tx.note ? ` · ${tx.note}` : ''}
            </p>
          </div>

          {/* Amount */}
          <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${color}`}>
            {amtStr}
          </span>
        </div>
      </div>
    </div>
  )
}
