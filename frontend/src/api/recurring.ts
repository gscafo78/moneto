import { api } from './client'

export type RecurringFrequency = 'weekly' | 'monthly' | 'bimonthly' | 'quarterly'

export interface RecurringTransaction {
  id: string
  account_id: string
  category_id: string | null
  amount: number
  type: 'expense' | 'income'
  description: string | null
  frequency: RecurringFrequency
  start_date: string
  end_date: string | null
  is_active: boolean
  next_occurrence: string | null
}

export interface RecurringCreate {
  account_id: string
  category_id?: string
  amount: number
  type: 'expense' | 'income'
  description?: string
  frequency: RecurringFrequency
  start_date: string
  end_date?: string
}

export interface RecurringUpdate {
  account_id?: string
  category_id?: string
  amount?: number
  description?: string
  end_date?: string
  is_active?: boolean
}

export const recurringApi = {
  async list(): Promise<RecurringTransaction[]> {
    const { data } = await api.get<RecurringTransaction[]>('/recurring/')
    return data
  },
  async create(body: RecurringCreate): Promise<RecurringTransaction> {
    const { data } = await api.post<RecurringTransaction>('/recurring/', body)
    return data
  },
  async update(id: string, body: RecurringUpdate): Promise<RecurringTransaction> {
    const { data } = await api.patch<RecurringTransaction>(`/recurring/${id}`, body)
    return data
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/recurring/${id}`)
  },
}
