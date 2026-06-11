import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { RoleBadge } from './RoleBadge'
import { EditRoleModal } from './EditRoleModal'
import type { UserRole } from '@/lib/admin/types'

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 60)   return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}

interface Props {
  userRole: UserRole
  onRefresh: () => void
}

export function UserRow({ userRole, onRefresh }: Props) {
  const { session } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy]         = useState(false)

  const email      = (userRole as any).user?.email ?? userRole.user_id
  const lastSeen   = (userRole as any).user?.last_sign_in_at ?? null
  const hasMFA     = ((userRole as any).mfa_factors ?? []).some((f: any) => f.status === 'verified')
  const scopeLabel = userRole.vessel_id
    ? 'vessel-scoped'
    : userRole.org_id
    ? 'org-scoped'
    : 'global'

  async function patchUser(action: 'suspend' | 'unsuspend') {
    setBusy(true)
    await fetch(`/api/admin/users/${userRole.id}`, {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${(session as any)?.access_token ?? ''}`,
      },
      body: JSON.stringify({ action }),
    })
    setBusy(false)
    onRefresh()
  }

  return (
    <>
      <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                            bg-white/5 text-[9px] font-bold text-white/50">
              {email.slice(0, 2).toUpperCase()}
            </div>
            <span className="truncate text-[11px] text-white/80">{email}</span>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <RoleBadge role={userRole.role} />
        </td>
        <td className="px-3 py-2.5">
          <span className="text-[10px] text-white/40">{scopeLabel}</span>
        </td>
        <td className="px-3 py-2.5">
          <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5
                            ${userRole.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-[10px] text-white/50">
            {userRole.is_active ? 'active' : 'inactive'}
          </span>
        </td>
        <td className="px-3 py-2.5 text-center">
          {hasMFA ? (
            <span className="text-[10px] text-emerald-400">✓</span>
          ) : (
            <span className="text-[10px] text-red-400">✗</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <span className="text-[10px] text-white/35">{relativeTime(lastSeen)}</span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditOpen(true)}
              className="rounded px-1.5 py-0.5 text-[9px] text-white/40 hover:text-amber-400
                         hover:bg-amber-500/10 transition-colors"
            >
              Role
            </button>
            <button
              onClick={() => patchUser(userRole.is_active ? 'suspend' : 'unsuspend')}
              disabled={busy}
              className="rounded px-1.5 py-0.5 text-[9px] text-white/40 hover:text-red-400
                         hover:bg-red-500/10 transition-colors disabled:opacity-30"
            >
              {userRole.is_active ? 'Suspend' : 'Restore'}
            </button>
          </div>
        </td>
      </tr>

      {editOpen && (
        <EditRoleModal
          userRole={userRole}
          onClose={() => setEditOpen(false)}
          onSuccess={onRefresh}
        />
      )}
    </>
  )
}
