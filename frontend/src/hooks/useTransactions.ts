import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useDateStore } from '../store/dateStore'
import { transactionsApi } from '../api/transactions'

export function useTransactions() {
  const { getRange } = useDateStore()
  const { start, end } = getRange()
  const startStr = dayjs(start).format('YYYY-MM-DD')
  const endStr = dayjs(end).format('YYYY-MM-DD')
  const year = dayjs(start).year()
  const month = dayjs(start).month() + 1

  const query = useQuery({
    queryKey: ['transactions', startStr, endStr],
    queryFn: () => transactionsApi.listRange(startStr, endStr),
  })

  return { ...query, start, end, year, month }
}
