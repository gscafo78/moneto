import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, ShieldOff, LogOut, Mail, User as UserIcon, Coins, Wallet, AlertTriangle, Lock, KeyRound, Send, Server } from 'lucide-react'
import QRCode from 'react-qr-code'
import { mfaApi, authApi, adminApi } from '../api/auth'
import { accountsApi } from '../api/accounts'
import { useAuthStore } from '../store/authStore'
import { CURRENCIES } from '../utils/currency'

interface HealthInfo {
  status: string
  version: string
  environment: string
}

export default function Settings() {
  const { user, logout, refreshUser } = useAuthStore()
  const qc = useQueryClient()

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list })

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: async (): Promise<HealthInfo> => (await fetch('/health')).json(),
    enabled: !!user?.is_admin,
  })

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

  // Verifica email
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function resendVerification() {
    setResendStatus('sending')
    try {
      await authApi.resendVerification()
      setResendStatus('sent')
    } catch {
      setResendStatus('idle')
    }
  }

  // Cambio password
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [currentPassword,    setCurrentPassword]    = useState('')
  const [newPassword,        setNewPassword]        = useState('')
  const [passwordError,      setPasswordError]      = useState('')
  const [passwordLoading,    setPasswordLoading]    = useState(false)
  const [passwordChanged,    setPasswordChanged]    = useState(false)

  async function submitChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordLoading(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      setPasswordChanged(true)
      setChangePasswordOpen(false)
      setCurrentPassword('')
      setNewPassword('')
    } catch (err: any) {
      setPasswordError(err?.response?.data?.detail ?? 'Operazione non riuscita.')
    } finally {
      setPasswordLoading(false)
    }
  }

  // Amministrazione: toggle registrazione pubblica
  const [allowRegistration, setAllowRegistration] = useState<boolean | null>(null)
  const [registrationLoading, setRegistrationLoading] = useState(false)

  useEffect(() => {
    if (!user?.is_admin) return
    adminApi.getRegistrationSetting().then(r => setAllowRegistration(r.allow_registration)).catch(() => {})
  }, [user?.is_admin])

  async function toggleRegistration() {
    if (allowRegistration === null) return
    setRegistrationLoading(true)
    try {
      const res = await adminApi.setRegistrationSetting(!allowRegistration)
      setAllowRegistration(res.allow_registration)
    } finally {
      setRegistrationLoading(false)
    }
  }

  // Amministrazione: configurazione SMTP
  const [smtpHost,     setSmtpHost]     = useState('')
  const [smtpPort,     setSmtpPort]     = useState('')
  const [smtpUser,     setSmtpUser]     = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpFrom,     setSmtpFrom]     = useState('')
  const [smtpTls,      setSmtpTls]      = useState(true)
  const [smtpPasswordSet, setSmtpPasswordSet] = useState(false)
  const [smtpLoading,  setSmtpLoading]  = useState(false)
  const [smtpSaved,    setSmtpSaved]    = useState(false)
  const [smtpTestStatus, setSmtpTestStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [smtpTestMessage, setSmtpTestMessage] = useState('')

  useEffect(() => {
    if (!user?.is_admin) return
    adminApi.getSmtpSettings().then(r => {
      setSmtpHost(r.smtp_host ?? '')
      setSmtpPort(r.smtp_port ? String(r.smtp_port) : '')
      setSmtpUser(r.smtp_user ?? '')
      setSmtpFrom(r.smtp_from ?? '')
      setSmtpTls(r.smtp_tls ?? true)
      setSmtpPasswordSet(r.smtp_password_set)
    }).catch(() => {})
  }, [user?.is_admin])

  async function saveSmtpSettings(e: React.FormEvent) {
    e.preventDefault()
    setSmtpLoading(true)
    setSmtpSaved(false)
    try {
      const res = await adminApi.setSmtpSettings({
        smtp_host: smtpHost,
        smtp_port: smtpPort ? Number(smtpPort) : null,
        smtp_user: smtpUser,
        smtp_password: smtpPassword || undefined,
        smtp_from: smtpFrom,
        smtp_tls: smtpTls,
      })
      setSmtpPasswordSet(res.smtp_password_set)
      setSmtpPassword('')
      setSmtpSaved(true)
    } finally {
      setSmtpLoading(false)
    }
  }

  async function testSmtp() {
    setSmtpTestStatus('sending')
    setSmtpTestMessage('')
    try {
      const res = await adminApi.testSmtp()
      setSmtpTestStatus('ok')
      setSmtpTestMessage(res.detail)
    } catch (err: any) {
      setSmtpTestStatus('error')
      setSmtpTestMessage(err?.response?.data?.detail ?? 'Invio non riuscito.')
    }
  }

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
          <div className="flex-1">
            <p className="text-xs text-white/40">Email</p>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
        </div>

        {!user?.email_verified && (
          <div className="flex items-center gap-3 bg-amber-400/10 rounded-xl p-3">
            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400 flex-1">Email non verificata. Controlla la posta in arrivo.</p>
            <button
              onClick={resendVerification}
              disabled={resendStatus !== 'idle'}
              className="text-xs font-medium text-amber-400 px-2 py-1 rounded-lg hover:bg-white/5 transition disabled:opacity-50 flex-shrink-0"
            >
              {resendStatus === 'sent' ? 'Inviata' : resendStatus === 'sending' ? 'Invio…' : 'Invia di nuovo'}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center flex-shrink-0">
              <KeyRound size={18} className="text-brand" />
            </div>
            <p className="text-sm font-medium">Password</p>
          </div>
          {!changePasswordOpen && (
            <button
              onClick={() => { setChangePasswordOpen(true); setPasswordChanged(false); setPasswordError('') }}
              className="text-sm font-medium text-brand px-3 py-2 rounded-lg hover:bg-white/5 transition"
            >
              Cambia
            </button>
          )}
        </div>

        {passwordChanged && (
          <p className="text-xs text-income">Password aggiornata con successo.</p>
        )}

        {changePasswordOpen && (
          <form onSubmit={submitChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Password attuale</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-overlay border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60 transition min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Nuova password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-overlay border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-brand/60 transition min-h-[44px]"
              />
            </div>
            {passwordError && <p className="text-xs text-expense">{passwordError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setChangePasswordOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/5 transition"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={passwordLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-dark transition disabled:opacity-50"
              >
                Conferma
              </button>
            </div>
          </form>
        )}
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

      {/* Amministrazione */}
      {user?.is_admin && (
        <section className="bg-surface rounded-2xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Amministrazione</h2>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${allowRegistration ? 'bg-income/20' : 'bg-white/10'}`}>
                <Lock size={18} className={allowRegistration ? 'text-income' : 'text-white/40'} />
              </div>
              <div>
                <p className="text-sm font-medium">Registrazione pubblica</p>
                <p className="text-xs text-white/40">
                  {allowRegistration === null ? '…' : allowRegistration ? 'Chiunque può registrarsi' : 'Disabilitata'}
                </p>
              </div>
            </div>

            <button
              onClick={toggleRegistration}
              disabled={allowRegistration === null || registrationLoading}
              className={`text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/5 transition disabled:opacity-50 ${allowRegistration ? 'text-expense' : 'text-brand'}`}
            >
              {allowRegistration ? 'Disattiva' : 'Attiva'}
            </button>
          </div>

          {/* Configurazione SMTP */}
          <form onSubmit={saveSmtpSettings} className="space-y-3 pt-3 border-t border-white/10">
            <p className="text-sm font-medium">Invio email (SMTP)</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-white/50 mb-1.5">Host</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={e => setSmtpHost(e.target.value)}
                  placeholder="smtp.esempio.com"
                  className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand/60 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Porta</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={e => setSmtpPort(e.target.value)}
                  placeholder="587"
                  className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand/60 transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Utente</label>
              <input
                type="text"
                value={smtpUser}
                onChange={e => setSmtpUser(e.target.value)}
                placeholder="utente SMTP"
                className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand/60 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Password</label>
              <input
                type="password"
                value={smtpPassword}
                onChange={e => setSmtpPassword(e.target.value)}
                placeholder={smtpPasswordSet ? '••••••••' : 'password SMTP'}
                className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand/60 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Mittente</label>
              <input
                type="text"
                value={smtpFrom}
                onChange={e => setSmtpFrom(e.target.value)}
                placeholder="Moneto <no-reply@esempio.com>"
                className="w-full bg-surface-overlay border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand/60 transition"
              />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={smtpTls}
                onChange={e => setSmtpTls(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-surface-overlay text-brand focus:ring-brand/60 focus:ring-offset-0"
              />
              <span className="text-sm text-white/60">Usa TLS</span>
            </label>

            {smtpSaved && <p className="text-xs text-income">Configurazione salvata.</p>}
            {smtpTestStatus === 'ok' && <p className="text-xs text-income">{smtpTestMessage}</p>}
            {smtpTestStatus === 'error' && <p className="text-xs text-expense">{smtpTestMessage}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={testSmtp}
                disabled={smtpTestStatus === 'sending'}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/5 transition disabled:opacity-50"
              >
                <Send size={14} />
                {smtpTestStatus === 'sending' ? 'Invio…' : 'Invia test'}
              </button>
              <button
                type="submit"
                disabled={smtpLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-dark transition disabled:opacity-50"
              >
                Salva
              </button>
            </div>
          </form>

          {/* Info sistema */}
          <div className="pt-3 border-t border-white/10">
            <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
              <Server size={16} className="text-white/40" />
              Info sistema
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wide mb-0.5">Frontend</p>
                <p className="font-mono text-white/70">{__APP_VERSION__}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wide mb-0.5">Backend</p>
                <p className="font-mono text-white/70">{health?.version ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wide mb-0.5">Ambiente</p>
                <p className="font-mono text-white/70">{health?.environment ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wide mb-0.5">Status</p>
                <p className="font-mono text-income">{health?.status ?? '—'}</p>
              </div>
            </div>
          </div>
        </section>
      )}

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

      <p className="text-center text-xs text-white/20 pb-4">Moneto v{__APP_VERSION__}</p>
    </div>
  )
}
