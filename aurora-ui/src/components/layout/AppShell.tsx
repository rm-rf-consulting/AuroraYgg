import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import { useAuthStore } from '@/stores/authStore'
import { useHubStore } from '@/stores/hubStore'
import { useTransferStore } from '@/stores/transferStore'
import { useGlobalHotkeys } from '@/hooks/useHotkeys'
import { GlassNav } from './GlassNav'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const fetchHubs = useHubStore((s) => s.fetchHubs)
  const subscribeToHubEvents = useHubStore((s) => s.subscribeToHubEvents)
  const fetchStats = useTransferStore((s) => s.fetchStats)
  const subscribeToTransferEvents = useTransferStore((s) => s.subscribeToTransferEvents)

  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Global keyboard shortcuts
  useGlobalHotkeys()

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Bootstrap data + subscriptions
  useEffect(() => {
    if (!isAuthenticated) return

    fetchHubs()
    fetchStats()

    let cleanupHubs: (() => void) | undefined
    let cleanupTransfers: (() => void) | undefined

    const setup = async () => {
      cleanupHubs = await subscribeToHubEvents()
      cleanupTransfers = await subscribeToTransferEvents()
    }
    setup()

    // Poll transfer stats every 2s
    const statsInterval = setInterval(fetchStats, 2000)

    return () => {
      cleanupHubs?.()
      cleanupTransfers?.()
      clearInterval(statsInterval)
    }
  }, [isAuthenticated, fetchHubs, fetchStats, subscribeToHubEvents, subscribeToTransferEvents])

  if (!isAuthenticated) return null

  return (
    <div className="h-screen flex flex-col bg-(--color-bg-primary)">
      <GlassNav onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex flex-1 pt-12 overflow-hidden">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-(--z-modal-backdrop) lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — always visible on lg+, togglable on mobile */}
        <div
          className={`fixed lg:static top-12 bottom-0 left-0 z-(--z-modal) lg:z-auto transition-transform duration-200 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <Sidebar />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
