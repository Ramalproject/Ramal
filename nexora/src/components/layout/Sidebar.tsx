import { Stack, Text, Avatar, Group, Badge, Button, UnstyledButton, Divider, Box, Tooltip, ActionIcon } from '@mantine/core'
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  IconHome2, IconCompass, IconTrendingUp, IconMessage2,
  IconRobot, IconUsers, IconChartBar, IconSettings, IconPlus, IconLogout,
  IconSun, IconMoon,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useRooms } from '../../hooks/useMessages'
import CreatePostModal from '../feed/CreatePostModal'
import { getPlanColor, getPlanLabel, getInitials } from '../../utils'

interface Props {
  onMobileClose?: () => void
}

const navItems = [
  { label: 'Home', icon: IconHome2, path: '/' },
  { label: 'Explore', icon: IconCompass, path: '/explore' },
  { label: 'Trending', icon: IconTrendingUp, path: '/trending' },
  { label: 'Messages', icon: IconMessage2, path: '/messages', badge: 'messages' },
  { label: 'AI Twins', icon: IconRobot, path: '/ai-twins' },
  { label: 'Communities', icon: IconUsers, path: '/communities' },
  { label: 'Analytics', icon: IconChartBar, path: '/analytics' },
  { label: 'Settings', icon: IconSettings, path: '/settings' },
]

export default function Sidebar({ onMobileClose }: Props) {
  const [createPostOpen, setCreatePostOpen] = useState(false)
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const { data: rooms = [] } = useRooms()
  const totalUnreadMessages = rooms.reduce((sum, r) => sum + (r.unread_count ?? 0), 0)
  const { setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('dark', { getInitialValueInEffect: true })
  const isDark = computedColorScheme === 'dark'

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login')
  }

  return (
    <Stack h="100%" justify="space-between" p="md" gap={0}>
      <Stack gap="lg">
        {/* Logo */}
        <Box py="sm">
          <Text
            size="xl"
            fw={900}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.5px',
              fontSize: '1.5rem',
            }}
          >
            NEXORA
          </Text>
          <Text size="xs" c="dimmed" mt={2}>The AI Twin Network</Text>
        </Box>

        {/* User info */}
        <Group
          gap="sm"
          p="sm"
          style={{
            background: 'rgba(124, 58, 237, 0.08)',
            borderRadius: 12,
            border: '1px solid rgba(124, 58, 237, 0.2)',
          }}
        >
          <Avatar
            size="md"
            radius="xl"
            src={profile?.avatar_url}
            style={{ border: '2px solid #7c3aed' }}
          >
            {getInitials(profile?.full_name ?? user?.email ?? 'U')}
          </Avatar>
          <Box style={{ flex: 1, overflow: 'hidden' }}>
            <Text size="sm" fw={600} c={isDark ? 'white' : 'dark'} truncate>
              {profile?.full_name ?? user?.email?.split('@')[0] ?? 'User'}
            </Text>
            <Badge size="xs" color={getPlanColor(profile?.plan ?? 'free')} variant="filled" mt={2}>
              {getPlanLabel(profile?.plan ?? 'free')}
            </Badge>
          </Box>
        </Group>

        {/* Create Post Button */}
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreatePostOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            border: 'none',
            fontWeight: 600,
          }}
          radius="xl"
          size="sm"
        >
          Create Post
        </Button>

        {/* Nav Items */}
        <Stack gap={4}>
          {navItems.map((item) => {
            const Icon = item.icon
            const badgeCount = item.badge === 'notifications' ? unreadCount : item.badge === 'messages' ? totalUnreadMessages : 0

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onMobileClose}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  color: isActive ? (isDark ? '#e2e8f0' : '#1a202c') : (isDark ? '#8892b0' : '#4a5568'),
                  background: isActive ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                  borderLeft: isActive ? '3px solid #7c3aed' : '3px solid transparent',
                  transition: 'all 0.15s ease',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.875rem',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} color={isActive ? '#7c3aed' : (isDark ? '#8892b0' : '#4a5568')} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {badgeCount > 0 && (
                      <Badge size="xs" color="violet" variant="filled" circle>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </Badge>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </Stack>
      </Stack>

      {/* Sign Out + Theme Toggle */}
      <Box>
        <Divider color="var(--nex-border)" mb="md" />
        <Group justify="space-between" mb="xs">
          <Tooltip label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'} position="right" withArrow>
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
              aria-label="Toggle color scheme"
              style={{ color: '#8892b0' }}
            >
              {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
          </Tooltip>
        </Group>
        <UnstyledButton
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            color: '#8892b0',
            fontSize: '0.875rem',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#ff6b6b'
            e.currentTarget.style.background = 'rgba(255, 107, 107, 0.08)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#8892b0'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <IconLogout size={20} />
          <span>Sign Out</span>
        </UnstyledButton>
      </Box>

      <CreatePostModal opened={createPostOpen} onClose={() => setCreatePostOpen(false)} />
    </Stack>
  )
}
