import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import BottomSheet from '../ui/BottomSheet'
import { accountsApi, type Account, type ReconcileResponse } from '../../api/accounts'
import { currencySymbol } from '../../utils/currency'

interface Props {
  open: boolean
  onClose: () => void
  account?: Account
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function ReconcileSheet({ open, onClose, account }: Props) {
  const qc = useQueryClient()
  const cur = currencySymbol(account?.currency)

  const [realBalance, setRealBalance] = useState('0')
  const [date, setDate] = useState(todayStr())
  const [result, setResult] = useState<ReconcileResponse | null>(null)

  useEffect(() => {
    if (account) setRealBalance(String(account.balance))
    setDate(todayStr())
    setResult(null)
  }, [account, open])

  const reconcileMut = useMutation({
    mutationFn: () => accountsApi.reconcile(account!.id, { real_balance: parseFloat(realBalance) || 0, date: `${date}T12:00:00Z` }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setResult(data)
    },
  })

  function handleClose() {
    setResult(null)
    onClose()
  }

  const currentBalance = account?.balance ?? 0
  const diff = (parseFloat(realBalance) || 0) - currentBalance
  const diffColor = diff === 0 ? 'text-white/50' : diff > 0 ? 'text-income' : 'text-expense'

  return (
    <BottomSheet open={open} onClose={handleClose}>
      <div className="px-4 pb-6 pt-2 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-white">Riconcilia saldo</h2>

        {result ? (
          <div className="bg-surface-overlay rounded-xl p-4 text-sm text-white space-y-1">
            {result.transaction ? (
              <p>✅ Creata transazione di rettifica di {cur} {Math.abs(result.difference).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
            ) : (
              <p>Il saldo era già corretto, nessuna rettifica necessaria.</p>
            )}
            <button
              onClick={handleClose}
              className="w-full mt-3 bg-brand hover:bg-brand-dark text-white font-semibold rounded-xl py-3 transition"
            >
              Chiudi
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-white/50">
              Inserisci il saldo reale di {account?.name} secondo l'estratto conto della banca. Verrà creata una transazione di rettifica per allineare Moneto.
            </p>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-wide mb-1.5 block">Saldo attuale in Moneto</label>
              <p className="text-sm text-white/70 px-3 py-2.5 bg-surface-overlay rounded-xl">
                {cur} {currentBalance.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-wide mb-1.5 block">Saldo reale ({cur})</label>
              <input
                type="number"
                inputMode="decimal"
                value={realBalance}
                onChange={e => setRealBalance(e.target.value)}
                className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60"
              />
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-wide mb-1.5 block">Data rettifica</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60"
              />
            </div>

            <div className="flex items-center justify-between text-sm px-1">
              <span className="text-white/40">Differenza</span>
              <span className={`font-semibold tabular-nums ${diffColor}`}>
                {diff > 0 ? '+' : ''}{cur} {diff.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              onClick={() => reconcileMut.mutate()}
              disabled={diff === 0 || reconcileMut.isPending}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-semibold rounded-xl py-3.5 transition"
            >
              {reconcileMut.isPending ? 'Conciliazione…' : 'Concilia'}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
