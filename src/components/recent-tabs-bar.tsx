import { useLocation, useNavigate } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRecentTabs, removeTab } from '@/lib/recent-tabs'

/** Breadcrumb-style bar of recently visited pages — click to hop back. */
export function RecentTabsBar() {
  const tabs = useRecentTabs()
  const location = useLocation()
  const navigate = useNavigate()
  if (tabs.length <= 1) return null

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-card/40 px-4 py-1.5">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 pr-1">Recent</span>
      {tabs.map(tab => {
        const active = location.pathname === tab.path
        return (
          <div
            key={tab.path}
            className={cn(
              'group/tab flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors cursor-pointer',
              active
                ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/40',
            )}
            onClick={() => navigate({ to: tab.path as any })}
          >
            <span className="whitespace-nowrap">{tab.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeTab(tab.path) }}
              className="ml-0.5 rounded p-0.5 text-muted-foreground/40 hover:text-foreground hover:bg-muted/50"
              aria-label={`Close ${tab.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
