import { useState } from 'react'
import dayjs from 'dayjs'
import { useDateStore, type PeriodMode } from '../../store/dateStore'

const MODES: { key: PeriodMode; label: string }[] = [
  { key: 'month',  label: 'Mese corrente' },
  { key: 'week',   label: 'Settimana corrente' },
  { key: 'custom', label: 'Intervallo personalizzato' },
]

export default function PeriodPanel({ onClose }: { onClose: () => void }) {
  const { mode, setMode, customStart, customEnd, setCustomRange, getRange } = useDateStore()
  const range = getRange()
  const [from, setFrom] = useState(dayjs(customStart ?? range.start).format('YYYY-MM-DD'))
  const [to, setTo]     = useState(dayjs(customEnd ?? range.end).format('YYYY-MM-DD'))

  function selectMode(m: PeriodMode) {
    if (m !== 'custom') {
      setMode(m)
      onClose()
    } else {
      setMode(m)
    }
  }

  function applyRange() {
    if (!from || !to) return
    setCustomRange(dayjs(from).startOf('day').toDate(), dayjs(to).endOf('day').toDate())
    onClose()
  }

  return (
    <div className="absolute right-0 top-full mt-1.5 w-64 bg-surface-overlay border border-white/10 rounded-xl shadow-lg p-2 z-50">
      <div className="space-y-1">
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => selectMode(m.key)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.key ? 'bg-brand/10 text-brand' : 'text-white/70 hover:bg-white/5'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'custom' && (
        <div className="mt-2 pt-2 border-t border-white/10 space-y-2 px-1">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">Da</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={e => setFrom(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide mb-1 block">A</label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={e => setTo(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60"
            />
          </div>
          <button
            onClick={applyRange}
            className="w-full bg-brand hover:bg-brand-dark text-white font-semibold rounded-lg py-2 text-sm transition"
          >
            Applica
          </button>
        </div>
      )}
    </div>
  )
}
