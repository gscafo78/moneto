import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Coins, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function Register() {
  const navigate  = useNavigate()
  const setTokens = useAuthStore(s => s.setTokens)

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri.')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.register(email, password, name)
      if (res.access_token && res.refresh_token) {
        await setTokens(res.access_token, res.refresh_token)
        navigate('/', { replace: true })
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Registrazione non riuscita. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-[#0f0f13]">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center mb-3 shadow-lg shadow-brand/30">
            <Coins size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Moneto</h1>
          <p className="text-sm text-white/40 mt-1">Crea il tuo account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-1">Registrati</h2>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Nome</label>
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Il tuo nome"
              className="w-full bg-surface-overlay border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60 transition min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@esempio.com"
              className="w-full bg-surface-overlay border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60 transition min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimo 8 caratteri"
                className="w-full bg-surface-overlay border border-white/10 rounded-xl px-4 py-3 pr-11 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60 transition min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition p-1"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition min-h-[44px]"
          >
            {loading ? 'Registrazione in corso…' : 'Crea account'}
          </button>

          <p className="text-center text-sm text-white/40">
            Hai già un account?{' '}
            <Link to="/login" className="text-brand hover:text-brand-dark font-medium transition">
              Accedi
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
