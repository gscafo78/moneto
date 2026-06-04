import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { accountsApi, type Account } from '../api/accounts'
import AccountCard from '../components/accounts/AccountCard'
import { AccountsSkeleton } from '../components/ui/Skeleton'
import AddAccountSheet from '../components/accounts/AddAccountSheet'

export default function Accounts() {
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn:  accountsApi.list,
  })

  const [sheetOpen,   setSheetOpen]   = useState(false)
  const [editAccount, setEditAccount] = useState<Account | undefined>()

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  function openAdd()  { setEditAccount(undefined); setSheetOpen(true)  }
  function openEdit(a: Account) { setEditAccount(a); setSheetOpen(true) }

  return (
    <>
      <div className="px-4 py-4 space-y-3">
        {/* Totale */}
        <div className="bg-surface rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
            <Wallet size={20} className="text-brand" />
          </div>
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wide">Patrimonio totale</p>
            <p className={`text-xl font-bold tabular-nums ${totalBalance >= 0 ? 'text-income' : 'text-expense'}`}>
              € {totalBalance.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {isLoading && <AccountsSkeleton />}

        {/* Lista conti */}
        {!isLoading && accounts.length === 0 && (
          <div className="text-center py-12 text-white/30 text-sm">
            Nessun conto ancora. Creane uno!
          </div>
        )}

        {!isLoading && accounts.length > 0 && (
          <div className="space-y-2">
            {accounts.map(a => (
              <AccountCard key={a.id} account={a} onEdit={openEdit} />
            ))}
          </div>
        )}

        {/* Aggiungi */}
        <button
          onClick={openAdd}
          className="w-full flex items-center justify-center gap-2 bg-surface-overlay border border-dashed border-white/10 rounded-xl py-4 text-sm text-white/40 hover:text-white/60 transition active:bg-surface"
        >
          + Aggiungi conto
        </button>
      </div>

      <AddAccountSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        account={editAccount}
      />
    </>
  )
}
