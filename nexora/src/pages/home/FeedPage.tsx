import { Box, Grid, Stack, Paper, Avatar, Group, Text, Skeleton, Button, Divider, Badge } from '@mantine/core'
import { useState } from 'react'
import { motion } from 'framer-motion'
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
import {
  IconPhoto, IconMoodSmile, IconMapPin, IconSparkles, IconTrendingUp,
  IconRobot, IconFlame, IconHash, IconUsers, IconChartBar, IconBolt,
} from '@tabler/icons-react'
import type { Profile } from '../../types'
import { FEATURED_CHARACTERS } from '../../data/featuredCharacters'

/* ── Suggested User Row ───────────────────────────────────────────────────── */
function SuggestedUser({ profile, currentUserId }: { profile: Profile & { followers_count?: number }; currentUserId: string }) {
  const follow = useFollowUser()
  const navigate = useNavigate()
  const [followed, setFollowed] = useState(false)
  if (profile.id === currentUserId) return null
  return (
    <Group justify="space-between" style={{ padding: '6px 0' }}>
      <Group gap={10} style={{ cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={() => navigate(`/profile/${profile.username}`)}>
        <Avatar src={profile.avatar_url} size={40} radius="xl"
          style={{ border: '2px solid rgba(124,58,237,0.3)', flexShrink: 0 }}>
          {getInitials(profile.full_name || profile.username || '?')}
        </Avatar>
        <Box style={{ minWidth: 0 }}>
          <Text size="sm" fw={600} truncate style={{ color: 'var(--nex-text)' }}>{profile.full_name || profile.username}</Text>
          <Text size="xs" c="dimmed" truncate>@{profile.username}</Text>
        </Box>
      </Group>
      <Button
        size="xs"
        variant={followed ? 'outline' : 'gradient'}
        gradient={{ from: '#7c3aed', to: '#06b6d4' }}
        color={followed ? 'violet' : undefined}
        radius="xl" px={14}
        onClick={() => { follow.mutate({ followingId: profile.id }); setFollowed(true) }}
        loading={follow.isPending}
        disabled={followed}
      >
        {followed ? 'Following' : 'Follow'}
      </Button>
    </Group>
  )
}

/* ── Trending Topic ───────────────────────────────────────────────────────── */
const TRENDING_TOPICS = [
  { tag: 'AITwins', posts: '2.4k posts', color: '#7c3aed' },
  { tag: 'NexoraLaunch', posts: '1.8k posts', color: '#06b6d4' },
  { tag: 'FutureOfAI', posts: '1.2k posts', color: '#f59e0b' },
  { tag: 'DigitalIdentity', posts: '984 posts', color: '#10b981' },
  { tag: 'MetaverseLife', posts: '762 posts', color: '#ec4899' },
]

/* ── Right Sidebar ────────────────────────────────────────────────────────── */
function RightSidebar({ currentUserId }: { currentUserId: string }) {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const { data: suggested = [] } = useQuery<Profile[]>({
    queryKey: ['suggested-users', currentUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, followers_count, plan')
        .neq('id', currentUserId)
        .order('followers_count', { ascending: false })
        .limit(5)
      return (data ?? []) as Profile[]
    },
    staleTime: 1000 * 60 * 5,
  })

  const { data: myStats } = useQuery({
    queryKey: ['my-stats', currentUserId],
    queryFn: async () => {
      const [postsRes, followersRes, followingRes] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact' }).eq('author_id', currentUserId),
        supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', currentUserId),
        supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', currentUserId),
      ])
      return {
        posts: postsRes.count ?? 0,
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
      }
    },
    enabled: !!currentUserId,
    staleTime: 1000 * 60,
  })

  const featuredTwins = FEATURED_CHARACTERS.slice(0, 3)

  return (
    <Stack gap="md">

      {/* ── My Profile Stats ── */}
      <Paper p="md" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
        {/* Gradient header */}
        <Box style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 56,
          background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.1))',
          borderBottom: '1px solid var(--nex-border)',
        }} />
        <Stack gap="sm" style={{ position: 'relative' }}>
          <Group gap={10} mb={4}>
            <Avatar src={profile?.avatar_url} size={44} radius="xl"
              style={{ border: '2px solid rgba(124,58,237,0.5)', marginTop: 4 }}>
              {profile?.full_name ? getInitials(profile.full_name) : '?'}
            </Avatar>
            <Box>
              <Text fw={700} size="sm" style={{ color: 'var(--nex-text)' }}>{profile?.full_name ?? 'You'}</Text>
              <Text size="xs" c="dimmed">@{profile?.username ?? '...'}</Text>
            </Box>
          </Group>
          <Divider color="var(--nex-border)" />
          <Group justify="space-around" pt={4}>
            {[
              { label: 'Posts', value: myStats?.posts ?? 0, icon: IconChartBar, color: '#7c3aed' },
              { label: 'Followers', value: myStats?.followers ?? 0, icon: IconUsers, color: '#06b6d4' },
              { label: 'Following', value: myStats?.following ?? 0, icon: IconBolt, color: '#f59e0b' },
            ].map(stat => (
              <Stack key={stat.label} gap={2} align="center" style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/profile/${profile?.username}`)}>
                <stat.icon size={14} color={stat.color} />
                <Text fw={800} size="sm" style={{ color: 'var(--nex-text)' }}>{stat.value}</Text>
                <Text size="xs" c="dimmed">{stat.label}</Text>
              </Stack>
            ))}
          </Group>
        </Stack>
      </Paper>

      {/* ── Suggested Users ── */}
      <Paper p="md" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 16 }}>
        <Group justify="space-between" mb="sm">
          <Group gap={6}>
            <Box style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(6,182,212,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconSparkles size={14} color="#7c3aed" />
            </Box>
            <Text fw={700} size="sm" style={{ color: 'var(--nex-text)' }}>Suggested for you</Text>
          </Group>
          <Text size="xs" c="violet" fw={600} style={{ cursor: 'pointer' }} onClick={() => navigate('/explore')}>See all</Text>
        </Group>
        <Stack gap={0}>
          {suggested.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="sm">Explore to find people to follow</Text>
          ) : (
            suggested.map((p, i) => (
              <Box key={p.id}>
                <SuggestedUser profile={p} currentUserId={currentUserId} />
                {i < suggested.length - 1 && <Divider color="var(--nex-border)" my={2} />}
              </Box>
            ))
          )}
        </Stack>
      </Paper>

      {/* ── Trending Topics ── */}
      <Paper p="md" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 16 }}>
        <Group gap={6} mb="sm">
          <Box style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(245,158,11,0.12))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconFlame size={14} color="#ef4444" />
          </Box>
          <Text fw={700} size="sm" style={{ color: 'var(--nex-text)' }}>Trending Topics</Text>
        </Group>
        <Stack gap={6}>
          {TRENDING_TOPICS.map((t, i) => (
            <motion.div key={t.tag} whileHover={{ x: 3 }} style={{ cursor: 'pointer' }}
              onClick={() => navigate('/trending')}>
              <Group justify="space-between" style={{ padding: '5px 8px', borderRadius: 10, background: 'var(--nex-input)', border: '1px solid var(--nex-border)' }}>
                <Group gap={8}>
                  <Text size="xs" c="dimmed" fw={700} style={{ minWidth: 16 }}>#{i + 1}</Text>
                  <Box>
                    <Group gap={4}>
                      <IconHash size={11} color={t.color} />
                      <Text size="sm" fw={700} style={{ color: t.color }}>{t.tag}</Text>
                    </Group>
                    <Text size="xs" c="dimmed">{t.posts}</Text>
                  </Box>
                </Group>
                <IconTrendingUp size={14} color={t.color} style={{ opacity: 0.7 }} />
              </Group>
            </motion.div>
          ))}
        </Stack>
      </Paper>

      {/* ── AI Twins Spotlight ── */}
      <Paper p="md" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 16 }}>
        <Group justify="space-between" mb="sm">
          <Group gap={6}>
            <Box style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,rgba(6,182,212,0.15),rgba(124,58,237,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconRobot size={14} color="#06b6d4" />
            </Box>
            <Text fw={700} size="sm" style={{ color: 'var(--nex-text)' }}>AI Twins Spotlight</Text>
          </Group>
          <Text size="xs" c="violet" fw={600} style={{ cursor: 'pointer' }} onClick={() => navigate('/ai-twins')}>Explore</Text>
        </Group>
        <Stack gap={8}>
          {featuredTwins.map(twin => (
            <motion.div key={twin.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/ai-twins/${twin.id}`)}>
              <Group style={{
                padding: '8px 10px', borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(6,182,212,0.06))',
                border: '1px solid var(--nex-border)',
              }} gap={10}>
                <Avatar src={twin.avatar_url} size={40} radius="xl"
                  style={{ border: '2px solid rgba(124,58,237,0.4)', flexShrink: 0 }}>
                  {getInitials(twin.name)}
                </Avatar>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={700} truncate style={{ color: 'var(--nex-text)' }}>{twin.name}</Text>
                  <Text size="xs" c="dimmed" truncate>{twin.personality}</Text>
                </Box>
                <Badge size="xs" variant="gradient" gradient={{ from: '#7c3aed', to: '#06b6d4' }} radius="xl">
                  AI
                </Badge>
              </Group>
            </motion.div>
          ))}
        </Stack>
      </Paper>

      {/* ── Quick Discover ── */}
      <Paper p="md" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 16 }}>
        <Text fw={700} size="sm" mb="sm" style={{ color: 'var(--nex-text)' }}>Discover</Text>
        <Stack gap={4}>
          {[
            { label: 'Explore people', path: '/explore', color: '#7c3aed' },
            { label: 'Trending posts', path: '/trending', color: '#ef4444' },
            { label: 'Communities', path: '/communities', color: '#10b981' },
            { label: 'AI Twins', path: '/ai-twins', color: '#06b6d4' },
            { label: 'Analytics', path: '/analytics', color: '#f59e0b' },
          ].map(item => (
            <motion.div key={item.path} whileHover={{ x: 4 }} style={{ cursor: 'pointer' }}
              onClick={() => navigate(item.path)}>
              <Group gap={8} style={{ padding: '4px 6px', borderRadius: 8 }}>
                <Box style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <Text size="sm" fw={500} style={{ color: 'var(--nex-text)' }}>{item.label}</Text>
              </Group>
            </motion.div>
          ))}
        </Stack>
      </Paper>

      <Text size="xs" c="dimmed" ta="center">© 2025 NEXORA · The AI Twin Network</Text>
    </Stack>
  )
}

