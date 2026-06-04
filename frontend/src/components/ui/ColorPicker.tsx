const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#10b981', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#ec4899', '#f472b6',
]

interface Props {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-8 h-8 rounded-full transition active:scale-90 flex items-center justify-center"
          style={{ backgroundColor: c }}
        >
          {value === c && (
            <span className="text-white text-sm font-bold">✓</span>
          )}
        </button>
      ))}
    </div>
  )
}
