import { Box, Grid, Text, Group, Avatar, Badge, Stack, Paper, Skeleton, Title } from '@mantine/core'
import { IconTrendingUp, IconHeart } from '@tabler/icons-react'
import { useTrendingPosts } from '../../hooks/usePosts'
import { useTopCreators } from '../../hooks/useProfile'
import { formatNumber, getInitials, timeAgo, truncate } from '../../utils'
import type { Post } from '../../types'

function extractHashtags(posts: Post[]): { tag: string; count: number }[] {
  const counts: Record<string, number> = {}
  posts.forEach(p => {
    const tags = p.content.match(/#\w+/g) ?? []
    tags.forEach(t => { counts[t] = (counts[t] ?? 0) + 1 })
  })
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function TrendingPage() {
  const { data: posts = [], isLoading: postsLoading } = useTrendingPosts()
  const { data: creators = [], isLoading: creatorsLoading } = useTopCreators()
  const hashtags = extractHashtags(posts)

  return (
    <Box p="xl" maw={1100} mx="auto">
      <Title order={2} c="white" mb="xl">
        <Group gap={8}><IconTrendingUp color="#7c3aed" size={28} /> Trending</Group>
      </Title>

      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Text fw={600} c="white" mb="md">🔥 Hot Posts</Text>
          <Stack gap="sm">
            {postsLoading
              ? [1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={80} radius="md" />)
              : posts.length === 0
                ? <Text c="dimmed" ta="center" py="xl">No trending posts yet.</Text>
                : posts.map((post, i) => (
                  <Paper key={post.id} p="md" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12 }}>
                    <Group>
                      <Text fw={700} c="dimmed" size="lg" w={30}>{i + 1}</Text>
                      <Avatar src={post.author?.avatar_url} radius="xl" size="sm">
                        {post.author?.full_name ? getInitials(post.author.full_name) : '?'}
                      </Avatar>
                      <Stack gap={0} style={{ flex: 1 }}>
                        <Text c="white" size="sm">{truncate(post.content, 80)}</Text>
                        <Group gap={8} mt={2}>
                          <Text c="dimmed" size="xs">@{post.author?.username}</Text>
                          <Text c="dimmed" size="xs">·</Text>
                          <Text c="dimmed" size="xs">{timeAgo(post.created_at)}</Text>
                        </Group>
                      </Stack>
                      <Group gap={4}>
                        <IconHeart size={14} color="#ef4444" />
                        <Text c="red" size="sm" fw={600}>{formatNumber(post.likes_count)}</Text>
                      </Group>
                    </Group>
                  </Paper>
                ))
            }
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper p="md" mb="md" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12 }}>
            <Text fw={600} c="white" mb="sm"># Trending Hashtags</Text>
            {hashtags.length === 0
              ? <Text c="dimmed" size="sm">No hashtags found in posts yet.</Text>
              : <Stack gap={6}>
                {hashtags.map(({ tag, count }) => (
                  <Group key={tag} justify="space-between">
                    <Text c="violet" size="sm" fw={600}>{tag}</Text>
                    <Badge variant="light" color="violet" size="sm">{count} posts</Badge>
                  </Group>
                ))}
              </Stack>
            }
          </Paper>

          <Paper p="md" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12 }}>
            <Text fw={600} c="white" mb="sm">⭐ Top Creators</Text>
            {creatorsLoading
              ? [1, 2, 3].map(i => <Skeleton key={i} height={50} radius="md" mb={4} />)
              : creators.map((creator, i) => (
                <Group key={creator.id} mb="xs" justify="space-between">
                  <Group gap="sm">
                    <Text w={24}>{i < 3 ? MEDALS[i] : `${i + 1}.`}</Text>
                    <Avatar src={creator.avatar_url} radius="xl" size="sm">{getInitials(creator.full_name)}</Avatar>
                    <Stack gap={0}>
                      <Text c="white" size="sm" fw={600}>{creator.full_name}</Text>
                      <Text c="dimmed" size="xs">@{creator.username}</Text>
                    </Stack>
                  </Group>
                  <Text c="violet" size="xs" fw={600}>{formatNumber(creator.followers_count)} followers</Text>
                </Group>
              ))
            }
          </Paper>
        </Grid.Col>
      </Grid>
    </Box>
  )
}
