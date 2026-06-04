import { Plus, Lock } from 'lucide-react'
import type { Category } from '../../api/categories'

interface Props {
  categories: Category[]
  onEdit: (c: Category) => void
  onAdd:  () => void
}

export default function CategoryGrid({ categories, onEdit, onAdd }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map(c => (
        <button
          key={c.id}
          onClick={() => onEdit(c)}
          className="flex flex-col items-center gap-1.5 bg-surface rounded-xl p-3 active:bg-surface-overlay transition relative"
        >
          {c.is_default && (
            <div className="absolute top-1.5 right-1.5">
              <Lock size={8} className="text-white/20" />
            </div>
          )}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ backgroundColor: c.color + '22' }}>
            {c.icon}
          </div>
          <span className="text-[10px] text-white/60 leading-tight text-center line-clamp-2">{c.name}</span>
        </button>
      ))}

      {/* Add button */}
      <button
        onClick={onAdd}
        className="flex flex-col items-center gap-1.5 bg-surface-overlay rounded-xl p-3 border border-dashed border-white/10 active:bg-surface transition"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5">
          <Plus size={20} className="text-white/40" />
        </div>
        <span className="text-[10px] text-white/30">Nuova</span>
      </button>
    </div>
  )
}
