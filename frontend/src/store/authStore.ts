import { create } from 'zustand'
import { authApi, type UserOut } from '../api/auth'

interface AuthState {
  user: UserOut | null
  loading: boolean
  // Verifica token esistenti al boot e carica l'utente
  init: () => Promise<void>
  // Salva i token e carica l'utente dopo login / register / mfa-verify
  setTokens: (access: string, refresh: string) => Promise<void>
  logout: () => void
}

function saveTokens(access: string, refresh: string) {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    const access = localStorage.getItem('access_token')
    if (!access) {
      set({ loading: false })
      return
    }
    try {
      const user = await authApi.me()
      set({ user, loading: false })
    } catch {
      // access token scaduto — il refresh è gestito dall'interceptor in client.ts
      // se il refresh fallisce, l'interceptor reindirizza a /login
      set({ loading: false })
    }
  },

  setTokens: async (access, refresh) => {
    saveTokens(access, refresh)
    const user = await authApi.me()
    set({ user })
  },

  logout: () => {
    clearTokens()
    set({ user: null })
    window.location.href = '/login'
  },
}))
