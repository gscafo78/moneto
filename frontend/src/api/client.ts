import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
})

// ── Request: allega access token ───────────────────────────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response: rinnova access token su 401 (mutex per evitare refresh paralleli) ─
let refreshPromise: Promise<void> | null = null

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err)
    }
    original._retry = true

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      window.location.href = '/login'
      return Promise.reject(err)
    }

    if (!refreshPromise) {
      refreshPromise = axios
        .post('/api/v1/auth/refresh', { refresh_token: refreshToken })
        .then(({ data }) => {
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
        })
        .catch(() => {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        })
        .finally(() => { refreshPromise = null })
    }

    await refreshPromise
    original.headers.Authorization = `Bearer ${localStorage.getItem('access_token')}`
    return api(original)
  }
)
