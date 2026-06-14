import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileBarChart } from 'lucide-react'
import dayjs from 'dayjs'
import { statsApi } from '../api/stats'
import { accountsApi } from '../api/accounts'
import { categoriesApi } from '../api/categories'
import { useTransactions } from '../hooks/useTransactions'
import TrendChart from '../components/report/TrendChart'
import BalanceTrendChart, { type BalancePoint } from '../components/report/BalanceTrendChart'
import { downloadCsv } from '../utils/exportCsv'
import { useCurrency } from '../hooks/useCurrency'

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const RANGE_OPTIONS = [3, 6, 12] as const

export default function Report() {
  const cur = useCurrency()
  const [months, setMonths] = useState<number>(6)

  const { data: trend = [], isLoading: trendLoading } = useQuery({
    queryKey: ['stats', 'trend', months],
    queryFn: () => statsApi.trend(months),
  })

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const { data: txs = [], year, month } = useTransactions()

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  // Saldo a fine mese = saldo attuale - somma dei netti dei mesi successivi
  const balancePoints: BalancePoint[] = (() => {
    let runningBalance = totalBalance
    const result: BalancePoint[] = []
    for (let i = trend.length - 1; i >= 0; i--) {
      const m = trend[i]
      result.unshift({ label: `${MONTH_LABELS[m.month - 1]} '${String(m.year).slice(2)}`, balance: runningBalance })
      runningBalance -= (m.income - m.expenses)
    }
    return result
  })()

  function handleExport() {
    const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]))
    const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]))

    const headers = ['Data', 'Descrizione', 'Categoria', 'Conto', 'Tipo', `Importo (${cur})`]
    const rows = txs.map(t => [
      dayjs(t.date).format('DD/MM/YYYY'),
      t.note ?? '',
      t.category_id ? categoryMap[t.category_id]?.name ?? '' : '',
      accountMap[t.account_id]?.name ?? '',
      t.type === 'income' ? 'Entrata' : t.type === 'expense' ? 'Uscita' : 'Trasferimento',
      t.amount.toFixed(2),
    ])

    downloadCsv(`movimenti_${year}-${String(month).padStart(2, '0')}.csv`, headers, rows)
  }

  return (
    <div className="px-4 py-4 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileBarChart size={22} className="text-brand" />
          Report
        </h1>
        <div className="flex gap-1 bg-surface rounded-xl p-1">
          {RANGE_OPTIONS.map(m => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${months === m ? 'bg-brand text-white' : 'text-white/50'}`}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {!trendLoading && trend.length > 0 && (
        <>
          <TrendChart data={trend} />
          <BalanceTrendChart data={balancePoints} />
        </>
      )}

      <div className="bg-surface rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Esporta movimenti</p>
          <p className="text-xs text-white/40">
            {dayjs(`${year}-${month}-01`).locale('it').format('MMMM YYYY')} · {txs.length} transazioni
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={txs.length === 0}
          className="flex items-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition"
        >
          <Download size={16} />
          CSV
        </button>
      </div>
    </div>
  )
}
