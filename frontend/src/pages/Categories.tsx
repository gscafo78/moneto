import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { categoriesApi, type Category } from '../api/categories'
import CategoryGrid from '../components/categories/CategoryGrid'
import AddCategorySheet from '../components/categories/AddCategorySheet'

export default function Categories() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn:  categoriesApi.list,
  })

  const expenses = categories.filter(c => c.type === 'expense')
  const incomes  = categories.filter(c => c.type === 'income')

  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [editCategory,  setEditCategory]  = useState<Category | undefined>()
  const [defaultType,   setDefaultType]   = useState<'expense' | 'income'>('expense')

  function openAdd(type: 'expense' | 'income') {
    setEditCategory(undefined)
    setDefaultType(type)
    setSheetOpen(true)
  }

  function openEdit(c: Category) {
    setEditCategory(c)
    setSheetOpen(true)
  }

  return (
    <>
      <div className="px-4 py-4 space-y-6">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && (
          <>
            {/* Spese */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-expense uppercase tracking-widest">Spese</span>
                <div className="flex-1 h-px bg-expense/20" />
              </div>
              <CategoryGrid
                categories={expenses}
                onEdit={openEdit}
                onAdd={() => openAdd('expense')}
              />
            </section>

            {/* Entrate */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-income uppercase tracking-widest">Entrate</span>
                <div className="flex-1 h-px bg-income/20" />
              </div>
              <CategoryGrid
                categories={incomes}
                onEdit={openEdit}
                onAdd={() => openAdd('income')}
              />
            </section>
          </>
        )}
      </div>

      <AddCategorySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        category={editCategory}
        defaultType={defaultType}
      />
    </>
  )
}
