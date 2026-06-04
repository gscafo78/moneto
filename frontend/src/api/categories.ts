import { api } from './client'

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: 'expense' | 'income'
  is_default: boolean
}

export const categoriesApi = {
  async list(): Promise<Category[]> {
    const { data } = await api.get<Category[]>('/categories/')
    return data
  },
  async create(body: Omit<Category, 'id' | 'is_default'>): Promise<Category> {
    const { data } = await api.post<Category>('/categories/', body)
    return data
  },
  async update(id: string, body: Partial<Pick<Category, 'name' | 'icon' | 'color'>>): Promise<Category> {
    const { data } = await api.patch<Category>(`/categories/${id}`, body)
    return data
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/categories/${id}`)
  },
}
