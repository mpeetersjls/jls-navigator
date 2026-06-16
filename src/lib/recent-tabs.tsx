import { useState, useEffect } from 'react'

// Recently-visited pages (mini-tabs) + last-route memory, persisted to
// localStorage so the app reopens where you left off and you can hop back.

const TABS_KEY = 'polaris.recentTabs'
const LAST_KEY = 'polaris.lastRoute'
const EVENT = 'polaris:recent-tabs'
const MAX = 10

export type RecentTab = { path: string; label: string }

// Paths we never track/restore.
const IGNORE = [/^\/auth/, /^\/sign\//, /^\/$/]

const LABELS: { test: RegExp; label: string }[] = [
  { test: /^\/dashboard/, label: 'Leo' },
  { test: /^\/yachts\/[^/]+/, label: 'Vessel' },
  { test: /^\/yachts/, label: 'Vessels' },
  { test: /^\/my-fleet/, label: 'My Fleet' },
  { test: /^\/crew-immigration\/visas\/new/, label: 'New Visa' },
  { test: /^\/crew-immigration\/visas/, label: 'Visas' },
  { test: /^\/crew-immigration\/crew/, label: 'Crew List' },
  { test: /^\/crew-immigration\/sign-on-off/, label: 'Sign On/Off' },
  { test: /^\/crew-immigration\/documents/, label: 'Crew Docs' },
  { test: /^\/finance/, label: 'Finance' },
  { test: /^\/director/, label: 'Reports' },
  { test: /^\/automations/, label: 'Automations' },
  { test: /^\/permits\/command-centre/, label: 'Command Centre' },
  { test: /^\/permits\//, label: 'Permits' },
  { test: /^\/orbit/, label: 'Orbit' },
  { test: /^\/packages/, label: 'ShipSync' },
  { test: /^\/crew-cab/, label: 'Transport' },
  { test: /^\/fleet-tracking/, label: 'Live Tracking' },
  { test: /^\/waypoint/, label: 'Waypoint' },
  { test: /^\/provisioning/, label: 'Provisioning' },
  { test: /^\/training/, label: 'Training' },
  { test: /^\/agency/, label: 'Agency' },
  { test: /^\/crew-placement/, label: 'Crew Placement' },
  { test: /^\/esign/, label: 'e-Sign' },
  { test: /^\/it-tickets/, label: 'Service Desk' },
  { test: /^\/licensing/, label: 'Licensing' },
  { test: /^\/yacht-it/, label: 'Yacht IT' },
  { test: /^\/guides/, label: 'Guides' },
  { test: /^\/compass/, label: 'Compass' },
  { test: /^\/changelog/, label: 'Changelog' },
  { test: /^\/small-boat-registration/, label: 'Small Boats' },
  { test: /^\/settings/, label: 'Settings' },
  { test: /^\/admin/, label: 'Admin' },
]

export function labelForPath(path: string): string {
  for (const l of LABELS) if (l.test.test(path)) return l.label
  const seg = path.split('/').filter(Boolean).pop() ?? 'Home'
  return seg.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function read(): RecentTab[] {
  try { return JSON.parse(localStorage.getItem(TABS_KEY) ?? '[]') } catch { return [] }
}

export function getLastRoute(): string | null {
  try { return localStorage.getItem(LAST_KEY) } catch { return null }
}

export function recordVisit(path: string) {
  if (IGNORE.some(re => re.test(path))) return
  try {
    localStorage.setItem(LAST_KEY, path)
    const tabs = read().filter(t => t.path !== path)
    tabs.unshift({ path, label: labelForPath(path) })
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs.slice(0, MAX)))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch { /* ignore */ }
}

export function removeTab(path: string) {
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify(read().filter(t => t.path !== path)))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch { /* ignore */ }
}

export function useRecentTabs(): RecentTab[] {
  const [tabs, setTabs] = useState<RecentTab[]>(() => (typeof window !== 'undefined' ? read() : []))
  useEffect(() => {
    const h = () => setTabs(read())
    window.addEventListener(EVENT, h)
    return () => window.removeEventListener(EVENT, h)
  }, [])
  return tabs
}
