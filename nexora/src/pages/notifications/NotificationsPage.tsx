import { Box, Title, Stack, Paper, Group, Text, Badge, Button, Alert } from '@mantine/core'
import { IconBell, IconCheckbox, IconDatabase } from '@tabler/icons-react'
import { useNotifications, useMarkRead, useMarkAllRead, useNotificationCount } from '../../hooks/useNotifications'
import { timeAgo } from '../../utils'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'

const NOTIF_ICONS: Record<string, string> = {
  follow: '👤',
  like: '❤️',
  comment: '💬',
  share: '🔁',
  mention: '@',
  reply: '↩️',
  system: '🔔',
  ai_twin_chat: '🤖',
  community_invite: '👥',
  community_post: '📢',
}

export default function NotificationsPage() {
  useNotificationCount()
  const { data: notifs = [], isLoading, error } = useNotifications()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const navigate = useNavigate()
  const authUser = useAuthStore(s => s.user)

  // Check if notifications table exists
  const { data: tableExists } = useQuery({
    queryKey: ['notif-table-check', authUser?.id],
    queryFn: async () => {
      const { error } = await supabase.from('notifications').select('id').limit(1)
      return !error || !error.message?.toLowerCase().includes('exist')
    },
    enabled: !!authUser?.id,
    staleTime: 1000 * 60 * 5,
  })

  const needsSqlFix = tableExists === false || (error as any)?.message?.toLowerCase().includes('exist')

  return (
    <Box p="xl" maw={700} mx="auto">
      <Group justify="space-between" mb="xl">
        <Title order={2}>
          <Group gap={8}><IconBell color="#7c3aed" size={28} /> Notifications</Group>
        </Title>
        <Button
          variant="subtle" color="violet"
          leftSection={<IconCheckbox size={14} />}
          onClick={() => markAllRead.mutate()}
          loading={markAllRead.isPending}
          disabled={notifs.length === 0}
        >
          Mark all read
        </Button>
      </Group>

      {needsSqlFix && (
        <Alert color="orange" icon={<IconDatabase size={16} />} title="Notifications table missing" radius="md" mb="lg">
          <Text size="xs" mb={8}>
            The notifications table does not exist yet. Run the SQL fix in Settings → Database to create it.
          </Text>
          <Button size="xs" leftSection={<IconDatabase size={13} />}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}
            onClick={() => navigate('/settings?tab=database')}>
            Go to Settings → Database
          </Button>
        </Alert>
      )}

      {isLoading ? (
        <Text c="dimmed" ta="center">Loading notifications...</Text>
      ) : notifs.length === 0 ? (
        <Paper p="xl" ta="center" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 12 }}>
          <IconBell size={48} color="var(--nex-subtle)" />
          <Text c="dimmed" mt="md">No notifications yet.</Text>
          <Text c="dimmed" size="sm">When people like, comment, or follow you, it will show here.</Text>
        </Paper>
      ) : (
        <Stack gap="sm">
          {notifs.map(n => (
            <Paper
              key={n.id}
              p="md"
              onClick={() => { if (!n.is_read) markRead.mutate(n.id) }}
              style={{
                background: n.is_read ? 'var(--nex-surface)' : 'var(--nex-notif-unread)',
                border: `1px solid ${n.is_read ? 'var(--nex-border)' : 'var(--nex-notif-border)'}`,
                borderRadius: 12,
                cursor: n.is_read ? 'default' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <Group justify="space-between">
                <Group>
                  <Text size="xl">{NOTIF_ICONS[n.type] ?? '🔔'}</Text>
                  <Stack gap={2}>
                    <Text size="sm" fw={n.is_read ? 400 : 600}>{n.title}</Text>
                    <Text c="dimmed" size="xs">{n.body}</Text>
                    <Text c="dimmed" size="xs">{timeAgo(n.created_at)}</Text>
                  </Stack>
                </Group>
                {!n.is_read && <Badge size="xs" color="violet" variant="filled">New</Badge>}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  )
}
