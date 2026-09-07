import { AlertTriangle, FileStack, Home, MessageSquare } from 'lucide-react'
import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useContradictions, useMessages, useStats, totalDocuments } from '@/api/hooks'

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

function useBadgeCounts() {
  const [searchParams] = useSearchParams()
  const activeConversationId = searchParams.get('c') ?? undefined

  const { data: stats } = useStats()
  const { data: openContradictions } = useContradictions({ status: 'open' })
  const { data: messages } = useMessages(activeConversationId)

  return {
    upload: undefined,
    chat: messages?.length,
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

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="px-5 py-5">
          <span className="text-lg font-semibold tracking-tight">Doc Intelligence</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} badgeCount={getBadge(badges, item.to)} />
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
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

function SidebarLink({ item, badgeCount }: { item: NavItem; badgeCount: number | undefined }) {
  const urgent = item.to === '/contradictions' && !!badgeCount
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-secondary text-secondary-foreground'
            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
      <NavBadge count={badgeCount} urgent={urgent} />
    </NavLink>
  )
}

function TabBarLink({ item, badgeCount }: { item: NavItem; badgeCount: number | undefined }) {
  const urgent = item.to === '/contradictions' && !!badgeCount
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )
      }
    >
      <span className="relative">
        <item.icon className="h-5 w-5" aria-hidden="true" />
        {badgeCount !== undefined && badgeCount > 0 && (
          <span
            className={cn(
              'absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
              urgent ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {badgeCount}
          </span>
        )}
      </span>
      {item.label}
    </NavLink>
  )
}
