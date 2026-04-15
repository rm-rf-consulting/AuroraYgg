import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useHubStore } from '@/stores/hubStore'
import {
  Search,
  Home,
  Download,
  ArrowLeftRight,
  FolderOpen,
  Heart,
  Settings,
  Bell,
  Globe,
  Radio,
} from 'lucide-react'

interface Command {
  id: string
  label: string
  icon: React.ElementType
  path: string
  keywords: string
}

const STATIC_COMMANDS: Command[] = [
  { id: 'home', label: 'Home / Dashboard', icon: Home, path: '/', keywords: 'home dashboard stats' },
  { id: 'search', label: 'Search Files', icon: Search, path: '/search', keywords: 'search find files' },
  { id: 'queue', label: 'Queue', icon: Download, path: '/queue', keywords: 'queue download bundles' },
  { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight, path: '/transfers', keywords: 'transfers upload download speed' },
  { id: 'share', label: 'Share', icon: FolderOpen, path: '/share', keywords: 'share directories folders' },
  { id: 'favorites', label: 'Favorite Hubs', icon: Heart, path: '/favorites', keywords: 'favorite hubs bookmarks' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', keywords: 'settings config preferences' },
  { id: 'events', label: 'Events / Logs', icon: Bell, path: '/events', keywords: 'events logs messages system' },
  { id: 'peers', label: 'Yggdrasil Peers', icon: Globe, path: '/peers', keywords: 'yggdrasil peers network nodes' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const hubs = useHubStore((s) => s.hubs)

  // Build command list: static + dynamic (hubs)
  const commands = useMemo(() => {
    const hubCommands: Command[] = hubs.map((hub) => ({
      id: `hub-${hub.id}`,
      label: hub.identity.name || hub.hub_url,
      icon: Radio,
      path: `/hubs/${hub.id}`,
      keywords: `hub ${hub.identity.name} ${hub.hub_url}`,
    }))
    return [...STATIC_COMMANDS, ...hubCommands]
  }, [hubs])

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.toLowerCase().includes(q)
    )
  }, [commands, query])

  // Reset selection on filter change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filtered.length])

  // Global Cmd+K / Ctrl+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const execute = (cmd: Command) => {
    navigate(cmd.path)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      execute(filtered[selectedIndex])
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-(--z-command) backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-(--z-command) px-4">
        <div className="rounded-2xl bg-(--color-surface-2) border border-(--color-glass-border) shadow-lg overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 border-b border-(--color-glass-border)">
            <Search size={16} className="text-(--color-text-tertiary) shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, hubs, actions..."
              className="flex-1 h-12 bg-transparent text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none"
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-(--color-text-disabled)">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-caption text-sm text-center py-6">
                No results
              </p>
            ) : (
              filtered.map((cmd, i) => {
                const Icon = cmd.icon
                return (
                  <button
                    key={cmd.id}
                    onClick={() => execute(cmd)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                      i === selectedIndex
                        ? 'bg-(--color-accent)/10'
                        : 'hover:bg-white/3'
                    }`}
                  >
                    <Icon
                      size={16}
                      className={
                        i === selectedIndex
                          ? 'text-(--color-link)'
                          : 'text-(--color-text-tertiary)'
                      }
                    />
                    <span className="text-sm text-(--color-text-primary) flex-1">
                      {cmd.label}
                    </span>
                    {i === selectedIndex && (
                      <span className="text-micro">Enter ↵</span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}
