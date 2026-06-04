import { ChevronRight } from 'lucide-react'
import type { Account } from '../../api/accounts'

interface Props {
  account: Account
  onEdit: (a: Account) => void
}

export default function AccountCard({ account, onEdit }: Props) {
  const balColor = account.balance >= 0 ? 'text-income' : 'text-expense'

  return (
    <button
      onClick={() => onEdit(account)}
      className="w-full flex items-center gap-4 bg-surface rounded-xl px-4 py-4 active:bg-surface-overlay transition"
    >
      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ backgroundColor: account.color + '22' }}
      >
        {account.icon}
      </div>

      {/* Name */}
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-semibold text-white truncate">{account.name}</p>
        <p className="text-xs text-white/30">{account.currency}</p>
      </div>

      {/* Balance */}
      <div className="text-right flex-shrink-0 flex items-center gap-2">
        <span className={`text-base font-bold tabular-nums ${balColor}`}>
          € {account.balance.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        </span>
        <ChevronRight size={16} className="text-white/20" />
      </div>
    </button>
  )
}
