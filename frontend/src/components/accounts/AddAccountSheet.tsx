import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import BottomSheet from '../ui/BottomSheet'
import EmojiPicker from '../ui/EmojiPicker'
import ColorPicker from '../ui/ColorPicker'
import { accountsApi, type Account } from '../../api/accounts'
import { useCurrency } from '../../hooks/useCurrency'
import { useAuthStore } from '../../store/authStore'

interface Props {
  open: boolean
  onClose: () => void
  account?: Account   // se presente → modalità edit
  onImport?: (account: Account) => void
  onReconcile?: (account: Account) => void
}

export default function AddAccountSheet({ open, onClose, account, onImport, onReconcile }: Props) {
  const qc = useQueryClient()
  const cur = useCurrency()
  const userCurrency = useAuthStore(s => s.user?.currency) || 'EUR'
  const isEdit = !!account

  const [name,    setName]    = useState('')
  const [icon,    setIcon]    = useState('💳')
  const [color,   setColor]   = useState('#6366f1')
  const [balance, setBalance] = useState('0')
  const [tab,     setTab]     = useState<'emoji' | 'color' | null>(null)

  // Precompila in modalità edit
  useEffect(() => {
    if (account) {
      setName(account.name)
      setIcon(account.icon)
      setColor(account.color)
      setBalance(String(account.balance))
    } else {
      setName(''); setIcon('💳'); setColor('#6366f1'); setBalance('0')
    }
    setTab(null)
  }, [account, open])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['accounts'] })

  const createMut = useMutation({
    mutationFn: () => accountsApi.create({ name, icon, color, balance: parseFloat(balance) || 0, currency: userCurrency }),
    onSuccess: () => { invalidate(); onClose() },
  })

  const updateMut = useMutation({
    mutationFn: () => accountsApi.update(account!.id, { name, icon, color }),
    onSuccess: () => { invalidate(); onClose() },
  })

  const deleteMut = useMutation({
    mutationFn: () => accountsApi.remove(account!.id),
    onSuccess: () => { invalidate(); onClose() },
  })

  const isPending = createMut.isPending || updateMut.isPending

  function handleSave() {
    if (!name.trim()) return
    isEdit ? updateMut.mutate() : createMut.mutate()
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-6 pt-2 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? 'Modifica conto' : 'Nuovo conto'}
          </h2>
          {isEdit && (
            <button
              onClick={() => { if (confirm('Eliminare questo conto?')) deleteMut.mutate() }}
              className="p-2 text-expense/70 hover:text-expense transition"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 bg-surface-overlay rounded-xl p-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: color + '33' }}>{icon}</div>
          <div>
            <p className="text-sm font-semibold text-white">{name || 'Nome conto'}</p>
            <p className="text-xs text-white/40">{color}</p>
          </div>
        </div>

        {/* Nome */}
        <div>
          <label className="text-xs text-white/40 uppercase tracking-wide mb-1.5 block">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Es. Conto corrente"
            className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60"
          />
        </div>

        {/* Saldo iniziale (solo creazione) */}
        {!isEdit && (
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wide mb-1.5 block">Saldo iniziale ({cur})</label>
            <input
              type="number"
              inputMode="decimal"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60"
            />
          </div>
        )}

        {/* Icona / Colore tabs */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab(tab === 'emoji' ? null : 'emoji')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${tab === 'emoji' ? 'bg-brand text-white' : 'bg-surface-overlay text-white/60'}`}
          >
            <span className="text-lg">{icon}</span> Icona
          </button>
          <button
            type="button"
            onClick={() => setTab(tab === 'color' ? null : 'color')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${tab === 'color' ? 'bg-brand text-white' : 'bg-surface-overlay text-white/60'}`}
          >
            <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: color }} />
            Colore
          </button>
        </div>

        {tab === 'emoji' && <EmojiPicker value={icon} onChange={e => { setIcon(e); setTab(null) }} />}
        {tab === 'color' && <ColorPicker value={color} onChange={c => { setColor(c); setTab(null) }} />}

        {/* Importa / Riconcilia (solo modifica) */}
        {isEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onImport?.(account!)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-surface-overlay text-white/70 hover:text-white transition"
            >
              📄 Importa estratto conto
            </button>
            <button
              type="button"
              onClick={() => onReconcile?.(account!)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-surface-overlay text-white/70 hover:text-white transition"
            >
              ⚖️ Riconcilia saldo
            </button>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!name.trim() || isPending}
          className="w-full bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-semibold rounded-xl py-3.5 transition"
        >
          {isPending ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea conto'}
        </button>
      </div>
    </BottomSheet>
  )
}