/* ── Main Feed Page ───────────────────────────────────────────────────────── */
export default function FeedPage() {
  const { user, profile } = useAuthStore()
  const { data: posts = [], isLoading } = useFeed()
  const [createOpen, setCreateOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <Box px={{ base: 'md', md: 'xl' }} py="lg" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Grid gap={{ base: 'md', md: 'xl' }}>

        {/* ── Main Feed ── */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="md">

            {/* Story Bar */}
            <StoryBar onAddStory={() => setCreateOpen(true)} />

            {/* Create Post Card */}
            <motion.div whileHover={{ y: -1 }}>
              <Paper p="md" style={{
                background: 'var(--nex-surface)',
                border: '1px solid var(--nex-border)',
                borderRadius: 16,
                cursor: 'pointer',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
                onClick={() => setCreateOpen(true)}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.08)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--nex-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <Group mb="sm">
                  <Avatar src={profile?.avatar_url} radius="xl" size={42}
                    style={{ border: '2px solid rgba(124,58,237,0.4)', flexShrink: 0 }}>
                    {profile?.full_name ? getInitials(profile.full_name) : user?.email?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box style={{
                    flex: 1, background: 'var(--nex-input)', borderRadius: 24, padding: '10px 18px',
                    border: '1px solid var(--nex-border)',
                  }}>
                    <Text c="dimmed" size="sm">What&apos;s on your mind, {profile?.full_name?.split(' ')[0] ?? 'there'}?</Text>
                  </Box>
                </Group>
                <Divider color="var(--nex-border)" mb="sm" />
                <Group gap="xl" justify="center">
                  {[
                    { icon: IconPhoto, label: 'Photo', color: '#06b6d4' },
                    { icon: IconMoodSmile, label: 'Feeling', color: '#f59e0b' },
                    { icon: IconMapPin, label: 'Location', color: '#ef4444' },
                  ].map(({ icon: Icon, label, color }) => (
                    <Group key={label} gap={6} style={{ cursor: 'pointer' }}>
                      <Icon size={17} color={color} />
                      <Text size="sm" c="dimmed" fw={500}>{label}</Text>
                    </Group>
                  ))}
                </Group>
              </Paper>
            </motion.div>

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
                <Text style={{ fontSize: 52 }} mb="md">✨</Text>
                <Text fw={700} size="lg" mb={4} style={{ color: 'var(--nex-text)' }}>Your feed is empty</Text>
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

        {/* ── Right Sidebar ── */}
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
