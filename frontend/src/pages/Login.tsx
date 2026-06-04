import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Coins, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const navigate  = useNavigate()
  const setTokens = useAuthStore(s => s.setTokens)
  const [registrationOpen, setRegistrationOpen] = useState(false)

  useEffect(() => {
    authApi.registrationOpen().then(r => setRegistrationOpen(r.open)).catch(() => {})
  }, [])

  // Step 1 — credenziali
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPwd,  setShowPwd]  = useState(false)

  // Step 2 — MFA
  const [step,         setStep]         = useState<'credentials' | 'mfa'>('credentials')
  const [sessionToken, setSessionToken] = useState('')
  const [mfaCode,      setMfaCode]      = useState('')

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(email, password, remember)
      if (res.requires_mfa && res.session_token) {
        setSessionToken(res.session_token)
        setStep('mfa')
      } else if (res.access_token && res.refresh_token) {
        await setTokens(res.access_token, res.refresh_token)
        navigate('/', { replace: true })
      }
    } catch {
      setError('Email o password non corretti.')
    } finally {
      setLoading(false)
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.verifyMfa(sessionToken, mfaCode, remember)
      if (res.access_token && res.refresh_token) {
        await setTokens(res.access_token, res.refresh_token)
        navigate('/', { replace: true })
      }
    } catch {
      setError('Codice non valido. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-[#0f0f13]">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center mb-3 shadow-lg shadow-brand/30">
            <Coins size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Moneto</h1>
          <p className="text-sm text-white/40 mt-1">Gestione spese personali</p>
        </div>

        {step === 'credentials' ? (
          <form onSubmit={handleLogin} className="bg-surface rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-1">Accedi</h2>

            {/* Email */}
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

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            {/* Ricordami */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-surface-overlay text-brand focus:ring-brand/60 focus:ring-offset-0"
              />
              <span className="text-sm text-white/60">Ricordami per 30 giorni</span>
            </label>

            {error && <p className="text-sm text-red-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition min-h-[44px]"
            >
              {loading ? 'Accesso in corso…' : 'Accedi'}
            </button>

            <p className="text-center text-sm text-white/40">
              {registrationOpen && (
                <>
                  Non hai un account?{' '}
                  <Link to="/register" className="text-brand hover:text-brand-dark font-medium transition">
                    Registrati
                  </Link>
                </>
              )}
            </p>
          </form>

        ) : (
          <form onSubmit={handleMfa} className="bg-surface rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col items-center text-center mb-2">
              <div className="w-12 h-12 rounded-xl bg-surface-overlay border border-white/10 flex items-center justify-center mb-3">
                <ShieldCheck size={24} className="text-brand" />
              </div>
              <h2 className="text-lg font-semibold text-white">Verifica identità</h2>
              <p className="text-sm text-white/40 mt-1">
                Inserisci il codice dall'app autenticatore
              </p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={mfaCode}
              onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full bg-surface-overlay border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60 transition min-h-[44px]"
            />

            {error && <p className="text-sm text-red-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition min-h-[44px]"
            >
              {loading ? 'Verifica in corso…' : 'Verifica'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('credentials'); setMfaCode(''); setError('') }}
              className="w-full text-sm text-white/40 hover:text-white/60 transition py-2"
            >
              ← Torna al login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
