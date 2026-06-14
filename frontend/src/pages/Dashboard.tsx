import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ReceiptText } from 'lucide-react'
import { useSummaryStats } from '../hooks/useSummaryStats'
import { useTransactions } from '../hooks/useTransactions'
import { useAccountStore } from '../store/accountStore'
import { useAuthStore } from '../store/authStore'
import { accountsApi } from '../api/accounts'
import { categoriesApi } from '../api/categories'
import { transactionsApi, type Transaction } from '../api/transactions'
import SummaryBar from '../components/dashboard/SummaryBar'
import SpendingChart from '../components/dashboard/SpendingChart'
import CategoryList from '../components/dashboard/CategoryList'
import TransactionList from '../components/transactions/TransactionList'
import PendingRecurringList from '../components/dashboard/PendingRecurringList'
import TransactionDialogs from '../components/transactions/TransactionDialogs'
import AddTransactionButton from '../components/ui/AddTransactionButton'
import AddTransactionSheet from '../components/transactions/AddTransactionSheet'
import { DashboardSkeleton } from '../components/ui/Skeleton'

export default function Dashboard() {
  const qc = useQueryClient()
  const { data, isLoading } = useSummaryStats()
  const { data: txs = [] } = useTransactions()
  const [selectedCat, setSelectedCat]   = useState<string | null>(null)
  const [showPending, setShowPending]   = useState(false)
  const [sheetOpen, setSheetOpen]       = useState(false)
  const [detailTx,  setDetailTx]        = useState<Transaction | null>(null)
  const [editTx,    setEditTx]          = useState<Transaction | null>(null)
  const [confirmId, setConfirmId]       = useState<string | null>(null)

  const { data: accounts   = [] } = useQuery({ queryKey: ['accounts'],   queryFn: accountsApi.list })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const selectedAccountId = useAccountStore(s => s.selectedAccountId)
  const setSelectedAccountId = useAccountStore(s => s.setSelectedAccountId)
  const defaultAccountId = useAuthStore(s => s.user?.default_account_id)

  // Applica il conto predefinito impostato dall'utente al primo caricamento
  const appliedDefault = useRef(false)
  useEffect(() => {
    if (appliedDefault.current) return
    if (!defaultAccountId) return
    if (!accounts.some(a => a.id === defaultAccountId)) return
    appliedDefault.current = true
    setSelectedAccountId(defaultAccountId)
  }, [defaultAccountId, accounts, setSelectedAccountId])

  const summary = data ?? { income: 0, expenses: 0, pending_expenses: 0, balance: 0, by_category: [], pending_items: [] }

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const accountMap  = Object.fromEntries(accounts.map(a => [a.id, a]))

  const isVarie = selectedCat ? categoryMap[selectedCat]?.name === 'Varie' : false

  const categoryTxs = selectedCat
    ? txs.filter(t =>
        t.type === 'expense' &&
        (!selectedAccountId || t.account_id === selectedAccountId) &&
        (t.category_id === selectedCat || (isVarie && !t.category_id)))
    : []

  const pendingReal = summary.pending_items
    .filter(i => !i.is_recurring)
    .map(i => txs.find(t => t.id === i.id))
    .filter((t): t is Transaction => !!t)

  const pendingRecurring = summary.pending_items.filter(i => i.is_recurring)

  const deleteMutation = useMutation({
    mutationFn: transactionsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setConfirmId(null)
    },
  })

  return (
    <>
      {accounts.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-2 -mb-1">
          <button
            onClick={() => setSelectedAccountId(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${!selectedAccountId ? 'bg-brand text-white' : 'bg-surface-overlay text-white/50'}`}
          >
            Tutti i conti
          </button>
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedAccountId(a.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${selectedAccountId === a.id ? 'bg-brand text-white' : 'bg-surface-overlay text-white/50'}`}
            >
              {a.icon} {a.name}
            </button>
          ))}
        </div>
      )}

      <SummaryBar
        income={summary.income}
        expenses={summary.expenses}
        pendingExpenses={summary.pending_expenses}
        balance={summary.balance}
        pendingSelected={showPending}
        onTogglePending={() => { setShowPending(p => !p); setSelectedCat(null) }}
      />

      {isLoading && <DashboardSkeleton />}

      {!isLoading && showPending && (
        pendingReal.length > 0 || pendingRecurring.length > 0 ? (
          <>
            {pendingReal.length > 0 && (
              <TransactionList
                transactions={pendingReal}
                categoryMap={categoryMap}
                accountMap={accountMap}
                onDelete={setConfirmId}
                onTap={setDetailTx}
              />
            )}
            {pendingRecurring.length > 0 && (
              <PendingRecurringList
                items={pendingRecurring}
                categoryMap={categoryMap}
                accountMap={accountMap}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-white/30 text-center py-8">Nessuna transazione non contabilizzata nel periodo</p>
        )
      )}

      {!isLoading && !showPending && summary.by_category.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
          <ReceiptText size={40} strokeWidth={1.2} />
          <p className="text-sm">Nessuna transazione in questo periodo</p>
          <p className="text-xs">Tocca + per aggiungerne una</p>
        </div>
      )}

      {!isLoading && !showPending && summary.by_category.length > 0 && (
        <>
          <SpendingChart
            data={summary.by_category}
            selectedId={selectedCat}
            onSelect={setSelectedCat}
          />
          {selectedCat ? (
            categoryTxs.length > 0 ? (
              <TransactionList
                transactions={categoryTxs}
                categoryMap={categoryMap}
                accountMap={accountMap}
                onDelete={setConfirmId}
                onTap={setDetailTx}
              />
            ) : (
              <p className="text-sm text-white/30 text-center py-8">Nessun movimento per questa categoria nel periodo</p>
            )
          ) : (
            <CategoryList
              data={summary.by_category}
              selectedId={selectedCat}
              onSelect={setSelectedCat}
            />
          )}
        </>
      )}

      <AddTransactionButton onClick={() => setSheetOpen(true)} />

      <AddTransactionSheet
        open={sheetOpen || !!editTx}
        onClose={() => { setSheetOpen(false); setEditTx(null) }}
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
