import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useCurrency } from '../../hooks/useCurrency'

export interface BalancePoint {
  label: string
  balance: number
}

interface Props {
  data: BalancePoint[]
}

export default function BalanceTrendChart({ data }: Props) {
  const cur = useCurrency()

  return (
    <div className="bg-surface rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-white/80 mb-3">Saldo nel tempo</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
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
          <Line type="monotone" dataKey="balance" name="Saldo" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
