import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import type { PermissionRule } from '@/lib/admin/types'

const SCOPE_OPTIONS = ['none', 'own', 'vessel', 'org', 'global', 'full']

interface Props {
  rule: PermissionRule
  onClose: () => void
  onSuccess: () => void
}

export function EditPermissionModal({ rule, onClose, onSuccess }: Props) {
  const { session } = useAuth()
  const [scope,   setScope]   = useState(rule.scope)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/permissions', {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${(session as any)?.access_token ?? ''}`,
        },
        body: JSON.stringify({ id: rule.id, scope }),
      })
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Failed to save')
        return
      }
      onSuccess()
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-80 rounded-xl border border-white/10 bg-[#0d1520] p-5 shadow-2xl">
        <h3 className="mb-1 text-sm font-semibold text-white">Edit permission</h3>
        <p className="mb-4 text-[10px] text-white/40">
          {rule.role.replace(/_/g, ' ')} · {rule.resource} · {rule.action}
        </p>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Scope
          </label>
          <select
            value={scope}
            onChange={e => setScope(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-[#0f1d2e] px-3 py-2
                       text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          >
            {SCOPE_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
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
            onClick={handleSave}
            disabled={saving || scope === rule.scope}
            className="rounded-md bg-amber-500/15 border border-amber-500/25 px-3 py-1.5
                       text-xs text-amber-400 hover:bg-amber-500/25 transition-colors
                       disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
