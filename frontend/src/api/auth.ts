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
  totp_enabled: boolean
  currency: string
  default_account_id: string | null
  email_verified: boolean
  is_admin: boolean
}

export interface UserUpdate {
  currency?: string
  default_account_id?: string | null
  clear_default_account?: boolean
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

  async updateMe(payload: UserUpdate): Promise<UserOut> {
    const { data } = await api.patch<UserOut>('/auth/me', payload)
    return data
  },

  async registrationOpen(): Promise<{ open: boolean }> {
    const { data } = await api.get<{ open: boolean }>('/auth/registration-open')
    return data
  },

  async forgotPassword(email: string): Promise<{ detail: string }> {
    const { data } = await api.post<{ detail: string }>('/auth/forgot-password', { email })
    return data
  },

  async resetPassword(token: string, new_password: string): Promise<{ detail: string }> {
    const { data } = await api.post<{ detail: string }>('/auth/reset-password', { token, new_password })
    return data
  },

  async verifyEmail(token: string): Promise<{ detail: string }> {
    const { data } = await api.post<{ detail: string }>('/auth/verify-email', { token })
    return data
  },

  async resendVerification(): Promise<{ detail: string }> {
    const { data } = await api.post<{ detail: string }>('/auth/resend-verification')
    return data
  },

  async changePassword(current_password: string, new_password: string): Promise<{ detail: string }> {
    const { data } = await api.post<{ detail: string }>('/auth/change-password', { current_password, new_password })
    return data
  },
}

export interface SmtpSettings {
  smtp_host: string | null
  smtp_port: number | null
  smtp_user: string | null
  smtp_from: string | null
  smtp_tls: boolean | null
  smtp_password_set: boolean
}

export interface SmtpSettingsUpdate {
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_user?: string | null
  smtp_password?: string | null
  smtp_from?: string | null
  smtp_tls?: boolean | null
}

export const adminApi = {
  async getRegistrationSetting(): Promise<{ allow_registration: boolean }> {
    const { data } = await api.get<{ allow_registration: boolean }>('/auth/admin/registration')
    return data
  },

  async setRegistrationSetting(allow_registration: boolean): Promise<{ allow_registration: boolean }> {
    const { data } = await api.patch<{ allow_registration: boolean }>('/auth/admin/registration', { allow_registration })
    return data
  },

  async getSmtpSettings(): Promise<SmtpSettings> {
    const { data } = await api.get<SmtpSettings>('/auth/admin/smtp')
    return data
  },

  async setSmtpSettings(payload: SmtpSettingsUpdate): Promise<SmtpSettings> {
    const { data } = await api.patch<SmtpSettings>('/auth/admin/smtp', payload)
    return data
  },

  async testSmtp(): Promise<{ detail: string }> {
    const { data } = await api.post<{ detail: string }>('/auth/admin/smtp/test')
    return data
  },
}

export const mfaApi = {
  async setup(): Promise<{ secret: string; uri: string }> {
    const { data } = await api.post<{ secret: string; uri: string }>('/auth/mfa/setup')
    return data
  },

  async enable(code: string): Promise<{ detail: string }> {
    const { data } = await api.post<{ detail: string }>('/auth/mfa/enable', { code })
    return data
  },

  async disable(code: string): Promise<{ detail: string }> {
    const { data } = await api.post<{ detail: string }>('/auth/mfa/disable', { code })
    return data
  },
}
