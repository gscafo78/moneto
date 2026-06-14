import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ReceiptText } from 'lucide-react'
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
import TransactionDialogs from '../components/transactions/TransactionDialogs'

dayjs.locale('it')

type Filter = 'all' | 'expense' | 'income'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',     label: 'Tutte'   },
  { key: 'expense', label: 'Spese'   },
  { key: 'income',  label: 'Entrate' },
]

export default function Transactions() {
  const qc = useQueryClient()
  const { data: txs = [], isLoading } = useTransactions()

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const { data: accounts   = [] } = useQuery({ queryKey: ['accounts'],   queryFn: accountsApi.list  })

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const accountMap  = Object.fromEntries(accounts.map(a => [a.id, a]))

  const [filter,      setFilter]      = useState<Filter>('all')
  const [addOpen,     setAddOpen]     = useState(false)
  const [detailTx,    setDetailTx]    = useState<Transaction | null>(null)
  const [editTx,      setEditTx]      = useState<Transaction | null>(null)
  const [confirmId,   setConfirmId]   = useState<string | null>(null)

  const filtered = filter === 'all' ? txs : txs.filter(t => t.type === filter)

  const deleteMutation = useMutation({
    mutationFn: transactionsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
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
            {filter === 'all' ? 'Nessuna transazione in questo periodo' : `Nessuna ${filter === 'expense' ? 'spesa' : 'entrata'} in questo periodo`}
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

      {/* Add/edit sheet */}
      <AddTransactionSheet
        open={addOpen || !!editTx}
        onClose={() => { setAddOpen(false); setEditTx(null) }}
        transaction={editTx}
      />

      <TransactionDialogs
        detailTx={detailTx}
        onCloseDetail={() => setDetailTx(null)}
        onEdit={tx => { setDetailTx(null); setEditTx(tx) }}
        onDelete={tx => { setDetailTx(null); setConfirmId(tx.id) }}
        confirmId={confirmId}
        onCancelDelete={() => setConfirmId(null)}
        onConfirmDelete={() => deleteMutation.mutate(confirmId!)}
        isDeleting={deleteMutation.isPending}
        categoryMap={categoryMap}
        accountMap={accountMap}
      />
    </>
  )
}
