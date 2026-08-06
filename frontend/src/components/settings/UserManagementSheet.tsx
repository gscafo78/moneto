import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import BottomSheet from '../ui/BottomSheet'
import { adminApi, type AdminUserOut } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'

interface Props {
  open: boolean
  onClose: () => void
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', user: 'Utente' }
const ROLE_CLASS: Record<string, string> = {
  admin: 'bg-income/20 text-income',
  user: 'bg-white/10 text-white/40',
}

export default function UserManagementSheet({ open, onClose }: Props) {
  const qc = useQueryClient()
  const me = useAuthStore(s => s.user)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminApi.listUsers,
    enabled: open,
  })

  const roleMut = useMutation({
    mutationFn: ({ id, is_admin }: { id: string; is_admin: boolean }) => adminApi.setUserRole(id, is_admin),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const admins = users.filter(u => u.is_admin)
  const regular = users.filter(u => !u.is_admin)
  const isLastAdmin = admins.length <= 1

  function renderRow(u: AdminUserOut) {
    const isSelf = u.id === me?.id
    const isBlocked = u.is_admin && isLastAdmin
    const role = u.is_admin ? 'admin' : 'user'

    return (
      <div key={u.id} className="bg-surface-overlay rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_CLASS[role]}`}>
            {ROLE_LABEL[role]}
          </span>
          {!u.email_verified && (
            <span className="text-xs text-white/40">Non verificata</span>
          )}
        </div>

        <div>
          <p className="text-sm text-white truncate">{u.name || u.email}</p>
          <p className="text-xs text-white/40 truncate">{u.email}</p>
          {u.created_at && (
            <p className="text-xs text-white/30">Registrato il {dayjs(u.created_at).format('D MMM YYYY')}</p>
          )}
        </div>

        {!isSelf && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => roleMut.mutate({ id: u.id, is_admin: !u.is_admin })}
              disabled={roleMut.isPending || isBlocked}
              title={u.is_admin ? 'Rimuovi ruolo admin' : 'Promuovi ad admin'}
              className="p-2 text-white/40 hover:text-white transition disabled:opacity-30 disabled:hover:text-white/40"
            >
              {u.is_admin ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
            </button>
            <button
              onClick={() => {
                if (confirm(`Eliminare definitivamente l'account di ${u.email}? Verranno cancellati anche tutti i suoi conti, categorie, transazioni e transazioni ricorrenti. L'operazione è irreversibile.`)) {
                  deleteMut.mutate(u.id)
                }
              }}
              disabled={deleteMut.isPending || isBlocked}
              title="Elimina utente"
              className="p-2 text-expense/70 hover:text-expense transition disabled:opacity-30 disabled:hover:text-expense/70"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pb-6 pt-2 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Gestione utenti</h2>
        </div>

        {isLoading && <p className="text-sm text-white/40 text-center py-4">Caricamento…</p>}

        {!isLoading && (
          <>
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Amministratori</h3>
              {admins.length === 0 && <p className="text-sm text-white/40">Nessun amministratore</p>}
              {admins.map(renderRow)}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Utenti</h3>
              {regular.length === 0 && <p className="text-sm text-white/40">Nessun utente</p>}
              {regular.map(renderRow)}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
