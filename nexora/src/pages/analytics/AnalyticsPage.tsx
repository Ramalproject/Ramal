import { Box, Grid, Paper, Text, Title, Stack, Group, Skeleton, RingProgress } from '@mantine/core'
import { IconHeart, IconMessageCircle, IconUsers, IconFileText, IconTrendingUp, IconRobot } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { formatNumber } from '../../utils'

function useMyStats(userId: string) {
  return useQuery({
    queryKey: ['analytics', 'stats', userId],
    queryFn: async () => {
      const [postsRes, profileRes] = await Promise.all([
        supabase.from('posts').select('id, likes_count, comments_count').eq('author_id', userId),
        supabase.from('profiles').select('followers_count, following_count, posts_count').eq('id', userId).single()
      ])
      const posts = postsRes.data ?? []
      const totalLikes = posts.reduce((sum, p) => sum + (p.likes_count ?? 0), 0)
      const totalComments = posts.reduce((sum, p) => sum + (p.comments_count ?? 0), 0)
      const profile = profileRes.data
      return {
        totalLikes,
        totalComments,
        totalPosts: posts.length,
        followers: profile?.followers_count ?? 0,
        following: profile?.following_count ?? 0,
      }
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  })
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <Paper p="lg" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 12 }}>
      <Group>
        <Box style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {icon}
        </Box>
        <Stack gap={2}>
          <Text size="xl" fw={800} c="white">{formatNumber(value)}</Text>
          <Text size="sm" c="dimmed">{label}</Text>
        </Stack>
      </Group>
    </Paper>
  )
}

export default function AnalyticsPage() {
  const user = useAuthStore(s => s.user)
  const { data: stats, isLoading } = useMyStats(user?.id ?? '')

  const statsCards = [
    { icon: <IconHeart size={24} color="#ef4444" />, label: 'Total Likes', value: stats?.totalLikes ?? 0, color: '#ef4444' },
    { icon: <IconMessageCircle size={24} color="#3b82f6" />, label: 'Total Comments', value: stats?.totalComments ?? 0, color: '#3b82f6' },
    { icon: <IconFileText size={24} color="#7c3aed" />, label: 'Posts Published', value: stats?.totalPosts ?? 0, color: '#7c3aed' },
    { icon: <IconUsers size={24} color="#06b6d4" />, label: 'Followers', value: stats?.followers ?? 0, color: '#06b6d4' },
    { icon: <IconUsers size={24} color="#f59e0b" />, label: 'Following', value: stats?.following ?? 0, color: '#f59e0b' },
    {
      icon: <IconRobot size={24} color="#10b981" />,
      label: 'Avg Engagement / Post',
      value: stats ? Math.round((stats.totalLikes + stats.totalComments) / Math.max(stats.totalPosts, 1)) : 0,
      color: '#10b981'
    },
  ]

  return (
    <Box p="xl" maw={900} mx="auto">
      <Title order={2} c="white" mb="xl">
        <Group gap={8}><IconTrendingUp color="#7c3aed" size={28} /> Analytics</Group>
      </Title>

      {isLoading ? (
        <Grid>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4 }}><Skeleton height={100} radius="md" /></Grid.Col>
          ))}
        </Grid>
      ) : (
        <Grid>
          {statsCards.map(card => (
            <Grid.Col key={card.label} span={{ base: 12, sm: 6, md: 4 }}>
              <StatCard {...card} />
            </Grid.Col>
          ))}
        </Grid>
      )}

      {!isLoading && stats && (
        <Paper p="xl" mt="xl" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 12 }}>
          <Text fw={600} c="white" mb="xl" ta="center">Engagement Breakdown</Text>
          <Group justify="center" gap="xl">
            <RingProgress
              size={180}
              thickness={20}
              label={
                <Text ta="center" c="white" fw={700}>
                  {formatNumber(stats.totalLikes + stats.totalComments)}
                  <Text size="xs" c="dimmed">total</Text>
                </Text>
              }
              sections={[
                {
                  value: stats.totalLikes + stats.totalComments > 0
                    ? (stats.totalLikes / (stats.totalLikes + stats.totalComments)) * 100
                    : 50,
                  color: '#ef4444',
                  tooltip: `Likes: ${stats.totalLikes}`
                },
                {
                  value: stats.totalLikes + stats.totalComments > 0
                    ? (stats.totalComments / (stats.totalLikes + stats.totalComments)) * 100
                    : 50,
                  color: '#3b82f6',
                  tooltip: `Comments: ${stats.totalComments}`
                },
              ]}
            />
            <Stack gap="sm">
              <Group gap={8}>
                <Box style={{ width: 12, height: 12, borderRadius: 2, background: '#ef4444' }} />
                <Text c="dimmed" size="sm">Likes ({formatNumber(stats.totalLikes)})</Text>
              </Group>
              <Group gap={8}>
                <Box style={{ width: 12, height: 12, borderRadius: 2, background: '#3b82f6' }} />
                <Text c="dimmed" size="sm">Comments ({formatNumber(stats.totalComments)})</Text>
              </Group>
            </Stack>
          </Group>
        </Paper>
      )}
    </Box>
  )
}
