import { api } from './client'

export interface CategoryStat {
  category_id: string
  name: string
  icon: string
  color: string
  total: number
}

export interface PendingItem {
  id: string
  date: string
  amount: number
  category_id: string | null
  account_id: string
  note: string | null
  is_recurring: boolean
}

export interface SummaryStats {
  income: number
  expenses: number
  pending_expenses: number
  balance: number
  by_category: CategoryStat[]
  pending_items: PendingItem[]
}

export interface MonthTrend {
  year: number
  month: number
  income: number
  expenses: number
}

export const statsApi = {
  async summary(start: string, end: string, accountId?: string | null): Promise<SummaryStats> {
    const { data } = await api.get<SummaryStats>('/stats/summary', {
      params: { start, end, account_id: accountId ?? undefined },
    })
    return data
  },
  async trend(months = 6): Promise<MonthTrend[]> {
    const { data } = await api.get<MonthTrend[]>('/stats/trend', { params: { months } })
    return data
  },
}
