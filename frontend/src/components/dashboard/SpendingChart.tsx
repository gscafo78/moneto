import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { CategoryStat } from '../../api/stats'

interface Props {
  data: CategoryStat[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export default function SpendingChart({ data, selectedId, onSelect }: Props) {
  if (data.length === 0) return null

  const total = data.reduce((s, c) => s + c.total, 0)

  function handleClick(entry: CategoryStat) {
    onSelect(selectedId === entry.category_id ? null : entry.category_id)
  }

  return (
    <div className="px-4 py-2">
      <div className="bg-surface rounded-2xl py-4">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              onClick={(_: unknown, __: unknown, e: React.MouseEvent) => {
                e.stopPropagation()
              }}
            >
              {data.map(entry => (
                <Cell
                  key={entry.category_id}
                  fill={entry.color}
                  opacity={selectedId && selectedId !== entry.category_id ? 0.35 : 1}
                  stroke="transparent"
                  cursor="pointer"
                  onClick={() => handleClick(entry)}
                />
              ))}
            </Pie>

            {/* Label centrale */}
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
              <tspan x="50%" dy="-0.5em" fill="rgba(255,255,255,0.4)" fontSize={11}>
                Uscite
              </tspan>
              <tspan x="50%" dy="1.4em" fill="white" fontSize={17} fontWeight="600">
                {`€ ${total.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`}
              </tspan>
            </text>

            <Tooltip
              contentStyle={{
                background: '#22222e',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
              }}
              formatter={(v: number) => [`€ ${v.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, '']}
              itemStyle={{ color: '#fff' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
