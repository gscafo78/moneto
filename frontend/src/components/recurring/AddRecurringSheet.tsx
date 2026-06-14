import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Delete, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import BottomSheet from '../ui/BottomSheet'
import FieldRow from '../ui/FieldRow'
import FieldDialog from '../ui/FieldDialog'
import { useNumpad, NUMPAD_KEYS } from '../../hooks/useNumpad'
import { recurringApi, type RecurringFrequency, type RecurringTransaction } from '../../api/recurring'
import { categoriesApi } from '../../api/categories'
import { accountsApi } from '../../api/accounts'
import { useCurrency } from '../../hooks/useCurrency'

interface Props {
  open: boolean
  onClose: () => void
  recurring?: RecurringTransaction   // se presente → modalità edit
}

type Field = 'amount' | 'category' | 'account' | 'description' | 'frequency' | 'startDate' | 'endDate' | null

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Ogni settimana',
  monthly: 'Ogni mese',
  bimonthly: 'Ogni 2 mesi',
  quarterly: 'Ogni 3 mesi',
}

function fmtAmount(val: string) {
  return parseFloat(val || '0').toLocaleString('it-IT', {
    minimumFractionDigits: val.includes('.') ? Math.min((val.split('.')[1]?.length ?? 0), 2) : 0,
    maximumFractionDigits: 2,
  })
}

