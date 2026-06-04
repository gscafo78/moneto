import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useDateStore } from '../store/dateStore'
import { transactionsApi } from '../api/transactions'

export function useTransactions() {
  const date  = useDateStore(s => s.date)
  const year  = dayjs(date).year()
  const month = dayjs(date).month() + 1

  const query = useQuery({
    queryKey: ['transactions', year, month],
    queryFn:  () => transactionsApi.list(year, month),
  })

  return { ...query, year, month }
}
