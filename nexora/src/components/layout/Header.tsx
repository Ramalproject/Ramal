import { TextInput, Group, ActionIcon, Indicator, Text, Box } from '@mantine/core'
import { IconSearch, IconBell } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../../store/useNotificationStore'
import { useNotificationCount } from '../../hooks/useNotifications'

export default function Header() {
  const navigate = useNavigate()
  const unreadCount = useNotificationStore(s => s.unreadCount)
  useNotificationCount()

  return (
    <Group
      px="xl" h={56}
      style={{ background: 'var(--nex-surface)', borderBottom: '1px solid var(--nex-border)' }}
      justify="space-between"
    >
      {/* Logo */}
      <Box style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
        <Text fw={800} size="lg" style={{
          background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.5px',
        }}>
          NEXORA
        </Text>
      </Box>

      {/* Search + Bell */}
      <Group gap="sm">
        <TextInput
          placeholder="Search..."
          leftSection={<IconSearch size={14} />}
          readOnly
          onClick={() => navigate('/explore')}
          style={{ width: 220, cursor: 'pointer' }}
          styles={{ input: { background: 'var(--nex-input)', border: '1px solid var(--nex-subtle)', cursor: 'pointer' } }}
        />
        <Indicator
          label={unreadCount > 0 ? String(unreadCount > 99 ? '99+' : unreadCount) : undefined}
          size={16} color="red" disabled={unreadCount === 0}
        >
          <ActionIcon
            variant="subtle" c="dimmed" size="lg" radius="xl"
            onClick={() => navigate('/notifications')}
            style={{ background: 'var(--nex-input)' }}
          >
            <IconBell size={20} />
          </ActionIcon>
        </Indicator>
      </Group>
    </Group>
  )
}
