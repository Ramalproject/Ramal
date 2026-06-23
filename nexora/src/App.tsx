import { MantineProvider, Loader, Center, ColorSchemeScript, Button, Stack, Text } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { useEffect, Component, type ReactNode } from 'react'
import { queryClient } from './lib/queryClient'
import { nexoraTheme } from './lib/theme'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/useAuthStore'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import FeedPage from './pages/home/FeedPage'
import ProfilePage from './pages/profile/ProfilePage'
import MessagesPage from './pages/messages/MessagesPage'
import AiTwinsPage from './pages/ai-twins/AiTwinsPage'
import TwinDetailPage from './pages/ai-twins/TwinDetailPage'
import TrendingPage from './pages/trending/TrendingPage'
import AnalyticsPage from './pages/analytics/AnalyticsPage'
import SettingsPage from './pages/settings/SettingsPage'
import ExplorePage from './pages/explore/ExplorePage'
import CommunitiesPage from './pages/communities/CommunitiesPage'
import NotificationsPage from './pages/notifications/NotificationsPage'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; msg: string }> {
  state = { hasError: false, msg: '' }
  static getDerivedStateFromError(e: Error) { return { hasError: true, msg: e?.message ?? 'Unknown error' } }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <Center h="100vh" style={{ background: 'var(--nex-bg)' }}>
        <Stack align="center" gap="md" maw={400} ta="center">
          <Text style={{ fontSize: 48 }}>⚠️</Text>
          <Text fw={700} size="lg" style={{ color: 'var(--nex-text)' }}>Something went wrong</Text>
          <Text size="sm" c="dimmed">{this.state.msg}</Text>
          <Button
            variant="gradient" gradient={{ from: '#7c3aed', to: '#5b21b6' }} radius="xl"
            onClick={() => { this.setState({ hasError: false, msg: '' }); window.location.hash = '/' }}
          >
            Go to Home
          </Button>
        </Stack>
      </Center>
    )
  }
}

function AuthInitializer() {
  const setUser = useAuthStore(s => s.setUser)
  const setLoading = useAuthStore(s => s.setLoading)

  useEffect(() => {
    setLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [setUser, setLoading])

  return null
}

function ProtectedRoute() {
  const user = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)
  if (loading) return <Center h="100vh"><Loader color="violet" size="lg" /></Center>
  if (!user) return <Navigate to="/auth/login" replace />
  return <Outlet />
}

export default function App() {
  return (
    <MantineProvider theme={nexoraTheme} defaultColorScheme="dark">
      <ColorSchemeScript defaultColorScheme="dark" />
      <Notifications position="top-right" />
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <HashRouter>
            <ErrorBoundary>
              <AuthInitializer />
              <Routes>
                <Route path="/auth/login" element={<LoginPage />} />
                <Route path="/auth/register" element={<RegisterPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route index element={<FeedPage />} />
                    <Route path="profile/:username" element={<ProfilePage />} />
                    <Route path="messages" element={<MessagesPage />} />
                    <Route path="messages/:roomId" element={<MessagesPage />} />
                    <Route path="ai-twins" element={<AiTwinsPage />} />
                    <Route path="ai-twins/:id" element={<TwinDetailPage />} />
                    <Route path="trending" element={<TrendingPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="explore" element={<ExplorePage />} />
                    <Route path="communities" element={<CommunitiesPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </HashRouter>
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  )
}
