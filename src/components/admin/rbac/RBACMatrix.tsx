import { useState } from 'react'
import { PermissionCell } from './PermissionCell'
import { EditPermissionModal } from './EditPermissionModal'
import type { PermissionRule } from '@/lib/admin/types'

const ROLES = [
  'global_admin', 'org_admin', 'jls_staff',
  'captain', 'crew_member', 'supplier', 'owner',
]

const ACTIONS = [
  'view', 'create', 'edit', 'approve',
  'finance', 'manage_users', 'admin_panel', 'audit_log', 'leo_briefings',
]

function buildLookup(rules: PermissionRule[]): Record<string, Record<string, string>> {
  const lookup: Record<string, Record<string, string>> = {}
  for (const r of rules) {
    if (!lookup[r.role]) lookup[r.role] = {}
    lookup[r.role][r.action] = r.scope
  }
  return lookup
}

interface Props {
  rules: PermissionRule[]
  onRefresh: () => void
}

export function RBACMatrix({ rules, onRefresh }: Props) {
  const [editing, setEditing] = useState<PermissionRule | null>(null)
  const lookup = buildLookup(rules)

  function findRule(role: string, action: string): PermissionRule | undefined {
    return rules.find(r => r.role === role && r.action === action)
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="bg-muted">
              <th className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground w-32">
                Permission
              </th>
              {ROLES.map(role => (
                <th
                  key={role}
                  className="text-center px-2 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[80px]"
                >
                  {role.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map(action => (
              <tr key={action} className="border-b border-border hover:bg-muted/40">
                <td className="px-3 py-2 text-[11px] text-foreground font-medium capitalize">
                  {action.replace(/_/g, ' ')}
                </td>
                {ROLES.map(role => {
                  const scope = lookup[role]?.[action] ?? 'none'
                  const rule  = findRule(role, action)
                  return (
                    <PermissionCell
                      key={`${role}-${action}`}
                      scope={scope}
                      onClick={rule ? () => setEditing(rule) : undefined}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditPermissionModal
          rule={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); onRefresh() }}
        />
      )}
    </>
  )
}
