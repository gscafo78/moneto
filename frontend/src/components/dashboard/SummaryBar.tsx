import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'

interface Props {
  income: number
  expenses: number
  balance: number
}

function fmt(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SummaryBar({ income, expenses, balance }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 py-3">
      <div className="bg-surface rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingUp size={13} className="text-income" />
          <span className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Entrate</span>
        </div>
        <p className="text-income font-semibold text-sm tabular-nums">€ {fmt(income)}</p>
      </div>

      <div className="bg-surface rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <TrendingDown size={13} className="text-expense" />
          <span className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Uscite</span>
        </div>
        <p className="text-expense font-semibold text-sm tabular-nums">€ {fmt(expenses)}</p>
      </div>

      <div className="bg-surface rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Wallet size={13} className="text-white/50" />
          <span className="text-[10px] text-white/40 uppercase tracking-wide font-medium">Saldo</span>
        </div>
        <p className={`font-semibold text-sm tabular-nums ${balance >= 0 ? 'text-income' : 'text-expense'}`}>
          € {fmt(balance)}
        </p>
      </div>
    </div>
  )
}
