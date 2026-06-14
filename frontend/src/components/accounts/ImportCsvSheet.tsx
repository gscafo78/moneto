import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import BottomSheet from '../ui/BottomSheet'
import { categoriesApi } from '../../api/categories'
import { importApi, type ImportRowPreview } from '../../api/csvImport'
import type { Account } from '../../api/accounts'
import { currencySymbol } from '../../utils/currency'

interface Props {
  open: boolean
  onClose: () => void
  account?: Account
}

interface Row extends ImportRowPreview {
  include: boolean
  category_id: string | null
}

export default function ImportCsvSheet({ open, onClose, account }: Props) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<Row[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [step, setStep] = useState<'pick' | 'preview'>('pick')
  const [summary, setSummary] = useState<{ imported: number; skipped_duplicates: number } | null>(null)

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })

  const previewMut = useMutation({
    mutationFn: (file: File) => importApi.previewMediobanca(account!.id, file),
    onSuccess: (data) => {
      setRows(data.rows.map(r => ({
        ...r,
        include: !r.is_duplicate,
        category_id: r.suggested_category_id,
      })))
      setWarnings(data.warnings)
      setStep('preview')
    },
  })

  const confirmMut = useMutation({
    mutationFn: () => importApi.confirmMediobanca(account!.id, rows.filter(r => r.include).map(r => ({
      date: r.date,
      description: r.description,
      amount: r.amount,
      type: r.type,
      category_id: r.category_id,
      hash: r.hash,
    }))),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      setSummary(data)
    },
  })

  function reset() {
    setRows([])
    setWarnings([])
    setStep('pick')
    setSummary(null)
    previewMut.reset()
    confirmMut.reset()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) previewMut.mutate(file)
  }

  function toggleInclude(hash: string) {
    setRows(rs => rs.map(r => r.hash === hash ? { ...r, include: !r.include } : r))
  }

  function setCategory(hash: string, categoryId: string) {
    setRows(rs => rs.map(r => r.hash === hash ? { ...r, category_id: categoryId || null } : r))
  }

  const includedCount = rows.filter(r => r.include).length
  const cur = currencySymbol(account?.currency)

  return (
    <BottomSheet open={open} onClose={handleClose}>
      <div className="px-4 pb-6 pt-2 flex flex-col gap-4 min-h-0">
        <h2 className="text-base font-semibold text-white">
          Importa estratto conto (Mediobanca)
        </h2>

        {summary && (
          <div className="bg-surface-overlay rounded-xl p-4 text-sm text-white space-y-1">
            <p>✅ Importate <strong>{summary.imported}</strong> transazioni</p>
            {summary.skipped_duplicates > 0 && (
              <p className="text-white/50">Ignorate {summary.skipped_duplicates} righe già importate</p>
            )}
            <button
              onClick={handleClose}
              className="w-full mt-3 bg-brand hover:bg-brand-dark text-white font-semibold rounded-xl py-3 transition"
            >
              Chiudi
            </button>
          </div>
        )}

        {!summary && step === 'pick' && (
          <div className="space-y-3">
            <p className="text-sm text-white/50">
              Carica il file CSV dell'estratto conto Mediobanca Premier per importare le transazioni in {account?.name}.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-file-input"
            />
            <label
              htmlFor="csv-file-input"
              className="w-full flex items-center justify-center gap-2 bg-surface-overlay border border-dashed border-white/10 rounded-xl py-6 text-sm text-white/60 hover:text-white/80 transition cursor-pointer"
            >
              <Upload size={18} />
              {previewMut.isPending ? 'Lettura file…' : 'Scegli file CSV'}
            </label>
            {previewMut.isError && (
              <p className="text-xs text-expense">Errore durante la lettura del file. Verifica il formato.</p>
            )}
          </div>
        )}

        {!summary && step === 'preview' && (
          <>
            {warnings.length > 0 && (
              <div className="bg-surface-overlay rounded-xl p-3 text-xs text-white/50 space-y-1 max-h-24 overflow-y-auto">
                {warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            )}

            <p className="text-sm text-white/50">{includedCount} transazioni selezionate su {rows.length}</p>

            <div className="space-y-2 max-h-[45dvh] overflow-y-auto -mx-1 px-1">
              {rows.map(r => (
                <div key={r.hash} className={`bg-surface-overlay rounded-xl p-3 space-y-2 ${!r.include ? 'opacity-40' : ''}`}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={() => toggleInclude(r.hash)}
                      className="mt-1 w-4 h-4 accent-brand flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{r.description}</p>
                      <p className="text-xs text-white/40">{new Date(r.date).toLocaleDateString('it-IT')}</p>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums flex-shrink-0 ${r.type === 'income' ? 'text-income' : 'text-expense'}`}>
                      {r.type === 'income' ? '+' : '-'}{cur} {r.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {r.is_duplicate && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">Duplicato</span>
                    )}
                    {r.currency_mismatch && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">Valuta diversa ({r.currency})</span>
                    )}
                    <select
                      value={r.category_id ?? ''}
                      onChange={e => setCategory(r.hash, e.target.value)}
                      className="ml-auto bg-surface border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand/60"
                    >
                      <option value="">Nessuna categoria</option>
                      {categories.filter(c => c.type === r.type).map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => confirmMut.mutate()}
              disabled={includedCount === 0 || confirmMut.isPending}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-semibold rounded-xl py-3.5 transition"
            >
              {confirmMut.isPending ? 'Importazione…' : `Importa ${includedCount} transazioni`}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
