import { TrendingUp, TrendingDown, Wallet, PiggyBank, Clock } from 'lucide-react'
import { useCurrency } from '../../hooks/useCurrency'

interface Props {
  income: number
  expenses: number
  pendingExpenses: number
  balance: number
  pendingSelected?: boolean
  onTogglePending?: () => void
}

function fmt(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SummaryBar({ income, expenses, pendingExpenses, balance, pendingSelected, onTogglePending }: Props) {
  const cur = useCurrency()
  const availableBalance = balance - pendingExpenses
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 px-4 py-3">
      <div className="bg-surface rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp size={13} className="text-income" />
          <span className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Entrate</span>
        </div>
        <p className="text-income font-semibold text-sm tabular-nums">{cur} {fmt(income)}</p>
      </div>

      <div className="bg-surface rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingDown size={13} className="text-expense" />
          <span className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Uscite</span>
        </div>
        <p className="text-expense font-semibold text-sm tabular-nums">{cur} {fmt(expenses)}</p>
      </div>

      <button
        onClick={onTogglePending}
        className={`bg-surface rounded-xl p-3 text-left transition ${pendingSelected ? 'ring-1 ring-amber-400' : ''}`}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <Clock size={13} className="text-amber-400" />
          <span className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Non contabilizzate</span>
        </div>
        <p className="text-amber-400 font-semibold text-sm tabular-nums">{cur} {fmt(pendingExpenses)}</p>
      </button>

      <div className="bg-surface rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Wallet size={13} className="text-white/50" />
          <span className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Saldo</span>
        </div>
        <p className={`font-semibold text-sm tabular-nums ${balance >= 0 ? 'text-income' : 'text-expense'}`}>
          {cur} {fmt(balance)}
        </p>
      </div>

      <div className="bg-surface rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <PiggyBank size={13} className="text-white/50" />
          <span className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Saldo disponibile</span>
        </div>
        <p className={`font-semibold text-sm tabular-nums ${availableBalance >= 0 ? 'text-income' : 'text-expense'}`}>
          {cur} {fmt(availableBalance)}
        </p>
      </div>
    </div>
  )
}
