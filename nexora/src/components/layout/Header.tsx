import { TextInput, Group, ActionIcon, Indicator } from '@mantine/core'
import { IconSearch, IconBell } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../../store/useNotificationStore'

export default function Header() {
  const navigate = useNavigate()
  const unreadCount = useNotificationStore(s => s.unreadCount)

  return (
    <Group px="md" py="sm" style={{ background: '#0d0d1a', borderBottom: '1px solid #1e1e3a' }} justify="space-between">
      <TextInput
        placeholder="Search..."
        leftSection={<IconSearch size={14} />}
        readOnly
        onClick={() => navigate('/explore')}
        style={{ width: 240, cursor: 'pointer' }}
        styles={{ input: { background: '#1a1a2e', border: '1px solid #2d2d4e', color: '#e2e8f0', cursor: 'pointer' } }}
      />
      <Indicator label={unreadCount > 0 ? String(unreadCount) : undefined} size={16} color="red" disabled={unreadCount === 0}>
        <ActionIcon variant="subtle" c="dimmed" size="lg" onClick={() => navigate('/notifications')}>
          <IconBell size={20} />
        </ActionIcon>
      </Indicator>
    </Group>
  )
}
