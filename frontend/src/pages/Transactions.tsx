import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ReceiptText, X } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/it'

import { useTransactions } from '../hooks/useTransactions'
import { transactionsApi, type Transaction } from '../api/transactions'
import { TransactionsSkeleton } from '../components/ui/Skeleton'
import { categoriesApi } from '../api/categories'
import { accountsApi } from '../api/accounts'
import TransactionList from '../components/transactions/TransactionList'
import AddTransactionButton from '../components/ui/AddTransactionButton'
import AddTransactionSheet from '../components/transactions/AddTransactionSheet'
import BottomSheet from '../components/ui/BottomSheet'

dayjs.locale('it')

type Filter = 'all' | 'expense' | 'income'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'Tutte'   },
  { key: 'expense', label: 'Spese'   },
  { key: 'income',  label: 'Entrate' },
]

export default function Transactions() {
  const qc = useQueryClient()
  const { data: txs = [], isLoading, year, month } = useTransactions()

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const { data: accounts   = [] } = useQuery({ queryKey: ['accounts'],   queryFn: accountsApi.list  })

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const accountMap  = Object.fromEntries(accounts.map(a => [a.id, a]))

  const [filter,      setFilter]      = useState<Filter>('all')
  const [addOpen,     setAddOpen]     = useState(false)
  const [detailTx,    setDetailTx]    = useState<Transaction | null>(null)
  const [confirmId,   setConfirmId]   = useState<string | null>(null)

  const filtered = filter === 'all' ? txs : txs.filter(t => t.type === filter)

  const deleteMutation = useMutation({
    mutationFn: transactionsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', year, month] })
      qc.invalidateQueries({ queryKey: ['stats',        year, month] })
      setConfirmId(null)
    },
  })

  function handleDelete(id: string) { setConfirmId(id) }
  function handleTap(tx: Transaction) { setDetailTx(tx) }

  return (
    <>
      {/* Filter tabs */}
      <div className="flex gap-1 mx-4 mt-3 mb-1 bg-surface rounded-xl p-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              filter === f.key ? 'bg-brand text-white' : 'text-white/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <TransactionsSkeleton />}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
          <ReceiptText size={40} strokeWidth={1.2} />
          <p className="text-sm">
            {filter === 'all' ? 'Nessuna transazione questo mese' : `Nessuna ${filter === 'expense' ? 'spesa' : 'entrata'} questo mese`}
          </p>
        </div>
      )}

      {/* List */}
      {!isLoading && filtered.length > 0 && (
        <TransactionList
          transactions={filtered}
          categoryMap={categoryMap}
          accountMap={accountMap}
          onDelete={handleDelete}
          onTap={handleTap}
        />
      )}

      {/* FAB */}
      <AddTransactionButton onClick={() => setAddOpen(true)} />

      {/* Add sheet */}
      <AddTransactionSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        year={year}
        month={month}
      />

      {/* Detail sheet */}
      <BottomSheet open={!!detailTx} onClose={() => setDetailTx(null)} maxHeight="max-h-[60dvh]">
        {detailTx && (
          <DetailContent
            tx={detailTx}
            categoryMap={categoryMap}
            accountMap={accountMap}
            onClose={() => setDetailTx(null)}
          />
        )}
      </BottomSheet>

      {/* Delete confirm dialog */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70" onClick={() => setConfirmId(null)}>
          <div className="bg-surface w-full max-w-sm rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white mb-2">Elimina transazione</h3>
            <p className="text-sm text-white/50 mb-5">Questa operazione è irreversibile e aggiornerà il saldo del conto.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 font-medium"
              >
                Annulla
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmId)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-expense text-white text-sm font-semibold disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Elimino…' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Detail ─────────────────────────────────────────────────────────────────────
function DetailContent({ tx, categoryMap, accountMap, onClose }: {
  tx: Transaction
  categoryMap: Record<string, any>
  accountMap:  Record<string, any>
  onClose: () => void
}) {
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
          {sign}€ {tx.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
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
    </div>
  )
}
