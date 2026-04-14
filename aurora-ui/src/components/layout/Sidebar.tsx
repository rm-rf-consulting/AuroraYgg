import { cn } from '@/lib/utils'
import { useHubStore } from '@/stores/hubStore'
import {
  Home,
  Search,
  Download,
  ArrowLeftRight,
  FolderOpen,
  Heart,
  MessageSquare,
  Radio,
  FileText,
  Bell,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router'

interface NavItem {
  label: string
  icon: React.ElementType
  path: string
  badge?: number
}

const mainNav: NavItem[] = [
  { label: 'Home', icon: Home, path: '/' },
  { label: 'Search', icon: Search, path: '/search' },
  { label: 'Queue', icon: Download, path: '/queue' },
  { label: 'Transfers', icon: ArrowLeftRight, path: '/transfers' },
  { label: 'Share', icon: FolderOpen, path: '/share' },
  { label: 'Favorites', icon: Heart, path: '/favorites' },
]

const sessionNav: NavItem[] = [
  { label: 'Events', icon: Bell, path: '/events' },
]

export function Sidebar() {
  const hubs = useHubStore((s) => s.hubs)
  const location = useLocation()

  return (
    <aside className="w-52 shrink-0 bg-(--color-surface-1) border-r border-(--color-glass-border) h-full overflow-y-auto flex flex-col">
      {/* Main navigation */}
      <div className="p-2.5 flex flex-col gap-0.5">
        <span className="text-micro uppercase tracking-wider px-2.5 py-1.5 font-medium">
          Navigate
        </span>
        {mainNav.map((item) => (
          <SidebarLink key={item.path} item={item} />
        ))}
      </div>

      {/* Hubs */}
      {hubs.length > 0 && (
        <div className="p-2.5 flex flex-col gap-0.5">
          <span className="text-micro uppercase tracking-wider px-2.5 py-1.5 font-medium">
            Hubs
          </span>
          {hubs.map((hub) => {
            const unread = hub.message_counts?.unread?.messages || 0
            return (
              <SidebarLink
                key={hub.id}
                item={{
                  label: hub.identity.name || hub.hub_url,
                  icon: Radio,
                  path: `/hubs/${hub.id}`,
                  badge: unread > 0 ? unread : undefined,
                }}
              />
            )
          })}
        </div>
      )}

      {/* Session nav */}
      <div className="p-2.5 flex flex-col gap-0.5 mt-auto">
        {sessionNav.map((item) => (
          <SidebarLink key={item.path} item={item} />
        ))}
      </div>
    </aside>
  )
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors no-underline',
          isActive
            ? 'bg-(--color-accent)/12 text-(--color-link)'
            : 'text-(--color-text-secondary) hover:bg-white/5 hover:text-(--color-text-primary)'
        )
      }
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate flex-1">{item.label}</span>
      {item.badge !== undefined && (
        <span className="min-w-5 h-5 flex items-center justify-center rounded-full bg-(--color-accent) text-white text-[10px] font-semibold px-1.5">
          {item.badge}
        </span>
      )}
    </NavLink>
  )
}
