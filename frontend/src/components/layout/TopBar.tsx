import { ChevronLeft, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/it'
import { useDateStore } from '../../store/dateStore'
import { useSwipe } from '../../hooks/useSwipe'

dayjs.locale('it')

export default function TopBar() {
  const { date, prev, next } = useDateStore()
  const label = dayjs(date).format('MMMM YYYY')
  const isNow = dayjs(date).isSame(dayjs(), 'month')

  const swipeHandlers = useSwipe({
    onSwipeLeft:  () => { if (!isNow) next() },
    onSwipeRight: prev,
    threshold: 60,
  })

  return (
    <header
      className="flex items-center justify-between px-2 pt-4 pb-2 sticky top-0 bg-[#0f0f13] z-10 select-none"
      {...swipeHandlers}
    >
      <button
        onClick={prev}
        className="p-2.5 rounded-full active:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <ChevronLeft size={22} className="text-white/60" />
      </button>

      <span className="text-base font-semibold capitalize tracking-wide">{label}</span>

      <button
        onClick={next}
        disabled={isNow}
        className="p-2.5 rounded-full active:bg-white/10 transition-colors disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <ChevronRight size={22} className="text-white/60" />
      </button>
    </header>
  )
}
