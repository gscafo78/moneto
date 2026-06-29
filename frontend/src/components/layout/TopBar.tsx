import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarRange, Settings, LogOut } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/it'
import { useDateStore } from '../../store/dateStore'
import { useSwipe } from '../../hooks/useSwipe'
import { useAuthStore } from '../../store/authStore'
import PeriodPanel from './PeriodPanel'

dayjs.locale('it')

export default function TopBar() {
  const { mode, date, prev, next, getRange } = useDateStore()
  const { user, logout } = useAuthStore()
  const { start, end } = getRange()

  let label: string
  if (mode === 'month') label = dayjs(date).format('MMMM YYYY')
  else label = `${dayjs(start).format('D MMM')} - ${dayjs(end).format('D MMM')}`

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [periodOpen, setPeriodOpen] = useState(false)
  const periodRef = useRef<HTMLDivElement>(null)

  const swipeHandlers = useSwipe({
    onSwipeLeft:  next,
    onSwipeRight: prev,
    threshold: 60,
  })

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setPeriodOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <header
      className="flex items-center justify-between gap-2 px-2 pt-4 pb-2 sticky top-0 bg-[#0f0f13] z-10 select-none safe-top"
      {...swipeHandlers}
    >
      <button
        onClick={prev}
        disabled={mode === 'custom'}
        className="p-2.5 rounded-full active:bg-white/10 transition-colors disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <ChevronLeft size={22} className="text-white/60" />
      </button>

      <span className="text-base font-semibold capitalize tracking-wide">{label}</span>

      <div className="flex items-center">
        <button
          onClick={next}
          disabled={mode === 'custom'}
          className="p-2.5 rounded-full active:bg-white/10 transition-colors disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ChevronRight size={22} className="text-white/60" />
        </button>

        <div className="relative" ref={periodRef}>
          <button
            onClick={() => setPeriodOpen(v => !v)}
            className="p-2.5 rounded-full active:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-haspopup="true"
            aria-expanded={periodOpen}
          >
            <CalendarRange size={20} className="text-white/60" />
          </button>
          {periodOpen && <PeriodPanel onClose={() => setPeriodOpen(false)} />}
        </div>

        {/* Menu utente — unico punto di accesso alle Impostazioni */}
        <div className="relative ml-2" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-brand/20 text-brand text-sm font-semibold hover:bg-brand/30 transition-colors"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-surface-overlay border border-white/10 rounded-xl shadow-lg py-1 z-50">
              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
              >
                <Settings size={16} className="flex-shrink-0" />
                Impostazioni
              </Link>
              <div className="my-1 border-t border-white/10" />
              <button
                onClick={() => { setMenuOpen(false); logout() }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-expense hover:bg-white/5 transition-colors"
              >
                <LogOut size={16} className="flex-shrink-0" />
                Esci
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
