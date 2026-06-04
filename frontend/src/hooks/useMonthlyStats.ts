import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useDateStore } from '../store/dateStore'
import { statsApi } from '../api/stats'

export function useMonthlyStats() {
  const date = useDateStore(s => s.date)
  const year  = dayjs(date).year()
  const month = dayjs(date).month() + 1

  const query = useQuery({
    queryKey: ['stats', year, month],
    queryFn: () => statsApi.monthly(year, month),
  })

  return { ...query, year, month }
}
