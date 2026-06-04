import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import BottomSheet from '../ui/BottomSheet'
import EmojiPicker from '../ui/EmojiPicker'
import ColorPicker from '../ui/ColorPicker'
import { categoriesApi, type Category } from '../../api/categories'

interface Props {
  open: boolean
  onClose: () => void
  category?: Category         // edit mode
  defaultType?: 'expense' | 'income'
}

export default function AddCategorySheet({ open, onClose, category, defaultType = 'expense' }: Props) {
  const qc = useQueryClient()
  const isEdit    = !!category
  const isDefault = category?.is_default ?? false

  const [name,  setName]  = useState('')
  const [icon,  setIcon]  = useState('📦')
  const [color, setColor] = useState('#6366f1')
  const [type,  setType]  = useState<'expense' | 'income'>(defaultType)
  const [tab,   setTab]   = useState<'emoji' | 'color' | null>(null)

  useEffect(() => {
    if (category) {
      setName(category.name); setIcon(category.icon)
      setColor(category.color); setType(category.type)
    } else {
      setName(''); setIcon('📦'); setColor('#6366f1'); setType(defaultType)
    }
    setTab(null)
  }, [category, defaultType, open])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['categories'] })

  const createMut = useMutation({
    mutationFn: () => categoriesApi.create({ name, icon, color, type }),
    onSuccess: () => { invalidate(); onClose() },
  })

  const updateMut = useMutation({
    mutationFn: () => categoriesApi.update(category!.id, { name, icon, color }),
    onSuccess: () => { invalidate(); onClose() },
  })

  const deleteMut = useMutation({
    mutationFn: () => categoriesApi.remove(category!.id),
    onSuccess: () => { invalidate(); onClose() },
  })

  const isPending = createMut.isPending || updateMut.isPending
  const error     = (createMut.error || updateMut.error || deleteMut.error) as any

  function handleSave() {
    if (!name.trim()) return
    isEdit ? updateMut.mutate() : createMut.mutate()
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-6 pt-2 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? 'Modifica categoria' : 'Nuova categoria'}
          </h2>
          {isEdit && !isDefault && (
            <button
              onClick={() => { if (confirm('Eliminare questa categoria?')) deleteMut.mutate() }}
              className="p-2 text-expense/70 hover:text-expense transition"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {isDefault && (
          <p className="text-xs text-white/30 bg-surface-overlay rounded-lg px-3 py-2">
            Categoria predefinita — puoi modificare nome, icona e colore.
          </p>
        )}

        {/* Preview */}
        <div className="flex items-center gap-3 bg-surface-overlay rounded-xl p-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: color + '33' }}>{icon}</div>
          <div>
            <p className="text-sm font-semibold text-white">{name || 'Nome categoria'}</p>
            <p className="text-xs text-white/40">{type === 'expense' ? 'Spesa' : 'Entrata'}</p>
          </div>
        </div>

        {/* Tipo (solo creazione) */}
        {!isEdit && (
          <div className="flex gap-1 bg-surface rounded-xl p-1">
            {(['expense','income'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${type === t
                  ? t === 'expense' ? 'bg-expense text-white' : 'bg-income text-white'
                  : 'text-white/40'}`}>
                {t === 'expense' ? 'Spesa' : 'Entrata'}
              </button>
            ))}
          </div>
        )}

        {/* Nome */}
        <div>
          <label className="text-xs text-white/40 uppercase tracking-wide mb-1.5 block">Nome</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Es. Ristorante"
            className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60" />
        </div>

        {/* Icona / Colore */}
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab(tab === 'emoji' ? null : 'emoji')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${tab === 'emoji' ? 'bg-brand text-white' : 'bg-surface-overlay text-white/60'}`}>
            <span className="text-lg">{icon}</span> Icona
          </button>
          <button type="button" onClick={() => setTab(tab === 'color' ? null : 'color')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${tab === 'color' ? 'bg-brand text-white' : 'bg-surface-overlay text-white/60'}`}>
            <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: color }} />
            Colore
          </button>
        </div>

        {tab === 'emoji' && <EmojiPicker value={icon} onChange={e => { setIcon(e); setTab(null) }} />}
        {tab === 'color' && <ColorPicker value={color} onChange={c => { setColor(c); setTab(null) }} />}

        {error && <p className="text-sm text-expense text-center">{error?.response?.data?.detail ?? 'Errore'}</p>}

        <button onClick={handleSave} disabled={!name.trim() || isPending}
          className="w-full bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-semibold rounded-xl py-3.5 transition">
          {isPending ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea categoria'}
        </button>
      </div>
    </BottomSheet>
  )
}
