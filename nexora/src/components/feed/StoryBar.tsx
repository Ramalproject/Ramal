import { ScrollArea, Avatar, Stack, Text, Box, UnstyledButton } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useAuthStore } from '../../store/useAuthStore'
import { getInitials } from '../../utils'

const MOCK_STORIES = [
  { id: '1', full_name: 'Alex Johnson', avatar_url: null as string | null, seen: false },
  { id: '2', full_name: 'Sara Chen', avatar_url: null as string | null, seen: false },
  { id: '3', full_name: 'Mike Davis', avatar_url: null as string | null, seen: true },
  { id: '4', full_name: 'Anna Park', avatar_url: null as string | null, seen: false },
  { id: '5', full_name: 'James Wilson', avatar_url: null as string | null, seen: true },
]

export default function StoryBar() {
  const profile = useAuthStore(s => s.profile)

  return (
    <ScrollArea mb="md" scrollbarSize={4}>
      <Box style={{ display: 'flex', gap: 16, paddingBottom: 8, paddingTop: 4 }}>
        <UnstyledButton>
          <Stack gap={4} align="center">
            <Box style={{ position: 'relative' }}>
              <Avatar
                src={profile?.avatar_url}
                radius="xl"
                size={56}
                style={{ border: '2px solid #7c3aed' }}
              >
                {profile?.full_name ? getInitials(profile.full_name) : '?'}
              </Avatar>
              <Box style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 20, height: 20, borderRadius: '50%',
                background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--nex-bg)'
              }}>
                <IconPlus size={10} color="white" />
              </Box>
            </Box>
            <Text size="xs" c="dimmed" ta="center" style={{ maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Your Story
            </Text>
          </Stack>
        </UnstyledButton>

        {MOCK_STORIES.map(story => (
          <UnstyledButton key={story.id}>
            <Stack gap={4} align="center">
              <Avatar
                src={story.avatar_url}
                radius="xl"
                size={56}
                style={{ border: `3px solid ${story.seen ? 'var(--nex-subtle)' : '#7c3aed'}`, padding: 2 }}
              >
                {getInitials(story.full_name)}
              </Avatar>
              <Text size="xs" c={story.seen ? 'dimmed' : 'white'} ta="center" style={{ maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {story.full_name.split(' ')[0]}
              </Text>
            </Stack>
          </UnstyledButton>
        ))}
      </Box>
    </ScrollArea>
  )
}
