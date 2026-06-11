const EVENT_STYLES: Record<string, string> = {
  AUTH:   'bg-cyan-500/10 text-cyan-400',
  PERM:   'bg-orange-500/15 text-orange-400',
  DATA:   'bg-emerald-500/10 text-emerald-400',
  SEC:    'bg-red-500/10 text-red-400',
  EXPORT: 'bg-amber-500/10 text-amber-400',
  ADMIN:  'bg-purple-500/10 text-purple-400',
  SYSTEM: 'bg-slate-500/15 text-slate-400',
}

export function EventTypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold
                  ${EVENT_STYLES[type] ?? EVENT_STYLES.SYSTEM}`}
    >
      {type}
    </span>
  )
}
