import { Box, Title, Stack, Paper, Group, Text, Button, Loader, Center } from '@mantine/core'
import { IconBell, IconChecks, IconDatabase } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, useMarkRead, useMarkAllRead, useNotificationCount } from '../../hooks/useNotifications'
import { timeAgo } from '../../utils'

const NOTIF_ICONS: Record<string, string> = {
  follow: '👤', like: '❤️', comment: '💬', share: '🔁',
  mention: '@', reply: '↩️', system: '🔔', ai_twin_chat: '🤖',
  community_invite: '👥', community_post: '📢',
}

export default function NotificationsPage() {
  useNotificationCount()
  const navigate = useNavigate()
  const { data: notifs = [], isLoading, error } = useNotifications()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const errMsg = String((error as any)?.message ?? '').toLowerCase()
  const needsSqlFix = !!error && (errMsg.includes('exist') || errMsg.includes('relation') || errMsg.includes('permission') || errMsg.includes('42'))
  const unreadCount = notifs.filter(n => !n.is_read).length

  return (
    <Box p="xl" maw={700} mx="auto">
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <Group gap={10}>
          <Box style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.15))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconBell size={22} color="#7c3aed" />
          </Box>
          <Box>
            <Title order={3} style={{ color: 'var(--nex-text)' }}>Notifications</Title>
            {unreadCount > 0 && <Text size="xs" c="dimmed">{unreadCount} unread</Text>}
          </Box>
        </Group>
        <Button variant="subtle" color="violet" size="sm" radius="xl"
          leftSection={<IconChecks size={15} />}
          onClick={() => markAllRead.mutate()}
          loading={markAllRead.isPending}
          disabled={unreadCount === 0}>
          Mark all read
        </Button>
      </Group>

      {/* SQL Fix Banner */}
      {needsSqlFix && (
        <Paper p="md" mb="lg" style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12,
        }}>
          <Group gap={10} mb={6}>
            <IconDatabase size={18} color="#f59e0b" />
            <Text fw={600} size="sm" style={{ color: '#f59e0b' }}>Database setup required</Text>
          </Group>
          <Text size="xs" c="dimmed" mb={10}>
            The notifications table doesn&apos;t exist yet. Run the SQL fix in Settings → Database to create it.
          </Text>
          <Button size="xs" radius="xl"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}
            leftSection={<IconDatabase size={12} />}
            onClick={() => navigate('/settings?tab=database')}>
            Settings → Database
          </Button>
        </Paper>
      )}

      {isLoading ? (
        <Center py="xl"><Loader color="violet" size="sm" /></Center>
      ) : notifs.length === 0 ? (
        <Paper p="xl" ta="center" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 16 }}>
          <Box style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(6,182,212,0.1))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconBell size={32} color="var(--nex-text-muted)" />
          </Box>
          <Text fw={600} mb={4} style={{ color: 'var(--nex-text)' }}>No notifications yet</Text>
          <Text c="dimmed" size="sm" mb="sm">When people like, comment, or follow you, it will show here.</Text>
          {!needsSqlFix && (
            <Text size="xs" c="dimmed">
              First time?{' '}
              <Text span c="violet" fw={600} style={{ cursor: 'pointer' }} onClick={() => navigate('/settings?tab=database')}>
                Run the SQL fix
              </Text>{' '}in Settings → Database to enable notifications.
            </Text>
          )}
        </Paper>
      ) : (
        <Stack gap="sm">
          {notifs.map(n => (
            <Paper key={n.id} p="md"
              onClick={() => { if (!n.is_read) markRead.mutate(n.id) }}
              style={{
                background: n.is_read ? 'var(--nex-surface)' : 'var(--nex-notif-unread)',
                border: `1px solid ${n.is_read ? 'var(--nex-border)' : 'var(--nex-notif-border)'}`,
                borderRadius: 14, cursor: n.is_read ? 'default' : 'pointer', transition: 'all 0.2s',
              }}>
              <Group justify="space-between" align="flex-start">
                <Group align="flex-start" gap={12}>
                  <Box style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: n.is_read ? 'var(--nex-input)' : 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.15))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>
                    {NOTIF_ICONS[n.type] ?? '🔔'}
                  </Box>
                  <Stack gap={2}>
                    <Text size="sm" fw={n.is_read ? 500 : 700} style={{ color: 'var(--nex-text)' }}>{n.title}</Text>
                    <Text c="dimmed" size="xs" style={{ lineHeight: 1.4 }}>{n.body}</Text>
                    <Text c="dimmed" size="xs">{timeAgo(n.created_at)}</Text>
                  </Stack>
                </Group>
                {!n.is_read && (
                  <Box style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', flexShrink: 0, marginTop: 6 }} />
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  )
}
