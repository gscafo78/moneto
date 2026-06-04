import dayjs from 'dayjs'
import 'dayjs/locale/it'
import TransactionItem from './TransactionItem'
import type { Transaction } from '../../api/transactions'
import type { Category } from '../../api/categories'
import type { Account } from '../../api/accounts'

dayjs.locale('it')

interface Props {
  transactions: Transaction[]
  categoryMap:  Record<string, Category>
  accountMap:   Record<string, Account>
  onDelete: (id: string) => void
  onTap:    (tx: Transaction) => void
}

function dayLabel(dateStr: string): string {
  const d     = dayjs(dateStr)
  const today = dayjs()
  if (d.isSame(today, 'day'))                       return 'Oggi'
  if (d.isSame(today.subtract(1, 'day'), 'day'))    return 'Ieri'
  return d.format('dddd D MMMM')
}

function groupByDay(txs: Transaction[]): [string, Transaction[]][] {
  const groups: Record<string, Transaction[]> = {}
  for (const tx of txs) {
    const key = tx.date.substring(0, 10)
    ;(groups[key] ??= []).push(tx)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

export default function TransactionList({ transactions, categoryMap, accountMap, onDelete, onTap }: Props) {
  const groups = groupByDay(transactions)

  return (
    <div className="pb-4">
      {groups.map(([day, txs]) => (
        <div key={day}>
          {/* Day header */}
          <div className="flex items-center justify-between px-4 pt-5 pb-1.5">
            <span className="text-xs font-semibold text-white/40 capitalize">
              {dayLabel(day)}
            </span>
            <span className="text-xs text-white/30 tabular-nums">
              {txs.reduce((s, t) => t.type === 'income' ? s + t.amount : s - t.amount, 0)
                .toLocaleString('it-IT', { minimumFractionDigits: 2, signDisplay: 'always' })} €
            </span>
          </div>

          {/* Items */}
          <div className="bg-surface mx-4 rounded-xl overflow-hidden divide-y divide-white/5">
            {txs.map(tx => (
              <TransactionItem
                key={tx.id}
                tx={tx}
                categoryMap={categoryMap}
                accountMap={accountMap}
                onDelete={onDelete}
                onTap={onTap}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
