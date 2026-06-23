import { Box, Stack, Paper, Avatar, Group, Text, Skeleton, Center } from '@mantine/core'
import { useState } from 'react'
import { useFeed } from '../../hooks/usePosts'
import { useAuthStore } from '../../store/useAuthStore'
import { getInitials } from '../../utils'
import PostCard from '../../components/feed/PostCard'
import CreatePostModal from '../../components/feed/CreatePostModal'
import StoryBar from '../../components/feed/StoryBar'

export default function FeedPage() {
  const profile = useAuthStore(s => s.profile)
  const { data: posts = [], isLoading } = useFeed()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <Box maw={680} mx="auto" px="md" py="xl">
      <StoryBar />

      <Paper
        mb="md" p="md"
        style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12, cursor: 'pointer' }}
        onClick={() => setCreateOpen(true)}
      >
        <Group>
          <Avatar src={profile?.avatar_url} radius="xl" size="md">
            {profile?.full_name ? getInitials(profile.full_name) : '?'}
          </Avatar>
          <Text c="dimmed" style={{ flex: 1 }}>What&apos;s on your mind?</Text>
        </Group>
      </Paper>

      {isLoading ? (
        <Stack>
          {[1, 2, 3].map(i => <Skeleton key={i} height={200} radius="md" />)}
        </Stack>
      ) : posts.length === 0 ? (
        <Center py="xl">
          <Text c="dimmed">No posts yet. Follow people to see their posts here.</Text>
        </Center>
      ) : (
        <Stack gap="md">
          {posts.map(post => <PostCard key={post.id} post={post} />)}
        </Stack>
      )}

      <CreatePostModal opened={createOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  )
}