export default function AddRecurringSheet({ open, onClose, recurring }: Props) {
  const qc = useQueryClient()
  const cur = useCurrency()
  const isEdit = !!recurring
  const { val, amount, press, reset } = useNumpad()

  const [type, setType]           = useState<'expense' | 'income'>('expense')
  const [catId, setCatId]         = useState<string>('')
  const [accId, setAccId]         = useState<string>('')
  const [description, setDesc]    = useState('')
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly')
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [hasEndDate, setHasEndDate] = useState(false)
  const [endDate, setEndDate]     = useState(dayjs().add(1, 'year').format('YYYY-MM-DD'))

  const [activeField, setActiveField] = useState<Field>(null)
  const draft = useNumpad()
  const [draftCatId, setDraftCatId]       = useState('')
  const [draftAccId, setDraftAccId]       = useState('')
  const [draftDesc, setDraftDesc]         = useState('')
  const [draftFrequency, setDraftFrequency] = useState<RecurringFrequency>('monthly')
  const [draftStartDate, setDraftStartDate] = useState('')
  const [draftHasEndDate, setDraftHasEndDate] = useState(false)
  const [draftEndDate, setDraftEndDate]     = useState('')

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const { data: accounts = [] }   = useQuery({ queryKey: ['accounts'],   queryFn: accountsApi.list })

  const filteredCats = categories.filter(c => c.type === type)
  const selectedCat = categories.find(c => c.id === catId)
  const selectedAcc = accounts.find(a => a.id === accId) ?? accounts[0]

  // Precompila in modalità edit
  useEffect(() => {
    if (recurring) {
      setType(recurring.type)
      setCatId(recurring.category_id ?? '')
      setAccId(recurring.account_id)
      setDesc(recurring.description ?? '')
      setFrequency(recurring.frequency)
      setStartDate(recurring.start_date)
      setHasEndDate(!!recurring.end_date)
      setEndDate(recurring.end_date ?? dayjs().add(1, 'year').format('YYYY-MM-DD'))
      reset(String(recurring.amount))
    } else {
      setType('expense'); setCatId(''); setAccId(''); setDesc('')
      setFrequency('monthly')
      setStartDate(dayjs().format('YYYY-MM-DD'))
      setHasEndDate(false)
      setEndDate(dayjs().add(1, 'year').format('YYYY-MM-DD'))
      reset()
    }
    setActiveField(null)
  }, [recurring, open])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['recurring'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
  }

  const createMut = useMutation({
    mutationFn: () => recurringApi.create({
      account_id: accId || accounts[0]?.id,
      category_id: catId || undefined,
      amount,
      type,
      description: description || undefined,
      frequency,
      start_date: startDate,
      end_date: hasEndDate ? endDate : undefined,
    }),
    onSuccess: () => { invalidate(); onClose() },
  })

  const updateMut = useMutation({
    mutationFn: () => recurringApi.update(recurring!.id, {
      account_id: accId || accounts[0]?.id,
      category_id: catId || undefined,
      amount,
      description: description || undefined,
      end_date: hasEndDate ? endDate : undefined,
    }),
    onSuccess: () => { invalidate(); onClose() },
  })

  const deleteMut = useMutation({
    mutationFn: () => recurringApi.remove(recurring!.id),
    onSuccess: () => { invalidate(); onClose() },
  })

  const isPending = createMut.isPending || updateMut.isPending
  const canSave = amount > 0 && (accId || accounts.length > 0)

  function handleSave() {
    isEdit ? updateMut.mutate() : createMut.mutate()
  }

  function openField(field: Field) {
    if (field === 'amount')      draft.reset(val)
    if (field === 'category')    setDraftCatId(catId)
    if (field === 'account')     setDraftAccId(accId || selectedAcc?.id || '')
    if (field === 'description') setDraftDesc(description)
    if (field === 'frequency')   setDraftFrequency(frequency)
    if (field === 'startDate')   setDraftStartDate(startDate)
    if (field === 'endDate')     { setDraftHasEndDate(hasEndDate); setDraftEndDate(endDate) }
    setActiveField(field)
  }

  function confirmField() {
    if (activeField === 'amount')      reset(draft.val)
    if (activeField === 'category')    setCatId(draftCatId)
    if (activeField === 'account')     setAccId(draftAccId)
    if (activeField === 'description') setDesc(draftDesc)
    if (activeField === 'frequency')   setFrequency(draftFrequency)
    if (activeField === 'startDate')   setStartDate(draftStartDate)
    if (activeField === 'endDate')     { setHasEndDate(draftHasEndDate); setEndDate(draftEndDate) }
    setActiveField(null)
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      {/* Tipo */}
      <div className="flex items-center justify-between mx-4 mt-2 mb-3 flex-shrink-0">
        <div className="flex gap-1 bg-surface-overlay rounded-xl p-1 flex-1">
          {(['expense','income'] as const).map(t => (
            <button
              key={t}
              disabled={isEdit}
              onClick={() => { setType(t); setCatId('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${type === t
                ? t === 'expense' ? 'bg-expense text-white' : 'bg-income text-white'
                : 'text-white/40'}`}
            >
              {t === 'expense' ? 'Spesa' : 'Entrata'}
            </button>
          ))}
        </div>
        {isEdit && (
          <button
            onClick={() => { if (confirm('Eliminare questa ricorrenza?')) deleteMut.mutate() }}
            className="ml-2 p-2 text-expense/70 hover:text-expense transition"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Campi */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">
        <FieldRow
          label="Importo"
          value={amount > 0 ? `${cur} ${fmtAmount(val)}` : undefined}
          placeholder="Inserisci importo"
          onClick={() => openField('amount')}
        />

        <FieldRow
          label="Categoria"
          value={selectedCat ? `${selectedCat.icon} ${selectedCat.name}` : undefined}
          placeholder="Seleziona categoria"
          onClick={() => openField('category')}
        />

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
          label="Descrizione"
          value={description || undefined}
          placeholder="Es. Netflix, Affitto, Rata auto…"
          onClick={() => openField('description')}
        />

        <FieldRow
          label="Frequenza"
          value={FREQUENCY_LABELS[frequency]}
          onClick={() => openField('frequency')}
          disabled={isEdit}
        />

        <FieldRow
          label="Data di addebito"
          value={dayjs(startDate).format('DD/MM/YYYY')}
          onClick={() => openField('startDate')}
          disabled={isEdit}
        />

        <FieldRow
          label="Fine ricorrenza"
          value={hasEndDate ? dayjs(endDate).format('DD/MM/YYYY') : 'Nessuna scadenza'}
          onClick={() => openField('endDate')}
        />

        {/* Annulla / Salva */}
        <div className="flex gap-2 mt-4 mb-2">
          <button
            onClick={onClose}
            className="flex-1 bg-surface-overlay hover:bg-white/10 text-white/70 font-semibold rounded-xl py-3.5 transition min-h-[52px]"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || isPending}
            className="flex-1 bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-semibold rounded-xl py-3.5 transition min-h-[52px]"
          >
            {isPending ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea ricorrenza'}
          </button>
        </div>
      </div>

      {/* Dialog: Importo */}
      <FieldDialog
        open={activeField === 'amount'}
        title="Importo"
        onCancel={() => setActiveField(null)}
        onConfirm={confirmField}
        canConfirm={draft.amount > 0}
      >
        <div className="text-center py-3">
          <span className={`text-4xl font-bold tabular-nums ${type === 'expense' ? 'text-expense' : 'text-income'}`}>
            {cur} {fmtAmount(draft.val)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {NUMPAD_KEYS.map(k => (
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

      {/* Dialog: Descrizione */}
      <FieldDialog
        open={activeField === 'description'}
        title="Descrizione"
        onCancel={() => setActiveField(null)}
        onConfirm={confirmField}
      >
        <input
          type="text"
          autoFocus
          value={draftDesc}
          onChange={e => setDraftDesc(e.target.value)}
          placeholder="Es. Netflix, Affitto, Rata auto…"
          className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60 mb-2"
        />
      </FieldDialog>

      {/* Dialog: Frequenza */}
      <FieldDialog
        open={activeField === 'frequency'}
        title="Frequenza"
        onCancel={() => setActiveField(null)}
        onConfirm={confirmField}
      >
        <div className="grid grid-cols-2 gap-2 pb-2">
          {(Object.keys(FREQUENCY_LABELS) as RecurringFrequency[]).map(f => (
            <button
              key={f}
              onClick={() => setDraftFrequency(f)}
              className={`py-2.5 rounded-xl text-sm font-medium transition ${draftFrequency === f ? 'bg-brand/20 ring-1 ring-brand text-white' : 'bg-surface-overlay text-white/60'}`}
            >
              {FREQUENCY_LABELS[f]}
            </button>
          ))}
        </div>
      </FieldDialog>

      {/* Dialog: Data di addebito */}
      <FieldDialog
        open={activeField === 'startDate'}
        title="Data di addebito"
        onCancel={() => setActiveField(null)}
        onConfirm={confirmField}
      >
        <input
          type="date"
          value={draftStartDate}
          onChange={e => setDraftStartDate(e.target.value)}
          className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60"
        />
        <p className="text-[11px] text-white/30 mt-1.5 mb-2">
          Se cade in un giorno festivo o nel weekend, l'addebito viene spostato al primo
          giorno lavorativo successivo.
        </p>
      </FieldDialog>

      {/* Dialog: Fine ricorrenza */}
      <FieldDialog
        open={activeField === 'endDate'}
        title="Fine ricorrenza"
        onCancel={() => setActiveField(null)}
        onConfirm={confirmField}
      >
        <label className="flex items-center gap-2 text-sm text-white/70 mb-2">
          <input
            type="checkbox"
            checked={draftHasEndDate}
            onChange={e => setDraftHasEndDate(e.target.checked)}
            className="w-4 h-4 rounded accent-brand"
          />
          Termina in una data specifica
        </label>
        {draftHasEndDate ? (
          <input
            type="date"
            value={draftEndDate}
            min={draftStartDate}
            onChange={e => setDraftEndDate(e.target.value)}
            className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60 mb-2"
          />
        ) : (
          <p className="text-xs text-white/40 mb-2">Si ripeterà finché non la interrompi.</p>
        )}
      </FieldDialog>
    </BottomSheet>
  )
}
