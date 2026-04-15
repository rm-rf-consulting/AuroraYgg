import { useEffect, useState } from 'react'
import { getSocket } from '@/api/socket'
import { toast } from '@/components/shared/Toast'
import { User, Network, Shield, FolderOpen, Bell, Save } from 'lucide-react'

type Tab = 'general' | 'connectivity' | 'sharing' | 'notifications' | 'about'

interface SettingsValues {
  [key: string]: string | number | boolean
}

const SETTINGS_KEYS = [
  'nick', 'description', 'email',
  'tcp_port', 'udp_port', 'tls_port',
  'upload_slots', 'min_upload_speed',
]

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
  const [editedSettings, setEditedSettings] = useState<SettingsValues>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      const socket = getSocket()
      if (!socket) { setLoading(false); return }
      try {
        const data = await socket.post('settings/get', { keys: SETTINGS_KEYS })
        if (data && typeof data === 'object') {
          setSettings(data as SettingsValues)
          setEditedSettings(data as SettingsValues)
        }
      } catch {
        // Fallback: try individual keys
        try {
          const results: SettingsValues = {}
          for (const key of SETTINGS_KEYS) {
            try {
              const val = await socket.post('settings/get', { keys: [key] })
              if (val && typeof val === 'object') {
                Object.assign(results, val)
              }
            } catch { /* skip */ }
          }
          if (Object.keys(results).length > 0) {
            setSettings(results)
            setEditedSettings(results)
          }
        } catch { /* ignore */ }
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleChange = (key: string, value: string) => {
    setEditedSettings((prev) => ({ ...prev, [key]: value }))
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(editedSettings)

  const handleSave = async () => {
    const socket = getSocket()
    if (!socket) return

    setSaving(true)
    try {
      // Only send changed keys
      const changed: SettingsValues = {}
      for (const [key, val] of Object.entries(editedSettings)) {
        if (settings[key] !== val) {
          changed[key] = val
        }
      }
      if (Object.keys(changed).length > 0) {
        await socket.post('settings/set', changed)
        setSettings({ ...editedSettings })
        toast.success('Settings saved')
      }
    } catch {
      toast.error('Failed to save settings')
    }
    setSaving(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading text-2xl text-(--color-text-primary)">Settings</h1>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save size={13} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

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
            <SettingsTab
              tab={activeTab}
              settings={editedSettings}
              onChange={handleChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SettingsTab({
  tab,
  settings,
  onChange,
}: {
  tab: Tab
  settings: SettingsValues
  onChange: (key: string, value: string) => void
}) {
  switch (tab) {
    case 'general':
      return (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">Profile</h2>
          <p className="text-caption text-sm">
            Configure your nick, description, and email for hub identification.
          </p>
          <SettingInput label="Nick" settingKey="nick" value={settings['nick']} onChange={onChange} />
          <SettingInput label="Description" settingKey="description" value={settings['description']} onChange={onChange} />
          <SettingInput label="Email" settingKey="email" value={settings['email']} onChange={onChange} />
        </div>
      )
    case 'connectivity':
      return (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">Connectivity</h2>
          <p className="text-caption text-sm">
            Network and connection settings. AuroraYgg operates over Yggdrasil mesh network.
          </p>
          <SettingInput label="TCP Port" settingKey="tcp_port" value={settings['tcp_port']} onChange={onChange} />
          <SettingInput label="UDP Port" settingKey="udp_port" value={settings['udp_port']} onChange={onChange} />
          <SettingInput label="TLS Port" settingKey="tls_port" value={settings['tls_port']} onChange={onChange} />
        </div>
      )
    case 'sharing':
      return (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">Sharing</h2>
          <p className="text-caption text-sm">
            Configure share profiles and upload behavior.
          </p>
          <SettingInput label="Upload Slots" settingKey="upload_slots" value={settings['upload_slots']} onChange={onChange} />
          <SettingInput label="Min Upload Speed (KiB/s)" settingKey="min_upload_speed" value={settings['min_upload_speed']} onChange={onChange} />
        </div>
      )
    case 'notifications':
      return (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">Notifications</h2>
          <p className="text-caption text-sm">
            Configure how you receive alerts and notifications.
          </p>
          <p className="text-micro py-8 text-center">Coming soon</p>
        </div>
      )
    case 'about':
      return (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">About</h2>
          <p className="text-caption text-sm">
            Aurora UI for AirDC++ on Yggdrasil mesh network.
          </p>
          <div className="space-y-2 pt-2">
            <InfoRow label="Frontend" value="Aurora UI v0.1.0" />
            <InfoRow label="Backend" value="AirDC++ daemon" />
            <InfoRow label="Network" value="Yggdrasil (200::/7)" />
            <InfoRow label="Protocol" value="ADC / NMDC" />
          </div>
        </div>
      )
  }
}

function SettingInput({
  label,
  settingKey,
  value,
  onChange,
}: {
  label: string
  settingKey: string
  value: string | number | boolean | undefined
  onChange: (key: string, value: string) => void
}) {
  const displayValue = value !== undefined && value !== '' ? String(value) : ''
  return (
    <div className="flex items-center justify-between py-2 border-b border-(--color-glass-border) gap-4">
      <span className="text-sm text-(--color-text-secondary) shrink-0">{label}</span>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => onChange(settingKey, e.target.value)}
        placeholder="—"
        className="text-right text-sm text-(--color-text-primary) bg-transparent border-none outline-none w-48 placeholder:text-(--color-text-disabled)"
      />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-(--color-text-tertiary)">{label}</span>
      <span className="text-xs text-(--color-text-secondary)">{value}</span>
    </div>
  )
}
