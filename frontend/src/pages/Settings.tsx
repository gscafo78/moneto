import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, ShieldOff, LogOut, Mail, User as UserIcon, Coins, Wallet } from 'lucide-react'
import QRCode from 'react-qr-code'
import { mfaApi, authApi } from '../api/auth'
import { accountsApi } from '../api/accounts'
import { useAuthStore } from '../store/authStore'
import { CURRENCIES } from '../utils/currency'

export default function Settings() {
  const { user, logout, refreshUser } = useAuthStore()
  const qc = useQueryClient()

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list })

  const prefsMutation = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: async () => {
      await refreshUser()
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })

  const [mode,   setMode]   = useState<'idle' | 'enable' | 'disable'>('idle')
  const [uri,    setUri]    = useState('')
  const [code,   setCode]   = useState('')
  const [error,  setError]  = useState('')
  const [loading, setLoading] = useState(false)

  async function startEnable() {
    setError('')
    setLoading(true)
    try {
      const res = await mfaApi.setup()
      setUri(res.uri)
      setCode('')
      setMode('enable')
    } catch {
      setError('Impossibile avviare la configurazione 2FA.')
    } finally {
      setLoading(false)
    }
  }

  function startDisable() {
    setError('')
    setCode('')
    setMode('disable')
  }

  function cancel() {
    setMode('idle')
    setError('')
    setCode('')
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await mfaApi.enable(code)
      await refreshUser()
      setMode('idle')
    } catch {
      setError('Codice non valido. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await mfaApi.disable(code)
      await refreshUser()
      setMode('idle')
    } catch {
      setError('Codice non valido. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-4 space-y-6 max-w-lg">
      <h1 className="text-xl font-bold">Impostazioni</h1>

      {/* Profilo */}
      <section className="bg-surface rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Profilo</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center flex-shrink-0">
            <UserIcon size={18} className="text-brand" />
          </div>
          <div>
            <p className="text-xs text-white/40">Nome</p>
            <p className="text-sm font-medium">{user?.name || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center flex-shrink-0">
            <Mail size={18} className="text-brand" />
          </div>
          <div>
            <p className="text-xs text-white/40">Email</p>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
        </div>
      </section>

      {/* Preferenze */}
      <section className="bg-surface rounded-2xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Preferenze</h2>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center flex-shrink-0">
            <Coins size={18} className="text-brand" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium mb-1.5">Valuta</p>
            <select
              value={user?.currency ?? 'EUR'}
              onChange={e => prefsMutation.mutate({ currency: e.target.value })}
              disabled={prefsMutation.isPending}
              className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60 transition disabled:opacity-50"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.symbol} — {c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center flex-shrink-0">
            <Wallet size={18} className="text-brand" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium mb-1.5">Conto predefinito (schermata iniziale)</p>
            <select
              value={user?.default_account_id ?? ''}
              onChange={e => {
                const id = e.target.value
                if (id) prefsMutation.mutate({ default_account_id: id })
                else prefsMutation.mutate({ clear_default_account: true })
              }}
              disabled={prefsMutation.isPending || accounts.length === 0}
              className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/60 transition disabled:opacity-50"
            >
              <option value="">Tutti i conti</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Sicurezza */}
      <section className="bg-surface rounded-2xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Sicurezza</h2>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${user?.totp_enabled ? 'bg-income/20' : 'bg-white/10'}`}>
              {user?.totp_enabled
                ? <ShieldCheck size={18} className="text-income" />
                : <ShieldOff size={18} className="text-white/40" />}
            </div>
            <div>
              <p className="text-sm font-medium">Autenticazione a due fattori</p>
              <p className="text-xs text-white/40">
                {user?.totp_enabled ? 'Attiva' : 'Non attiva'}
              </p>
            </div>
          </div>

          {mode === 'idle' && (
            user?.totp_enabled ? (
              <button
                onClick={startDisable}
                className="text-sm font-medium text-expense px-3 py-2 rounded-lg hover:bg-white/5 transition"
              >
                Disattiva
              </button>
            ) : (
              <button
                onClick={startEnable}
                disabled={loading}
                className="text-sm font-medium text-brand px-3 py-2 rounded-lg hover:bg-white/5 transition disabled:opacity-50"
              >
                Attiva
              </button>
            )
          )}
        </div>

        {/* Setup 2FA */}
        {mode === 'enable' && (
          <form onSubmit={confirmEnable} className="space-y-3 pt-2 border-t border-white/10">
            <p className="text-xs text-white/50">
              Scansiona il QR con Google Authenticator o un'app simile, poi inserisci il codice generato.
            </p>
            <div className="bg-white p-3 rounded-xl w-fit">
              <QRCode value={uri} size={160} />
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              required
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Codice a 6 cifre"
              className="w-full bg-surface-overlay border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60 transition min-h-[44px] tracking-widest text-center"
            />
            {error && <p className="text-xs text-expense">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/5 transition"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-dark transition disabled:opacity-50"
              >
                Verifica e attiva
              </button>
            </div>
          </form>
        )}

        {/* Disable 2FA */}
        {mode === 'disable' && (
          <form onSubmit={confirmDisable} className="space-y-3 pt-2 border-t border-white/10">
            <p className="text-xs text-white/50">
              Inserisci il codice dalla tua app di autenticazione per disattivare il 2FA.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              required
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Codice a 6 cifre"
              className="w-full bg-surface-overlay border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-expense/60 transition min-h-[44px] tracking-widest text-center"
            />
            {error && <p className="text-xs text-expense">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/5 transition"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-expense text-white hover:bg-expense/80 transition disabled:opacity-50"
              >
                Disattiva 2FA
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Account */}
      <section className="bg-surface rounded-2xl p-4">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-expense hover:bg-white/5 transition"
        >
          <LogOut size={16} />
          Esci
        </button>
      </section>

      <p className="text-center text-xs text-white/20 pb-4">Moneto</p>
    </div>
  )
}
