import { api } from './client'

export interface CategoryStat {
  category_id: string
  name: string
  icon: string
  color: string
  total: number
}

export interface MonthlySummary {
  income: number
  expenses: number
  balance: number
  by_category: CategoryStat[]
}

export interface MonthTrend {
  year: number
  month: number
  income: number
  expenses: number
}

export const statsApi = {
  async monthly(year: number, month: number): Promise<MonthlySummary> {
    const { data } = await api.get<MonthlySummary>('/stats/monthly', { params: { year, month } })
    return data
  },
  async trend(months = 6): Promise<MonthTrend[]> {
    const { data } = await api.get<MonthTrend[]>('/stats/trend', { params: { months } })
    return data
  },
}
