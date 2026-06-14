import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useDateStore } from '../store/dateStore'
import { useAccountStore } from '../store/accountStore'
import { statsApi } from '../api/stats'

export function useSummaryStats() {
  const { getRange } = useDateStore()
  const { start, end } = getRange()
  const selectedAccountId = useAccountStore(s => s.selectedAccountId)
  const startStr = dayjs(start).format('YYYY-MM-DD')
  const endStr = dayjs(end).format('YYYY-MM-DD')

  const query = useQuery({
    queryKey: ['stats', 'summary', startStr, endStr, selectedAccountId],
    queryFn: () => statsApi.summary(startStr, endStr, selectedAccountId),
  })

  return { ...query, start, end }
}
