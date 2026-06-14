import { create } from 'zustand'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

export type PeriodMode = 'month' | 'week' | 'custom'

interface DateState {
  mode: PeriodMode
  date: Date
  customStart: Date | null
  customEnd: Date | null
  setMode: (mode: PeriodMode) => void
  prev: () => void
  next: () => void
  setCustomRange: (start: Date, end: Date) => void
  isAtPresent: () => boolean
  getRange: () => { start: Date; end: Date }
}

export const useDateStore = create<DateState>((set, get) => ({
  mode: 'month',
  date: new Date(),
  customStart: null,
  customEnd: null,

  setMode: (mode) => set({ mode, date: new Date() }),

  prev: () => {
    const { mode, date } = get()
    if (mode === 'week') set({ date: dayjs(date).subtract(1, 'week').toDate() })
    else if (mode === 'month') set({ date: dayjs(date).subtract(1, 'month').toDate() })
  },

  next: () => {
    const { mode, date } = get()
    if (mode === 'week') {
      const nxt = dayjs(date).add(1, 'week')
      if (!nxt.startOf('isoWeek').isAfter(dayjs().startOf('isoWeek'))) set({ date: nxt.toDate() })
    } else if (mode === 'month') {
      const nxt = dayjs(date).add(1, 'month')
      if (!nxt.isAfter(dayjs(), 'month')) set({ date: nxt.toDate() })
    }
  },

  setCustomRange: (start, end) => set({ mode: 'custom', customStart: start, customEnd: end }),

  isAtPresent: () => {
    const { mode, date } = get()
    if (mode === 'month') return dayjs(date).isSame(dayjs(), 'month')
    if (mode === 'week') return dayjs(date).startOf('isoWeek').isSame(dayjs().startOf('isoWeek'), 'day')
    return true
  },

  getRange: () => {
    const { mode, date, customStart, customEnd } = get()
    if (mode === 'week') {
      return { start: dayjs(date).startOf('isoWeek').toDate(), end: dayjs(date).endOf('isoWeek').toDate() }
    }
    if (mode === 'custom' && customStart && customEnd) {
      return { start: customStart, end: customEnd }
    }
    return { start: dayjs(date).startOf('month').toDate(), end: dayjs(date).endOf('month').toDate() }
  },
}))
