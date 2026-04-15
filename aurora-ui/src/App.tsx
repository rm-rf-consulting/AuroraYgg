import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { Spinner } from '@/components/shared/Spinner'
import { useAuthStore } from '@/stores/authStore'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { HomePage } from '@/pages/HomePage'
import { SearchPage } from '@/pages/SearchPage'
import { QueuePage } from '@/pages/QueuePage'
import { TransfersPage } from '@/pages/TransfersPage'
import { SharePage } from '@/pages/SharePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { FavoriteHubsPage } from '@/pages/FavoriteHubsPage'
import { HubSession } from '@/pages/sessions/HubSession'
import { MessageSession } from '@/pages/sessions/MessageSession'
import { FilelistSession } from '@/pages/sessions/FilelistSession'
import { EventsSession } from '@/pages/sessions/EventsSession'
import { PeersPage } from '@/pages/PeersPage'
import { AdminPage } from '@/pages/AdminPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { SetupWizard } from '@/pages/SetupWizard'
import { ShareLinksPage } from '@/pages/ShareLinksPage'

function AppBootstrap() {
  const tryReconnect = useAuthStore((s) => s.tryReconnect)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Try to reconnect with saved refresh token before rendering routes
    const hasToken = !!localStorage.getItem('aurora_refresh_token')
    if (hasToken) {
      tryReconnect().finally(() => setReady(true))
    } else {
      setReady(true)
    }
  }, [tryReconnect])

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-(--color-bg-primary)">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={24} />
          <span className="text-caption text-sm">Reconnecting...</span>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/setup" element={<SetupWizard />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="transfers" element={<TransfersPage />} />
        <Route path="share" element={<SharePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="favorites" element={<FavoriteHubsPage />} />
        <Route path="hubs/:id" element={<HubSession />} />
        <Route path="messages/:id" element={<MessageSession />} />
        <Route path="filelists/:id" element={<FilelistSession />} />
        <Route path="events" element={<EventsSession />} />
        <Route path="peers" element={<PeersPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="links" element={<ShareLinksPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppBootstrap />
      </HashRouter>
    </ErrorBoundary>
  )
}
