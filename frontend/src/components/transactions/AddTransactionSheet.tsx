import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Delete } from 'lucide-react'
import dayjs from 'dayjs'
import BottomSheet from '../ui/BottomSheet'
import { transactionsApi, type TxType } from '../../api/transactions'
import { categoriesApi } from '../../api/categories'
import { accountsApi } from '../../api/accounts'

interface Props {
  open: boolean
  onClose: () => void
  year: number
  month: number
}

// ── Numpad ─────────────────────────────────────────────────────────────────────
function useNumpad() {
  const [val, setVal] = useState('0')

  function press(key: string) {
    setVal(prev => {
      if (key === '⌫') return prev.length <= 1 ? '0' : prev.slice(0, -1)
      if (key === '.') {
        if (prev.includes('.')) return prev
        return prev + '.'
      }
      const [, dec] = prev.split('.')
      if (dec !== undefined && dec.length >= 2) return prev
      if (prev === '0') return key
      return prev + key
    })
  }

  function reset() { setVal('0') }
  const amount = parseFloat(val) || 0
  return { val, amount, press, reset }
}

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','.','0','⌫']

export default function AddTransactionSheet({ open, onClose, year, month }: Props) {
  const qc = useQueryClient()
  const { val, amount, press, reset } = useNumpad()

  const [type, setType]     = useState<TxType>('expense')
  const [catId, setCatId]   = useState<string>('')
  const [accId, setAccId]   = useState<string>('')
  const [note, setNote]     = useState('')
  const [date, setDate]     = useState(dayjs().format('YYYY-MM-DD'))

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const { data: accounts = [] }   = useQuery({ queryKey: ['accounts'],   queryFn: accountsApi.list })

  const filteredCats = categories.filter(c => c.type === type || type === 'transfer')

  const mutation = useMutation({
    mutationFn: () => transactionsApi.create({
      account_id:  accId || accounts[0]?.id,
      category_id: catId || undefined,
      amount,
      type,
      note:  note || undefined,
      date:  new Date(date).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stats', year, month] })
      handleClose()
    },
  })

  function handleClose() {
    reset()
    setType('expense')
    setCatId('')
    setNote('')
    setDate(dayjs().format('YYYY-MM-DD'))
    onClose()
  }

  const canSave = amount > 0 && (accId || accounts.length > 0)

  return (
    <BottomSheet open={open} onClose={handleClose}>
      {/* Tipo */}
      <div className="flex gap-1 mx-4 mt-2 mb-3 bg-surface-overlay rounded-xl p-1 flex-shrink-0">
        {(['expense','income','transfer'] as TxType[]).map(t => (
          <button
            key={t}
            onClick={() => { setType(t); setCatId('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${type === t
              ? t === 'expense' ? 'bg-expense text-white'
              : t === 'income'  ? 'bg-income text-white'
              : 'bg-brand text-white'
              : 'text-white/40'}`}
          >
            {t === 'expense' ? 'Spesa' : t === 'income' ? 'Entrata' : 'Trasferimento'}
          </button>
        ))}
      </div>

      {/* Display importo */}
      <div className="text-center py-3 flex-shrink-0">
        <span className={`text-4xl font-bold tabular-nums ${type === 'expense' ? 'text-expense' : type === 'income' ? 'text-income' : 'text-brand'}`}>
          € {parseFloat(val || '0').toLocaleString('it-IT', { minimumFractionDigits: val.includes('.') ? Math.min((val.split('.')[1]?.length ?? 0), 2) : 0, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-1.5 px-4 mb-4 flex-shrink-0">
        {NUMPAD_KEYS.map(k => (
          <button
            key={k}
            onClick={() => press(k)}
            className="bg-surface-overlay rounded-xl py-3.5 text-white font-semibold text-xl active:bg-white/10 transition flex items-center justify-center min-h-[52px]"
          >
            {k === '⌫' ? <Delete size={20} className="text-white/60" /> : k}
          </button>
        ))}
      </div>

      {/* Resto del form — scrollabile */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-4">

        {/* Categorie */}
        {type !== 'transfer' && filteredCats.length > 0 && (
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Categoria</p>
            <div className="grid grid-cols-4 gap-2">
              {filteredCats.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCatId(c.id === catId ? '' : c.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-2 transition ${catId === c.id ? 'bg-brand/20 ring-1 ring-brand' : 'bg-surface-overlay'}`}
                >
                  <span className="text-2xl">{c.icon}</span>
                  <span className="text-[9px] text-white/60 leading-tight text-center line-clamp-2">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conto */}
        {accounts.length > 0 && (
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Conto</p>
            <select
              value={accId || accounts[0]?.id}
              onChange={e => setAccId(e.target.value)}
              className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
              ))}
            </select>
          </div>
        )}

        {accounts.length === 0 && (
          <p className="text-sm text-white/40 text-center py-2">
            Crea prima un conto dalla sezione Conti.
          </p>
        )}

        {/* Note */}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Note</p>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Opzionale…"
            className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60"
          />
        </div>

        {/* Data */}
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Data</p>
          <input
            type="date"
            value={date}
            max={dayjs().format('YYYY-MM-DD')}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60"
          />
        </div>

        {/* Salva */}
        <button
          onClick={() => mutation.mutate()}
          disabled={!canSave || mutation.isPending}
          className="w-full bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-semibold rounded-xl py-3.5 transition min-h-[52px] mb-2"
        >
          {mutation.isPending ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>
    </BottomSheet>
  )
}
