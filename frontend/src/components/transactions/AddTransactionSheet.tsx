import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Delete } from 'lucide-react'
import dayjs from 'dayjs'
import BottomSheet from '../ui/BottomSheet'
import FieldRow from '../ui/FieldRow'
import FieldDialog from '../ui/FieldDialog'
import { useNumpad, NUMPAD_KEYS } from '../../hooks/useNumpad'
import { transactionsApi, type Transaction, type TxType } from '../../api/transactions'
import { categoriesApi } from '../../api/categories'
import { accountsApi } from '../../api/accounts'
import { useCurrency } from '../../hooks/useCurrency'
import { useAuthStore } from '../../store/authStore'

interface Props {
  open: boolean
  onClose: () => void
  transaction?: Transaction | null
}

type Field = 'amount' | 'category' | 'account' | 'note' | 'date' | null

function fmtAmount(val: string) {
  return parseFloat(val || '0').toLocaleString('it-IT', {
    minimumFractionDigits: val.includes('.') ? Math.min((val.split('.')[1]?.length ?? 0), 2) : 0,
    maximumFractionDigits: 2,
  })
}

export default function AddTransactionSheet({ open, onClose, transaction }: Props) {
  const qc = useQueryClient()
  const cur = useCurrency()
  const { val, amount, press, reset } = useNumpad()
  const isEdit = !!transaction
  const defaultAccountId = useAuthStore(s => s.user?.default_account_id)

  const [type, setType]     = useState<TxType>('expense')
  const [catId, setCatId]   = useState<string>('')
  const [accId, setAccId]   = useState<string>('')
  const [note, setNote]     = useState('')
  const [date, setDate]     = useState(dayjs().format('YYYY-MM-DD'))

  const [activeField, setActiveField] = useState<Field>(null)
  const draft = useNumpad()
  const [draftCatId, setDraftCatId]   = useState('')
  const [draftAccId, setDraftAccId]   = useState('')
  const [draftNote, setDraftNote]     = useState('')
  const [draftDate, setDraftDate]     = useState('')

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const { data: accounts = [] }   = useQuery({ queryKey: ['accounts'],   queryFn: accountsApi.list })

  const filteredCats = categories.filter(c => c.type === type || type === 'transfer')
  const selectedCat = categories.find(c => c.id === catId)
  const selectedAcc = accounts.find(a => a.id === accId) ?? accounts[0]

  const isVoucherAccount = !!(selectedAcc?.meal_voucher_value)
  const voucherValue = selectedAcc?.meal_voucher_value ?? 0
  const numpadKeys = isVoucherAccount ? NUMPAD_KEYS.filter(k => k !== '.') : NUMPAD_KEYS

  // Precompila i campi in modalità modifica
  useEffect(() => {
    if (!open) return
    if (transaction) {
      reset(transaction.voucher_quantity != null ? String(transaction.voucher_quantity) : String(transaction.amount))
      setType(transaction.type)
      setCatId(transaction.category_id ?? '')
      setAccId(transaction.account_id)
      setNote(transaction.note ?? '')
      setDate(dayjs(transaction.date).format('YYYY-MM-DD'))
    } else {
      reset()
      setType('expense')
      setCatId('')
      setAccId(defaultAccountId ?? '')
      setNote('')
      setDate(dayjs().format('YYYY-MM-DD'))
    }
    setActiveField(null)
  }, [open, transaction, defaultAccountId])

  const finalAmount = isVoucherAccount ? amount * voucherValue : amount
  const voucherQuantity = isVoucherAccount ? amount : null

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? transactionsApi.update(transaction!.id, {
          account_id:  accId || accounts[0]?.id,
          category_id: catId || null,
          amount: finalAmount,
          type,
          note:  note || null,
          date:  new Date(date).toISOString(),
          voucher_quantity: voucherQuantity,
        })
      : transactionsApi.create({
          account_id:  accId || accounts[0]?.id,
          category_id: catId || undefined,
          amount: finalAmount,
          type,
          note:  note || undefined,
          date:  new Date(date).toISOString(),
          voucher_quantity: voucherQuantity,
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      handleClose()
    },
  })

  function handleClose() {
    setActiveField(null)
    onClose()
  }

  function openField(field: Field) {
    if (field === 'amount')   draft.reset(val)
    if (field === 'category') setDraftCatId(catId)
    if (field === 'account')  setDraftAccId(accId || selectedAcc?.id || '')
    if (field === 'note')     setDraftNote(note)
    if (field === 'date')     setDraftDate(date)
    setActiveField(field)
  }

  function confirmField() {
    if (activeField === 'amount')   reset(draft.val)
    if (activeField === 'category') setCatId(draftCatId)
    if (activeField === 'account')  {
      const newAcc = accounts.find(a => a.id === draftAccId)
      if (!!(newAcc?.meal_voucher_value) !== isVoucherAccount) reset('0')
      setAccId(draftAccId)
    }
    if (activeField === 'note')     setNote(draftNote)
    if (activeField === 'date')     setDate(draftDate)
    setActiveField(null)
  }

  const canSave = amount > 0 && (accId || accounts.length > 0)

  return (
    <BottomSheet open={open} onClose={handleClose}>
      <h2 className="text-base font-semibold text-white text-center mt-1 mb-2">
        {isEdit ? 'Modifica transazione' : 'Nuova transazione'}
      </h2>

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

      {/* Campi */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">
        <FieldRow
          label={isVoucherAccount ? 'Numero buoni' : 'Importo'}
          value={
            isVoucherAccount
              ? (amount > 0 ? `${amount} buoni · ${cur} ${fmtAmount((amount * voucherValue).toFixed(2))}` : undefined)
              : (amount > 0 ? `${cur} ${fmtAmount(val)}` : undefined)
          }
          placeholder={isVoucherAccount ? 'Inserisci numero buoni' : 'Inserisci importo'}
          onClick={() => openField('amount')}
        />

        {type !== 'transfer' && (
          <FieldRow
            label="Categoria"
            value={selectedCat ? `${selectedCat.icon} ${selectedCat.name}` : undefined}
            placeholder="Seleziona categoria"
            onClick={() => openField('category')}
          />
        )}

        {accounts.length > 0 ? (
          <FieldRow
            label="Conto"
            value={selectedAcc ? `${selectedAcc.icon} ${selectedAcc.name}` : undefined}
            placeholder="Seleziona conto"
            onClick={() => openField('account')}
          />
        ) : (
          <p className="text-sm text-white/40 text-center py-2">
            Crea prima un conto dalla sezione Conti.
          </p>
        )}

        <FieldRow
          label="Note"
          value={note || undefined}
          placeholder="Opzionale…"
          onClick={() => openField('note')}
        />

        <FieldRow
          label="Data"
          value={dayjs(date).format('DD/MM/YYYY')}
          onClick={() => openField('date')}
        />

        {/* Annulla / Salva */}
        <div className="flex gap-2 mt-4 mb-2">
          <button
            onClick={handleClose}
            className="flex-1 bg-surface-overlay hover:bg-white/10 text-white/70 font-semibold rounded-xl py-3.5 transition min-h-[52px]"
          >
            Annulla
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!canSave || mutation.isPending}
            className="flex-1 bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-semibold rounded-xl py-3.5 transition min-h-[52px]"
          >
            {mutation.isPending ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Salva'}
          </button>
        </div>
      </div>

      {/* Dialog: Importo */}
      <FieldDialog
        open={activeField === 'amount'}
        title={isVoucherAccount ? 'Numero buoni' : 'Importo'}
        onCancel={() => setActiveField(null)}
        onConfirm={confirmField}
        canConfirm={draft.amount > 0}
      >
        <div className="text-center py-3">
          {isVoucherAccount ? (
            <>
              <span className="text-4xl font-bold tabular-nums text-brand">{draft.val} buoni</span>
              <p className="text-sm text-white/40 mt-1">{cur} {fmtAmount((draft.amount * voucherValue).toFixed(2))}</p>
            </>
          ) : (
            <span className={`text-4xl font-bold tabular-nums ${type === 'expense' ? 'text-expense' : type === 'income' ? 'text-income' : 'text-brand'}`}>
              {cur} {fmtAmount(draft.val)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {numpadKeys.map(k => (
            <button
              key={k}
              onClick={() => draft.press(k)}
              className="bg-surface-overlay rounded-xl py-3.5 text-white font-semibold text-xl active:bg-white/10 transition flex items-center justify-center min-h-[52px]"
            >
              {k === '⌫' ? <Delete size={20} className="text-white/60" /> : k}
            </button>
          ))}
        </div>
      </FieldDialog>

      {/* Dialog: Categoria */}
      <FieldDialog
        open={activeField === 'category'}
        title="Categoria"
        onCancel={() => setActiveField(null)}
        onConfirm={confirmField}
      >
        <div className="grid grid-cols-4 gap-2 pb-2">
          {filteredCats.map(c => (
            <button
              key={c.id}
              onClick={() => setDraftCatId(c.id === draftCatId ? '' : c.id)}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 transition ${draftCatId === c.id ? 'bg-brand/20 ring-1 ring-brand' : 'bg-surface-overlay'}`}
            >
              <span className="text-2xl">{c.icon}</span>
              <span className="text-[9px] text-white/60 leading-tight text-center line-clamp-2">{c.name}</span>
            </button>
          ))}
        </div>
      </FieldDialog>

      {/* Dialog: Conto */}
      <FieldDialog
        open={activeField === 'account'}
        title="Conto"
        onCancel={() => setActiveField(null)}
        onConfirm={confirmField}
      >
        <div className="space-y-1.5 pb-2">
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => setDraftAccId(a.id)}
              className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition ${draftAccId === a.id ? 'bg-brand/20 ring-1 ring-brand' : 'bg-surface-overlay'}`}
            >
              <span className="text-lg">{a.icon}</span>
              <span>{a.name}</span>
            </button>
          ))}
        </div>
      </FieldDialog>

      {/* Dialog: Note */}
      <FieldDialog
        open={activeField === 'note'}
        title="Note"
        onCancel={() => setActiveField(null)}
        onConfirm={confirmField}
      >
        <input
          type="text"
          autoFocus
          value={draftNote}
          onChange={e => setDraftNote(e.target.value)}
          placeholder="Opzionale…"
          className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60 mb-2"
        />
      </FieldDialog>

      {/* Dialog: Data */}
      <FieldDialog
        open={activeField === 'date'}
        title="Data"
        onCancel={() => setActiveField(null)}
        onConfirm={confirmField}
      >
        <input
          type="date"
          value={draftDate}
          max={dayjs().add(1, 'year').format('YYYY-MM-DD')}
          onChange={e => setDraftDate(e.target.value)}
          className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60 mb-2"
        />
      </FieldDialog>
    </BottomSheet>
  )
}
