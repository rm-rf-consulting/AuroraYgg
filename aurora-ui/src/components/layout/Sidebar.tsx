import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useHubStore } from '@/stores/hubStore'
import { HubConnectDialog } from '@/components/shared/HubConnectDialog'
import {
  Home,
  Search,
  Download,
  ArrowLeftRight,
  FolderOpen,
  Heart,
  Globe,
  Radio,
  Bell,
  Plus,
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
  { label: 'Ygg Peers', icon: Globe, path: '/peers' },
]

const sessionNav: NavItem[] = [
  { label: 'Events', icon: Bell, path: '/events' },
]

export function Sidebar() {
  const hubs = useHubStore((s) => s.hubs)
  const location = useLocation()
  const [hubDialogOpen, setHubDialogOpen] = useState(false)

  return (
    <>
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
        <div className="p-2.5 flex flex-col gap-0.5">
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-micro uppercase tracking-wider font-medium">
              Hubs
            </span>
            <button
              onClick={() => setHubDialogOpen(true)}
              className="text-(--color-text-disabled) hover:text-(--color-link) transition-colors cursor-pointer"
              title="Connect to hub"
            >
              <Plus size={13} />
            </button>
          </div>
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
          {hubs.length === 0 && (
            <button
              onClick={() => setHubDialogOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-(--color-text-disabled) hover:text-(--color-text-tertiary) hover:bg-white/3 transition-colors cursor-pointer"
            >
              <Plus size={13} />
              Connect to hub
            </button>
          )}
        </div>

        {/* Session nav */}
        <div className="p-2.5 flex flex-col gap-0.5 mt-auto">
          {sessionNav.map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </div>
      </aside>

      <HubConnectDialog
        open={hubDialogOpen}
        onClose={() => setHubDialogOpen(false)}
      />
    </>
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
