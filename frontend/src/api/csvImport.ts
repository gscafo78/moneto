import { api } from './client'

export interface ImportRowPreview {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  currency: string
  suggested_category_id: string | null
  is_duplicate: boolean
  currency_mismatch: boolean
  hash: string
}

export interface ImportPreviewResponse {
  rows: ImportRowPreview[]
  warnings: string[]
}

export interface ImportRowConfirm {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category_id?: string | null
  hash: string
}

export interface ImportConfirmResponse {
  imported: number
  skipped_duplicates: number
}

export const importApi = {
  async previewMediobanca(accountId: string, file: File): Promise<ImportPreviewResponse> {
    const form = new FormData()
    form.append('account_id', accountId)
    form.append('file', file)
    const { data } = await api.post<ImportPreviewResponse>('/import/mediobanca/preview', form)
    return data
  },
  async confirmMediobanca(accountId: string, rows: ImportRowConfirm[]): Promise<ImportConfirmResponse> {
    const { data } = await api.post<ImportConfirmResponse>('/import/mediobanca/confirm', {
      account_id: accountId,
      rows,
    })
    return data
  },
}
