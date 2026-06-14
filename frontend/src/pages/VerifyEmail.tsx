import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Coins, CheckCircle2, XCircle } from 'lucide-react'
import { authApi } from '../api/auth'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-[#0f0f13]">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center mb-3 shadow-lg shadow-brand/30">
            <Coins size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Moneto</h1>
        </div>

        <div className="bg-surface rounded-2xl p-6 space-y-4 shadow-xl text-center">
          {status === 'loading' && (
            <p className="text-sm text-white/70">Verifica in corso…</p>
          )}
          {status === 'success' && (
            <>
              <CheckCircle2 size={40} className="text-income mx-auto" />
              <p className="text-sm text-white/70">Email verificata con successo.</p>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle size={40} className="text-expense mx-auto" />
              <p className="text-sm text-white/70">Link non valido o scaduto.</p>
            </>
          )}
          <Link to="/" className="text-brand hover:text-brand-dark font-medium transition text-sm inline-block">
            Vai a Moneto
          </Link>
        </div>
      </div>
    </div>
  )
}
