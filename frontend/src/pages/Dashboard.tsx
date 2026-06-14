import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReceiptText } from 'lucide-react'
import { useMonthlyStats } from '../hooks/useMonthlyStats'
import { useAccountStore } from '../store/accountStore'
import { useAuthStore } from '../store/authStore'
import { accountsApi } from '../api/accounts'
import SummaryBar from '../components/dashboard/SummaryBar'
import SpendingChart from '../components/dashboard/SpendingChart'
import CategoryList from '../components/dashboard/CategoryList'
import AddTransactionButton from '../components/ui/AddTransactionButton'
import AddTransactionSheet from '../components/transactions/AddTransactionSheet'
import { DashboardSkeleton } from '../components/ui/Skeleton'

export default function Dashboard() {
  const { data, isLoading, year, month } = useMonthlyStats()
  const [selectedCat, setSelectedCat]   = useState<string | null>(null)
  const [sheetOpen, setSheetOpen]       = useState(false)

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list })
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

  const summary = data ?? { income: 0, expenses: 0, balance: 0, real_balance: 0, by_category: [] }

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
        balance={summary.balance}
        realBalance={summary.real_balance}
      />

      {isLoading && <DashboardSkeleton />}

      {!isLoading && summary.by_category.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
          <ReceiptText size={40} strokeWidth={1.2} />
          <p className="text-sm">Nessuna transazione questo mese</p>
          <p className="text-xs">Tocca + per aggiungerne una</p>
        </div>
      )}

      {!isLoading && summary.by_category.length > 0 && (
        <>
          <SpendingChart
            data={summary.by_category}
            selectedId={selectedCat}
            onSelect={setSelectedCat}
          />
          <CategoryList
            data={summary.by_category}
            selectedId={selectedCat}
            onSelect={setSelectedCat}
          />
        </>
      )}

      <AddTransactionButton onClick={() => setSheetOpen(true)} />

      <AddTransactionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        year={year}
        month={month}
      />
    </>
  )
}
