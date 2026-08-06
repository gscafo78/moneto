import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Copy, Check, Trash2 } from 'lucide-react'
import BottomSheet from '../ui/BottomSheet'
import { adminApi, type InviteOut } from '../../api/auth'

interface Props {
  open: boolean
  onClose: () => void
}

function inviteStatus(invite: InviteOut): 'used' | 'expired' | 'active' {
  if (invite.used_at) return 'used'
  if (dayjs(invite.expires_at).isBefore(dayjs())) return 'expired'
  return 'active'
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Attivo',
  used: 'Usato',
  expired: 'Scaduto',
}

const STATUS_CLASS: Record<string, string> = {
  active: 'bg-income/20 text-income',
  used: 'bg-white/10 text-white/40',
  expired: 'bg-expense/20 text-expense',
}

export default function InviteLinkSheet({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [copied, setCopied] = useState<string | null>(null)

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ['invites'],
    queryFn: adminApi.listInvites,
    enabled: open,
  })

  const createMut = useMutation({
    mutationFn: adminApi.createInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  })

  const revokeMut = useMutation({
    mutationFn: adminApi.revokeInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  })

  function copy(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-6 pt-2 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Link di invito</h2>
        </div>

        <p className="text-xs text-white/40">
          Genera un link valido 24 ore che permette a una persona di registrarsi,
          anche se la registrazione pubblica è disabilitata. Il link è monouso: dopo
          la registrazione non è più valido.
        </p>

        <button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition min-h-[44px]"
        >
          {createMut.isPending ? 'Generazione…' : 'Genera nuovo link'}
        </button>

        <div className="flex flex-col gap-2">
          {isLoading && <p className="text-sm text-white/40 text-center py-4">Caricamento…</p>}
          {!isLoading && invites.length === 0 && (
            <p className="text-sm text-white/40 text-center py-4">Nessun invito generato finora</p>
          )}
          {invites.map(invite => {
            const status = inviteStatus(invite)
            return (
              <div key={invite.id} className="bg-surface-overlay rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASS[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  <span className="text-xs text-white/40">
                    Scade il {dayjs(invite.expires_at).format('D MMM YYYY, HH:mm')}
                  </span>
                </div>

                {invite.used_by_email && (
                  <p className="text-xs text-white/40">Usato da {invite.used_by_email}</p>
                )}

                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={invite.url}
                    className="flex-1 min-w-0 bg-transparent text-xs text-white/60 truncate focus:outline-none"
                  />
                  <button
                    onClick={() => copy(invite.url)}
                    className="p-2 text-white/40 hover:text-white transition flex-shrink-0"
                    title="Copia link"
                  >
                    {copied === invite.url ? <Check size={16} className="text-income" /> : <Copy size={16} />}
                  </button>
                  {status === 'active' && (
                    <button
                      onClick={() => revokeMut.mutate(invite.id)}
                      className="p-2 text-expense/70 hover:text-expense transition flex-shrink-0"
                      title="Revoca invito"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </BottomSheet>
  )
}
