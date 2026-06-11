import { EventTypeBadge } from './EventTypeBadge'
import type { AuditEvent } from '@/lib/admin/types'

const RESULT_STYLES: Record<string, string> = {
  success: 'text-emerald-400',
  blocked: 'text-red-400',
  pending: 'text-amber-400',
  failed:  'text-red-400',
}

export function AuditRow({ event }: { event: AuditEvent }) {
  const ts = new Date(event.created_at).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <td className="px-3 py-2 text-[10px] text-white/35 whitespace-nowrap">{ts}</td>
      <td className="px-3 py-2"><EventTypeBadge type={event.event_type} /></td>
      <td className="px-3 py-2">
        <div className="text-[11px] text-white/70 truncate">{event.actor_email}</div>
        <div className="text-[9px] text-white/30">{event.actor_role.replace(/_/g, ' ')}</div>
      </td>
      <td className="px-3 py-2">
        <div className="text-[11px] text-white/60 truncate max-w-xs">{event.detail}</div>
        {event.target_label && (
          <div className="text-[9px] text-white/30 truncate">{event.target_label}</div>
        )}
      </td>
      <td className="px-3 py-2 text-[10px] text-white/30 font-mono">
        {event.ip_address ?? '—'}
      </td>
      <td className="px-3 py-2">
        <span className={`text-[10px] font-semibold ${RESULT_STYLES[event.result] ?? 'text-white/40'}`}>
          {event.result}
        </span>
      </td>
    </tr>
  )
}
