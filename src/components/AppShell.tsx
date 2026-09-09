import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, FileStack, Home, MessageSquare } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useContradictions, useConversations, useStats, totalDocuments } from '@/api/hooks'

const SIDEBAR_STORAGE_KEY = 'sidebar_open'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
}

const NAV_ITEMS: NavItem[] = [
  { to: '/upload', label: 'Upload', icon: Home },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/contradictions', label: 'Contradictions', icon: AlertTriangle },
  { to: '/library', label: 'Library', icon: FileStack },
]

function useSidebarOpen() {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (saved !== null) return saved === 'true'
    } catch {
      // localStorage can throw (private mode, blocked site data) — fall through to the default.
    }
    return typeof window === 'undefined' || window.innerWidth >= 768
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open))
    } catch {
      // per-viewer convenience only — losing this on a blocked store is fine.
    }
  }, [open])

  return [open, setOpen] as const
}

function useBadgeCounts() {
  const { data: stats } = useStats()
  const { data: openContradictions } = useContradictions({ status: 'open' })
  const { data: conversations } = useConversations()

  return {
    upload: undefined,
    chat: conversations?.filter((c) => c.message_count > 0).length,
    contradictions: openContradictions?.counts.open ?? 0,
    library: totalDocuments(stats),
  }
}

function NavBadge({ count, urgent }: { count: number | undefined; urgent?: boolean }) {
  if (count === undefined || count === 0) return null
  return (
    <span
      className={cn(
        'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums',
        urgent ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground',
      )}
    >
      {count}
    </span>
  )
}

export function AppShell() {
  const badges = useBadgeCounts()
  const [sidebarOpen, setSidebarOpen] = useSidebarOpen()

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'relative hidden shrink-0 border-r bg-card transition-all duration-200 md:flex md:flex-col',
          sidebarOpen ? 'w-56' : 'w-14',
        )}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="absolute -right-3 top-5 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-foreground"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <div className="px-5 py-5">
          <span className={cn('text-lg font-semibold tracking-tight', !sidebarOpen && 'sr-only')}>
            Doc Intelligence
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} badgeCount={getBadge(badges, item.to)} collapsed={!sidebarOpen} />
          ))}
        </nav>
      </aside>

      {/* Main content — each route scrolls internally within this fixed-height area.
          A route that needs its own scroll regions (ChatPage) fills it exactly with
          h-full and manages overflow itself. */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar — icon only, badges as a small dot */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card md:hidden">
        {NAV_ITEMS.map((item) => (
          <TabBarLink key={item.to} item={item} badgeCount={getBadge(badges, item.to)} />
        ))}
      </nav>
    </div>
  )
}

function getBadge(badges: ReturnType<typeof useBadgeCounts>, to: string): number | undefined {
  switch (to) {
    case '/chat':
      return badges.chat
    case '/contradictions':
      return badges.contradictions
    case '/library':
      return badges.library
    default:
      return undefined
  }
}

function SidebarLink({
  item,
  badgeCount,
  collapsed,
}: {
  item: NavItem
  badgeCount: number | undefined
  collapsed: boolean
}) {
  const urgent = item.to === '/contradictions' && !!badgeCount

  const link = (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-secondary text-secondary-foreground'
            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
        )
      }
    >
      {collapsed ? (
        // Badge positioned relative to the icon itself, not the padded link
        // pill: at w-14 collapsed, the pill's own content box is only ~31px
        // (nav's px-3 eats into the 56px rail), too narrow for a centered
        // icon and a corner badge to both fit without overlapping. Anchoring
        // to the icon's own small box sidesteps that regardless of pill width.
        <span className="relative inline-flex">
          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {badgeCount !== undefined && badgeCount > 0 && (
            <span
              className={cn(
                'absolute -right-2 -top-1.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-semibold tabular-nums',
                urgent ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {badgeCount}
            </span>
          )}
        </span>
      ) : (
        <>
          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{item.label}</span>
          <NavBadge count={badgeCount} urgent={urgent} />
        </>
      )}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      {/* asChild on a plain span, not on NavLink directly: Radix's Slot
          merges className as a string, but NavLink's className is a
          function (for isActive) — merging onto it directly breaks that,
          which in turn dropped the `relative` positioning context the
          collapsed badge's `absolute` depends on. The span isolates that. */}
      <TooltipTrigger asChild>
        <span className="block">{link}</span>
      </TooltipTrigger>
      <TooltipContent side="right">
        {item.label}
        {badgeCount ? ` (${badgeCount})` : ''}
      </TooltipContent>
    </Tooltip>
  )
}

function TabBarLink({ item, badgeCount }: { item: NavItem; badgeCount: number | undefined }) {
  const urgent = item.to === '/contradictions' && !!badgeCount
  const hasBadge = badgeCount !== undefined && badgeCount > 0
  return (
    <NavLink
      to={item.to}
      aria-label={item.label}
      className={({ isActive }) =>
        cn('flex flex-1 items-center justify-center py-3', isActive ? 'text-foreground' : 'text-muted-foreground')
      }
    >
      <span className="relative">
        <item.icon className="h-5 w-5" aria-hidden="true" />
        {hasBadge && (
          <span
            className={cn(
              'absolute -right-1 -top-1 h-2 w-2 rounded-full',
              urgent ? 'bg-destructive' : 'bg-muted-foreground',
            )}
          />
        )}
      </span>
    </NavLink>
  )
}
