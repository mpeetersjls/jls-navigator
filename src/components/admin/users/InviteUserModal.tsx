import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import type { PolarisRole } from '@/lib/admin/types'

const ROLES: { value: PolarisRole; label: string }[] = [
  { value: 'global_admin',   label: 'Global Admin' },
  { value: 'org_admin',      label: 'Org Admin' },
  { value: 'jls_staff',      label: 'JLS Staff' },
  { value: 'vessel_owner',   label: 'Vessel Owner' },
  { value: 'captain',        label: 'Captain' },
  { value: 'crew',           label: 'Crew' },
  { value: 'supplier',       label: 'Supplier' },
  { value: 'port_agent',     label: 'Port Agent' },
  { value: 'training_user',  label: 'Training User' },
  { value: 'placement_user', label: 'Placement User' },
]

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export function InviteUserModal({ onClose, onSuccess }: Props) {
  const { session } = useAuth()
  const [email,    setEmail]   = useState('')
  const [role,     setRole]    = useState<PolarisRole>('crew')
  const [sending,  setSending] = useState(false)
  const [error,    setError]   = useState('')
  const [done,     setDone]    = useState(false)

  async function handleInvite() {
    if (!email.trim()) { setError('Email is required'); return }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${(session as any)?.access_token ?? ''}`,
        },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error ?? 'Invite failed'); return }
      setDone(true)
      setTimeout(() => { onSuccess(); onClose() }, 1200)
    } catch {
      setError('Network error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-96 rounded-xl border border-white/10 bg-[#0d1520] p-5 shadow-2xl">
        <h3 className="mb-4 text-sm font-semibold text-white">Invite user</h3>

        {done ? (
          <p className="py-4 text-center text-xs text-emerald-400">
            Invite sent — user will complete MFA setup on first login.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-md border border-white/10 bg-[#0f1d2e] px-3 py-2
                             text-xs text-white placeholder:text-white/25
                             focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Role
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as PolarisRole)}
                  className="w-full rounded-md border border-white/10 bg-[#0f1d2e] px-3 py-2
                             text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60
                           hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={sending}
                className="rounded-md bg-cyan-500/10 border border-cyan-500/25 px-3 py-1.5
                           text-xs text-cyan-400 hover:bg-cyan-500/20 transition-colors
                           disabled:opacity-40"
              >
                {sending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
