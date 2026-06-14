import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { MonthTrend } from '../../api/stats'
import { useCurrency } from '../../hooks/useCurrency'

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

interface Props {
  data: MonthTrend[]
}

export default function TrendChart({ data }: Props) {
  const cur = useCurrency()

  const chartData = data.map(m => ({
    label: `${MONTH_LABELS[m.month - 1]} '${String(m.year).slice(2)}`,
    Entrate: m.income,
    Uscite: m.expenses,
  }))

  return (
    <div className="bg-surface rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-white/80 mb-3">Entrate e uscite mensili</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData}>
          <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            contentStyle={{
              background: '#22222e',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              color: '#fff',
              fontSize: 13,
            }}
            formatter={(v: number) => `${cur} ${v.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }} />
          <Bar dataKey="Entrate" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Uscite" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
