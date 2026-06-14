import { api } from './client'
import type { Transaction } from './transactions'

export interface Account {
  id: string
  name: string
  icon: string
  color: string
  balance: number
  currency: string
}

export interface ReconcileResponse {
  account: Account
  transaction: Transaction | null
  difference: number
}

export const accountsApi = {
  async list(): Promise<Account[]> {
    const { data } = await api.get<Account[]>('/accounts/')
    return data
  },
  async create(body: { name: string; icon: string; color: string; opening_balance: number; currency: string }): Promise<Account> {
    const { data } = await api.post<Account>('/accounts/', body)
    return data
  },
  async update(id: string, body: Partial<Pick<Account, 'name' | 'icon' | 'color'>>): Promise<Account> {
    const { data } = await api.patch<Account>(`/accounts/${id}`, body)
    return data
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/accounts/${id}`)
  },
  async reconcile(id: string, body: { real_balance: number }): Promise<ReconcileResponse> {
    const { data } = await api.post<ReconcileResponse>(`/accounts/${id}/reconcile`, body)
    return data
  },
}
