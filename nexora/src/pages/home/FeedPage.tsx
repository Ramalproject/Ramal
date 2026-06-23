import { Box, Grid, Stack, Paper, Avatar, Group, Text, Skeleton, Button, Divider } from '@mantine/core'
import { useState } from 'react'
import { useFeed } from '../../hooks/usePosts'
import { useAuthStore } from '../../store/useAuthStore'
import { getInitials } from '../../utils'
import PostCard from '../../components/feed/PostCard'
import CreatePostModal from '../../components/feed/CreatePostModal'
import StoryBar from '../../components/feed/StoryBar'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useFollowUser } from '../../hooks/useProfile'
import { IconPhoto, IconMoodSmile, IconMapPin, IconSparkles } from '@tabler/icons-react'
import type { Profile } from '../../types'

function SuggestedUser({ profile, currentUserId }: { profile: Profile & { followers_count?: number }; currentUserId: string }) {
  const follow = useFollowUser()
  const navigate = useNavigate()
  if (profile.id === currentUserId) return null
  return (
    <Group justify="space-between" style={{ padding: '6px 0' }}>
      <Group gap={10} style={{ cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={() => navigate(`/profile/${profile.username}`)}>
        <Avatar src={profile.avatar_url} size={38} radius="xl" style={{ border: '2px solid var(--nex-border)', flexShrink: 0 }}>
          {getInitials(profile.full_name || profile.username || '?')}
        </Avatar>
        <Box style={{ minWidth: 0 }}>
          <Text size="sm" fw={600} truncate>{profile.full_name || profile.username}</Text>
          <Text size="xs" c="dimmed" truncate>@{profile.username}</Text>
        </Box>
      </Group>
      <Button size="xs" variant="light" color="violet" radius="xl" px={12}
        onClick={() => follow.mutate({ followingId: profile.id })}
        loading={follow.isPending}>
        Follow
      </Button>
    </Group>
  )
}

function RightSidebar({ currentUserId }: { currentUserId: string }) {
  const navigate = useNavigate()
  const { data: suggested = [] } = useQuery<Profile[]>({
    queryKey: ['suggested-users', currentUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, followers_count, plan')
        .neq('id', currentUserId)
        .order('followers_count', { ascending: false })
        .limit(6)
      return (data ?? []) as Profile[]
    },
    staleTime: 1000 * 60 * 5,
  })

  return (
    <Stack gap="md">
      {/* Suggested Users */}
      <Paper p="md" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 16 }}>
        <Group justify="space-between" mb="sm">
          <Group gap={6}>
            <IconSparkles size={16} color="#7c3aed" />
            <Text fw={700} size="sm">Suggested for you</Text>
          </Group>
          <Text size="xs" c="violet" fw={500} style={{ cursor: 'pointer' }} onClick={() => navigate('/explore')}>See all</Text>
        </Group>
        <Stack gap={0}>
          {suggested.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="sm">Explore to find people to follow</Text>
          ) : (
            suggested.map((p, i) => (
              <Box key={p.id}>
                <SuggestedUser profile={p} currentUserId={currentUserId} />
                {i < suggested.length - 1 && <Divider color="var(--nex-border)" my={4} />}
              </Box>
            ))
          )}
        </Stack>
      </Paper>

      {/* Quick links */}
      <Paper p="md" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 16 }}>
        <Text fw={700} size="sm" mb="sm">Discover</Text>
        <Stack gap={6}>
          {[
            { label: 'Explore people', path: '/explore' },
            { label: 'Trending posts', path: '/trending' },
            { label: 'Communities', path: '/communities' },
            { label: 'AI Twins', path: '/ai-twins' },
          ].map(item => (
            <Text key={item.path} size="sm" c="violet" fw={500} style={{ cursor: 'pointer' }}
              onClick={() => navigate(item.path)}>
              → {item.label}
            </Text>
          ))}
        </Stack>
      </Paper>

      <Text size="xs" c="dimmed" ta="center">© 2025 NEXORA · The AI Twin Network</Text>
    </Stack>
  )
}

