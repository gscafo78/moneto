import { X, Pencil, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/it'
import BottomSheet from '../ui/BottomSheet'
import type { Transaction } from '../../api/transactions'
import type { Category } from '../../api/categories'
import type { Account } from '../../api/accounts'
import { useCurrency } from '../../hooks/useCurrency'

dayjs.locale('it')

interface Props {
  detailTx: Transaction | null
  onCloseDetail: () => void
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
  confirmId: string | null
  onCancelDelete: () => void
  onConfirmDelete: () => void
  isDeleting: boolean
  categoryMap: Record<string, Category>
  accountMap: Record<string, Account>
}

export default function TransactionDialogs({
  detailTx, onCloseDetail, onEdit, onDelete, confirmId, onCancelDelete, onConfirmDelete, isDeleting, categoryMap, accountMap,
}: Props) {
  return (
    <>
      <BottomSheet open={!!detailTx} onClose={onCloseDetail} maxHeight="max-h-[60dvh]">
        {detailTx && (
          <DetailContent
            tx={detailTx}
            categoryMap={categoryMap}
            accountMap={accountMap}
            onClose={onCloseDetail}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </BottomSheet>

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70" onClick={onCancelDelete}>
          <div className="bg-surface w-full max-w-sm rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-2">Elimina transazione</h3>
            <p className="text-sm text-white/50 mb-5">Questa operazione è irreversibile e aggiornerà il saldo del conto.</p>
            <div className="flex gap-3">
              <button
                onClick={onCancelDelete}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 font-medium"
              >
                Annulla
              </button>
              <button
                onClick={onConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-expense text-white text-sm font-semibold disabled:opacity-50"
              >
                {isDeleting ? 'Elimino…' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DetailContent({ tx, categoryMap, accountMap, onClose, onEdit, onDelete }: {
  tx: Transaction
  categoryMap: Record<string, Category>
  accountMap:  Record<string, Account>
  onClose: () => void
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}) {
  const cur   = useCurrency()
  const cat   = tx.category_id ? categoryMap[tx.category_id] : null
  const acc   = accountMap[tx.account_id]
  const sign  = tx.type === 'income' ? '+' : '-'
  const color = tx.type === 'income' ? 'text-income' : 'text-expense'
  const icon  = cat?.icon ?? (tx.type === 'income' ? '💰' : '💸')

  const rows = [
    { label: 'Categoria', value: cat ? `${cat.icon} ${cat.name}` : '—' },
    { label: 'Conto',     value: acc ? `${acc.icon} ${acc.name}` : '—' },
    { label: 'Data',      value: dayjs(tx.date).format('dddd D MMMM YYYY') },
    ...(tx.note ? [{ label: 'Note', value: tx.note }] : []),
  ]

  return (
    <div className="px-4 pb-6 pt-2">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-white/40 uppercase tracking-wide">Dettaglio</span>
        <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60">
          <X size={18} />
        </button>
      </div>

      {/* Amount hero */}
      <div className="flex flex-col items-center py-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-3"
          style={{ backgroundColor: (cat?.color ?? '#6366f1') + '22' }}>
          {icon}
        </div>
        <span className={`text-3xl font-bold tabular-nums ${color}`}>
          {sign}{cur} {tx.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Fields */}
      <div className="bg-surface-overlay rounded-xl divide-y divide-white/5">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-white/40">{r.label}</span>
            <span className="text-sm text-white font-medium capitalize">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onEdit(tx)}
          className="flex-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold rounded-xl py-3 transition"
        >
          <Pencil size={16} />
          Modifica
        </button>
        <button
          onClick={() => onDelete(tx)}
          className="flex-1 flex items-center justify-center gap-2 bg-expense/20 hover:bg-expense/30 text-expense font-semibold rounded-xl py-3 transition"
        >
          <Trash2 size={16} />
          Elimina
        </button>
      </div>
    </div>
  )
}
