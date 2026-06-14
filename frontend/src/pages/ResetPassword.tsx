import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Coins, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/auth'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [params]  = useSearchParams()
  const token     = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)
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
      await authApi.resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Link non valido o scaduto.')
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
          <p className="text-sm text-white/40 mt-1">Reimposta la password</p>
        </div>

        {done ? (
          <div className="bg-surface rounded-2xl p-6 space-y-4 shadow-xl text-center">
            <p className="text-sm text-white/70">Password aggiornata con successo. Reindirizzamento al login…</p>
          </div>
        ) : !token ? (
          <div className="bg-surface rounded-2xl p-6 space-y-4 shadow-xl text-center">
            <p className="text-sm text-red-400">Link non valido.</p>
            <Link to="/forgot-password" className="text-brand hover:text-brand-dark font-medium transition text-sm">
              Richiedi un nuovo link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-1">Scegli una nuova password</h2>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Nuova password</label>
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
              {loading ? 'Aggiornamento…' : 'Reimposta password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
