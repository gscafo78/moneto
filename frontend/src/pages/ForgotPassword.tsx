import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Coins } from 'lucide-react'
import { authApi } from '../api/auth'

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Si è verificato un errore. Riprova.')
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
          <p className="text-sm text-white/40 mt-1">Recupera la tua password</p>
        </div>

        {sent ? (
          <div className="bg-surface rounded-2xl p-6 space-y-4 shadow-xl text-center">
            <p className="text-sm text-white/70">
              Se l'indirizzo esiste, riceverai un'email con le istruzioni per reimpostare la password.
            </p>
            <Link to="/login" className="text-brand hover:text-brand-dark font-medium transition text-sm">
              ← Torna al login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-1">Password dimenticata?</h2>
            <p className="text-sm text-white/40">
              Inserisci la tua email: ti invieremo un link per reimpostare la password.
            </p>

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

            {error && <p className="text-sm text-red-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition min-h-[44px]"
            >
              {loading ? 'Invio in corso…' : 'Invia link di reset'}
            </button>

            <p className="text-center text-sm text-white/40">
              <Link to="/login" className="text-brand hover:text-brand-dark font-medium transition">
                ← Torna al login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
