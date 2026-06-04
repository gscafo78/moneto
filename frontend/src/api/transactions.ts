import { api } from './client'

export type TxType = 'expense' | 'income' | 'transfer'

export interface Transaction {
  id: string
  account_id: string
  category_id: string | null
  amount: number
  type: TxType
  note: string | null
  date: string
}

export interface TransactionCreate {
  account_id: string
  category_id?: string
  amount: number
  type: TxType
  note?: string
  date?: string
}

export const transactionsApi = {
  async list(year?: number, month?: number): Promise<Transaction[]> {
    const { data } = await api.get<Transaction[]>('/transactions/', {
      params: { year, month },
    })
    return data
  },
  async create(body: TransactionCreate): Promise<Transaction> {
    const { data } = await api.post<Transaction>('/transactions/', body)
    return data
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/transactions/${id}`)
  },
}
