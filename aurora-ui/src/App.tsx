import { HashRouter, Routes, Route, Navigate } from 'react-router'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
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

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}
