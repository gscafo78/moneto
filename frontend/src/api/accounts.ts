import { api } from './client'

export interface Account {
  id: string
  name: string
  icon: string
  color: string
  balance: number
  currency: string
}

export const accountsApi = {
  async list(): Promise<Account[]> {
    const { data } = await api.get<Account[]>('/accounts/')
    return data
  },
  async create(body: Omit<Account, 'id'>): Promise<Account> {
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
}
