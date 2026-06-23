import { Box, Title, Stack, Paper, Group, Text, Badge, Button } from '@mantine/core'
import { IconBell, IconCheckbox } from '@tabler/icons-react'
import { useNotifications, useMarkRead, useMarkAllRead, useNotificationCount } from '../../hooks/useNotifications'
import { timeAgo } from '../../utils'

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
  const { data: notifs = [], isLoading } = useNotifications()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  return (
    <Box p="xl" maw={700} mx="auto">
      <Group justify="space-between" mb="xl">
        <Title order={2} c="white">
          <Group gap={8}><IconBell color="#7c3aed" size={28} /> Notifications</Group>
        </Title>
        <Button
          variant="subtle" color="violet"
          leftSection={<IconCheckbox size={14} />}
          onClick={() => markAllRead.mutate()}
          loading={markAllRead.isPending}
        >
          Mark all read
        </Button>
      </Group>

      {isLoading ? (
        <Text c="dimmed" ta="center">Loading notifications...</Text>
      ) : notifs.length === 0 ? (
        <Paper p="xl" ta="center" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 12 }}>
          <IconBell size={48} color="var(--nex-subtle)" />
          <Text c="dimmed" mt="md">No notifications yet.</Text>
          <Text c="dimmed" size="sm">When people interact with you, you&apos;ll see it here.</Text>
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
                    <Text c="white" size="sm" fw={n.is_read ? 400 : 600}>{n.title}</Text>
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
