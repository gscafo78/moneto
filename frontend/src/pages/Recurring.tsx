import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Repeat } from 'lucide-react'
import { recurringApi, type RecurringTransaction } from '../api/recurring'
import { categoriesApi } from '../api/categories'
import RecurringCard from '../components/recurring/RecurringCard'
import AddRecurringSheet from '../components/recurring/AddRecurringSheet'

export default function Recurring() {
  const { data: recurring = [], isLoading } = useQuery({
    queryKey: ['recurring'],
    queryFn: recurringApi.list,
  })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing]     = useState<RecurringTransaction | undefined>()

  function openAdd()  { setEditing(undefined); setSheetOpen(true) }
  function openEdit(r: RecurringTransaction) { setEditing(r); setSheetOpen(true) }

  return (
    <>
      <div className="px-4 py-4 space-y-3">
        {isLoading && (
          <div className="text-center py-12 text-white/30 text-sm">Caricamento…</div>
        )}

        {!isLoading && recurring.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
            <Repeat size={40} strokeWidth={1.2} />
            <p className="text-sm">Nessuna spesa o entrata ricorrente</p>
            <p className="text-xs">Tocca "+ Nuova ricorrenza" per aggiungerne una</p>
          </div>
        )}

        {!isLoading && recurring.length > 0 && (
          <div className="space-y-2">
            {recurring.map(r => (
              <RecurringCard
                key={r.id}
                recurring={r}
                category={categories.find(c => c.id === r.category_id)}
                onEdit={openEdit}
              />
            ))}
          </div>
        )}

        <button
          onClick={openAdd}
          className="w-full flex items-center justify-center gap-2 bg-surface-overlay border border-dashed border-white/10 rounded-xl py-4 text-sm text-white/40 hover:text-white/60 transition active:bg-surface"
        >
          + Nuova ricorrenza
        </button>
      </div>

      <AddRecurringSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        recurring={editing}
      />
    </>
  )
}
