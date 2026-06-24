import { ScrollArea, Avatar, Text, Box, UnstyledButton } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../store/useAuthStore'
import { getInitials } from '../../utils'

const MOCK_STORIES = [
  { id: '1', full_name: 'Alex Johnson', avatar_url: null as string | null, seen: false, gradient: 'linear-gradient(135deg,#7c3aed,#06b6d4)' },
  { id: '2', full_name: 'Sara Chen',    avatar_url: null as string | null, seen: false, gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
  { id: '3', full_name: 'Mike Davis',   avatar_url: null as string | null, seen: true,  gradient: 'linear-gradient(135deg,#6b7280,#9ca3af)' },
  { id: '4', full_name: 'Anna Park',    avatar_url: null as string | null, seen: false, gradient: 'linear-gradient(135deg,#10b981,#06b6d4)' },
  { id: '5', full_name: 'James Wilson', avatar_url: null as string | null, seen: true,  gradient: 'linear-gradient(135deg,#6b7280,#9ca3af)' },
  { id: '6', full_name: 'Priya Mehta',  avatar_url: null as string | null, seen: false, gradient: 'linear-gradient(135deg,#ec4899,#8b5cf6)' },
  { id: '7', full_name: 'Tom Lee',      avatar_url: null as string | null, seen: false, gradient: 'linear-gradient(135deg,#f97316,#eab308)' },
]

interface Props {
  onAddStory?: () => void
}

export default function StoryBar({ onAddStory }: Props) {
  const profile = useAuthStore(s => s.profile)

  return (
    <Box style={{
      background: 'var(--nex-surface)',
      border: '1px solid var(--nex-border)',
      borderRadius: 16,
      padding: '14px 16px',
    }}>
      <ScrollArea scrollbarSize={4} type="scroll">
        <Box style={{ display: 'flex', gap: 14, paddingBottom: 4, paddingTop: 2 }}>

          {/* Your Story */}
          <UnstyledButton onClick={onAddStory} style={{ flexShrink: 0 }}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Box style={{ position: 'relative' }}>
                {/* Gradient ring */}
                <Box style={{
                  width: 68, height: 68, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#7c3aed,#06b6d4)',
                  padding: 2.5, boxShadow: '0 2px 12px rgba(124,58,237,0.4)',
                }}>
                  <Box style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--nex-bg)', padding: 2 }}>
                    <Avatar
                      src={profile?.avatar_url}
                      radius="xl"
                      size="100%"
                    >
                      {profile?.full_name ? getInitials(profile.full_name) : '?'}
                    </Avatar>
                  </Box>
                </Box>
                {/* Plus button */}
                <Box style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--nex-bg)',
                  boxShadow: '0 2px 6px rgba(124,58,237,0.5)',
                }}>
                  <IconPlus size={11} color="white" />
                </Box>
              </Box>
              <Text size="xs" fw={600} ta="center" style={{ maxWidth: 64, color: 'var(--nex-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Your Story
              </Text>
            </motion.div>
          </UnstyledButton>

          {/* Divider */}
          <Box style={{ width: 1, background: 'var(--nex-border)', alignSelf: 'stretch', margin: '4px 0' }} />

          {/* Other stories */}
          {MOCK_STORIES.map(story => (
            <UnstyledButton key={story.id} style={{ flexShrink: 0 }}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Box style={{ position: 'relative' }}>
                  <Box style={{
                    width: 68, height: 68, borderRadius: '50%',
                    background: story.seen ? 'var(--nex-border)' : story.gradient,
                    padding: 2.5,
                    boxShadow: story.seen ? 'none' : '0 2px 10px rgba(124,58,237,0.25)',
                  }}>
                    <Box style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--nex-bg)', padding: 2 }}>
                      <Avatar
                        src={story.avatar_url}
                        radius="xl"
                        size="100%"
                        style={{ background: story.gradient }}
                      >
                        <Text size="sm" fw={700} style={{ color: 'white' }}>{getInitials(story.full_name)}</Text>
                      </Avatar>
                    </Box>
                  </Box>
                  {/* Live dot for unseen */}
                  {!story.seen && (
                    <Box style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 10, height: 10, borderRadius: '50%',
                      background: '#10b981', border: '2px solid var(--nex-bg)',
                    }} />
                  )}
                </Box>
                <Text size="xs" fw={story.seen ? 400 : 600} ta="center"
                  style={{ maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: story.seen ? 'var(--nex-text-muted)' : 'var(--nex-text)' }}>
                  {story.full_name.split(' ')[0]}
                </Text>
              </motion.div>
            </UnstyledButton>
          ))}
        </Box>
      </ScrollArea>
    </Box>
  )
}
