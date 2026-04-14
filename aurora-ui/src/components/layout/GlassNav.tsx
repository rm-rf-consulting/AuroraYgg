import { useAuthStore } from '@/stores/authStore'
import { useTransferStore } from '@/stores/transferStore'
import { formatSpeed } from '@/lib/utils'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LogOut,
  Menu,
  Search,
  Settings,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router'

export function GlassNav({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { username, logout, systemInfo } = useAuthStore()
  const stats = useTransferStore((s) => s.stats)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="glass fixed top-0 left-0 right-0 h-12 z-(--z-nav) flex items-center px-4 md:px-5 gap-3 md:gap-4">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors cursor-pointer"
      >
        <Menu size={18} />
      </button>

      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 no-underline shrink-0">
        <div className="w-7 h-7 rounded-lg bg-(--color-accent) flex items-center justify-center">
          <span className="text-white text-sm font-bold leading-none">A</span>
        </div>
        <span className="text-sm font-semibold text-(--color-text-primary) tracking-tight hidden sm:inline">
          Aurora
        </span>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Transfer speeds */}
      {stats && (
        <div className="flex items-center gap-4 text-micro">
          <span className="flex items-center gap-1.5 text-(--color-success)">
            <ArrowDownToLine size={13} />
            {formatSpeed(stats.speed_down)}
          </span>
          <span className="flex items-center gap-1.5 text-(--color-link)">
            <ArrowUpFromLine size={13} />
            {formatSpeed(stats.speed_up)}
          </span>
        </div>
      )}

      {/* Quick search */}
      <Link
        to="/search"
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/8 text-(--color-text-tertiary) text-xs transition-colors"
      >
        <Search size={13} />
        <span className="hidden md:inline">Search</span>
        <kbd className="hidden lg:inline text-[10px] opacity-50 ml-1 px-1 py-0.5 rounded bg-white/5">
          /
        </kbd>
      </Link>

      {/* Settings */}
      <Link
        to="/settings"
        className="text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
      >
        <Settings size={16} />
      </Link>

      {/* User */}
      <div className="flex items-center gap-2">
        <span className="text-micro">{username}</span>
        <button
          onClick={handleLogout}
          className="text-(--color-text-tertiary) hover:text-(--color-error) transition-colors cursor-pointer"
          title="Logout"
        >
          <LogOut size={15} />
        </button>
      </div>
    </nav>
  )
}