export default function FeedPage() {
  const { user, profile } = useAuthStore()
  const { data: posts = [], isLoading } = useFeed()
  const [createOpen, setCreateOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <Box px={{ base: 'md', md: 'xl' }} py="lg" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Grid gap={{ base: 'md', md: 'xl' }}>
        {/* ── Main Feed ─────────────── */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="md">
            <StoryBar />

            {/* Create Post Card */}
            <Paper p="md" style={{
              background: 'var(--nex-surface)',
              border: '1px solid var(--nex-border)',
              borderRadius: 16,
              cursor: 'pointer',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
              onClick={() => setCreateOpen(true)}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.1)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--nex-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <Group mb="sm">
                <Avatar src={profile?.avatar_url} radius="xl" size={40} style={{ border: '2px solid rgba(124,58,237,0.4)' }}>
                  {profile?.full_name ? getInitials(profile.full_name) : user?.email?.[0]?.toUpperCase()}
                </Avatar>
                <Box style={{
                  flex: 1, background: 'var(--nex-input)', borderRadius: 20, padding: '10px 16px',
                  border: '1px solid var(--nex-subtle)',
                }}>
                  <Text c="dimmed" size="sm">What&apos;s on your mind, {profile?.full_name?.split(' ')[0] ?? 'there'}?</Text>
                </Box>
              </Group>
              <Divider color="var(--nex-border)" mb="sm" />
              <Group gap="lg" justify="center">
                <Group gap={6} c="dimmed" style={{ fontSize: 13, fontWeight: 500 }}>
                  <IconPhoto size={16} color="#06b6d4" />
                  <Text size="sm" c="dimmed">Photo</Text>
                </Group>
                <Group gap={6} c="dimmed" style={{ fontSize: 13, fontWeight: 500 }}>
                  <IconMoodSmile size={16} color="#f59e0b" />
                  <Text size="sm" c="dimmed">Feeling</Text>
                </Group>
                <Group gap={6} c="dimmed" style={{ fontSize: 13, fontWeight: 500 }}>
                  <IconMapPin size={16} color="#ef4444" />
                  <Text size="sm" c="dimmed">Location</Text>
                </Group>
              </Group>
            </Paper>

            {/* Feed */}
            {isLoading ? (
              <Stack>
                {[1, 2, 3].map(i => (
                  <Paper key={i} p="md" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 16 }}>
                    <Group mb="md">
                      <Skeleton height={44} circle />
                      <Stack gap={6} style={{ flex: 1 }}>
                        <Skeleton height={12} width="40%" radius="xl" />
                        <Skeleton height={10} width="25%" radius="xl" />
                      </Stack>
                    </Group>
                    <Skeleton height={14} mb={8} radius="xl" />
                    <Skeleton height={14} width="80%" mb={8} radius="xl" />
                    <Skeleton height={180} radius="md" />
                  </Paper>
                ))}
              </Stack>
            ) : posts.length === 0 ? (
              <Paper p="xl" ta="center" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 16 }}>
                <Text style={{ fontSize: 48 }} mb="md">✨</Text>
                <Text fw={600} size="lg" mb={4}>Your feed is empty</Text>
                <Text c="dimmed" size="sm" mb="lg">Follow people to see their posts here</Text>
                <Button variant="gradient" gradient={{ from: '#7c3aed', to: '#06b6d4' }} radius="xl"
                  onClick={() => navigate('/explore')}>
                  Explore People
                </Button>
              </Paper>
            ) : (
              <Stack gap="md">
                {posts.map(post => <PostCard key={post.id} post={post} />)}
              </Stack>
            )}
          </Stack>
        </Grid.Col>

        {/* ── Right Sidebar ─────────── */}
        <Grid.Col span={{ base: 12, md: 5 }} visibleFrom="md">
          <Box style={{ position: 'sticky', top: 72 }}>
            <RightSidebar currentUserId={user?.id ?? ''} />
          </Box>
        </Grid.Col>
      </Grid>

      <CreatePostModal opened={createOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  )
}
