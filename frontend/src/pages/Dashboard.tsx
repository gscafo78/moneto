import { useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { useMonthlyStats } from '../hooks/useMonthlyStats'
import SummaryBar from '../components/dashboard/SummaryBar'
import SpendingChart from '../components/dashboard/SpendingChart'
import CategoryList from '../components/dashboard/CategoryList'
import AddTransactionButton from '../components/ui/AddTransactionButton'
import AddTransactionSheet from '../components/transactions/AddTransactionSheet'

export default function Dashboard() {
  const { data, isLoading, year, month } = useMonthlyStats()
  const [selectedCat, setSelectedCat]   = useState<string | null>(null)
  const [sheetOpen, setSheetOpen]       = useState(false)

  const summary = data ?? { income: 0, expenses: 0, balance: 0, by_category: [] }

  return (
    <>
      <SummaryBar
        income={summary.income}
        expenses={summary.expenses}
        balance={summary.balance}
      />

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      )}

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
