import { create } from 'zustand'
import dayjs from 'dayjs'

interface DateState {
  date: Date
  prev: () => void
  next: () => void
}

export const useDateStore = create<DateState>((set, get) => ({
  date: new Date(),
  prev: () => set({ date: dayjs(get().date).subtract(1, 'month').toDate() }),
  next: () => {
    const next = dayjs(get().date).add(1, 'month')
    if (!next.isAfter(dayjs(), 'month'))
      set({ date: next.toDate() })
  },
}))
