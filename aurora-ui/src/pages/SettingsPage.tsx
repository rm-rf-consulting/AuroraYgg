import { useEffect, useState } from 'react'
import { getSocket } from '@/api/socket'
import { Settings, User, Network, Shield, FolderOpen, Bell } from 'lucide-react'

type Tab = 'general' | 'connectivity' | 'sharing' | 'notifications' | 'about'

interface SettingsValues {
  [key: string]: string | number | boolean
}

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: User },
  { id: 'connectivity', label: 'Connectivity', icon: Network },
  { id: 'sharing', label: 'Sharing', icon: FolderOpen },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'about', label: 'About', icon: Shield },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [settings, setSettings] = useState<SettingsValues>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSettings = async () => {
      const socket = getSocket()
      if (!socket) return
      try {
        const data = await socket.get('settings')
        setSettings(data as SettingsValues)
      } catch {
        // Settings may not be directly available as flat object
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-heading text-2xl text-(--color-text-primary)">Settings</h1>

      <div className="flex gap-6">
        {/* Tab nav */}
        <nav className="w-44 shrink-0 space-y-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-(--color-accent)/12 text-(--color-link)'
                    : 'text-(--color-text-secondary) hover:bg-white/5'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 rounded-xl bg-(--color-surface-2) p-6">
          {loading ? (
            <p className="text-caption">Loading settings...</p>
          ) : (
            <SettingsTab tab={activeTab} settings={settings} />
          )}
        </div>
      </div>
    </div>
  )
}

function SettingsTab({ tab, settings }: { tab: Tab; settings: SettingsValues }) {
  switch (tab) {
    case 'general':
      return (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">Profile</h2>
          <p className="text-caption text-sm">
            Configure your nick, description, and email for hub identification.
          </p>
          <SettingRow label="Nick" value={settings['nick'] as string} />
          <SettingRow label="Description" value={settings['description'] as string} />
          <SettingRow label="Email" value={settings['email'] as string} />
        </div>
      )
    case 'connectivity':
      return (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">Connectivity</h2>
          <p className="text-caption text-sm">
            Network and connection settings. AuroraYgg operates over Yggdrasil mesh network.
          </p>
          <SettingRow label="TCP Port" value={settings['tcp_port'] as string} />
          <SettingRow label="UDP Port" value={settings['udp_port'] as string} />
          <SettingRow label="TLS Port" value={settings['tls_port'] as string} />
        </div>
      )
    case 'sharing':
      return (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">Sharing</h2>
          <p className="text-caption text-sm">
            Configure share profiles and upload behavior.
          </p>
          <SettingRow label="Upload Slots" value={settings['upload_slots'] as string} />
          <SettingRow label="Min Upload Speed" value={settings['min_upload_speed'] as string} />
        </div>
      )
    case 'notifications':
      return (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">Notifications</h2>
          <p className="text-caption text-sm">
            Configure how you receive alerts and notifications.
          </p>
        </div>
      )
    case 'about':
      return (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">About</h2>
          <p className="text-caption text-sm">
            Aurora UI for AirDC++ on Yggdrasil mesh network.
          </p>
          <div className="space-y-2">
            <p className="text-xs text-(--color-text-secondary)">
              Frontend: Aurora UI v0.1.0
            </p>
            <p className="text-xs text-(--color-text-secondary)">
              Backend: AirDC++ daemon
            </p>
          </div>
        </div>
      )
  }
}

function SettingRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-(--color-glass-border)">
      <span className="text-sm text-(--color-text-secondary)">{label}</span>
      <span className="text-sm text-(--color-text-primary)">
        {value ?? '—'}
      </span>
    </div>
  )
}
