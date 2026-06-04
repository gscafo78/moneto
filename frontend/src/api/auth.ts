import { api } from './client'

export interface TokenResponse {
  access_token: string | null
  refresh_token: string | null
  token_type: string
  requires_mfa: boolean
  session_token: string | null
}

export interface UserOut {
  id: string
  email: string
  name: string | null
}

export const authApi = {
  async login(email: string, password: string, remember_me = false): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>('/auth/login', { email, password, remember_me })
    return data
  },

  async register(email: string, password: string, name: string): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>('/auth/register', { email, password, name })
    return data
  },

  async verifyMfa(session_token: string, code: string, remember_me = false): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>('/auth/mfa/verify', { session_token, code, remember_me })
    return data
  },

  async refresh(refresh_token: string): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>('/auth/refresh', { refresh_token })
    return data
  },

  async me(): Promise<UserOut> {
    const { data } = await api.get<UserOut>('/auth/me')
    return data
  },

  async registrationOpen(): Promise<{ open: boolean }> {
    const { data } = await api.get<{ open: boolean }>('/auth/registration-open')
    return data
  },
}
