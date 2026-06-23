import { Box, Title, TextInput, Stack, Paper, Avatar, Group, Text, Tabs, Skeleton } from '@mantine/core'
import { IconSearch, IconCompass } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSearchProfiles, useTopCreators } from '../../hooks/useProfile'
import { useSearchPosts } from '../../hooks/usePosts'
import { getInitials, formatNumber, timeAgo, truncate } from '../../utils'

export default function ExplorePage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data: profileResults = [], isLoading: profilesLoading } = useSearchProfiles(search)
  const { data: postResults = [], isLoading: postsLoading } = useSearchPosts(search)
  const { data: topCreators = [] } = useTopCreators()
  const isSearching = search.length >= 2

  return (
    <Box p="xl" maw={800} mx="auto">
      <Title order={2} c="white" mb="xl">
        <Group gap={8}><IconCompass color="#7c3aed" size={28} /> Explore</Group>
      </Title>

      <TextInput
        size="lg"
        placeholder="Search people, posts, hashtags..."
        leftSection={<IconSearch size={20} />}
        value={search}
        onChange={e => setSearch(e.target.value)}
        mb="xl"
        styles={{ input: { background: 'var(--nex-input)', border: '1px solid var(--nex-subtle)', color: 'white', fontSize: 16 } }}
      />

      {!isSearching ? (
        <Box>
          <Text fw={600} c="white" mb="md">⭐ Suggested People</Text>
          <Stack gap="sm">
            {topCreators.map(creator => (
              <Paper
                key={creator.id} p="md"
                style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 12, cursor: 'pointer' }}
                onClick={() => navigate(`/profile/${creator.username}`)}
              >
                <Group>
                  <Avatar src={creator.avatar_url} radius="xl" size="md">{getInitials(creator.full_name)}</Avatar>
                  <Stack gap={0} style={{ flex: 1 }}>
                    <Text c="white" fw={600}>{creator.full_name}</Text>
                    <Text c="dimmed" size="sm">@{creator.username}</Text>
                  </Stack>
                  <Text c="violet" size="sm" fw={600}>{formatNumber(creator.followers_count)} followers</Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Box>
      ) : (
        <Tabs defaultValue="people">
          <Tabs.List mb="md">
            <Tabs.Tab value="people">People ({profileResults.length})</Tabs.Tab>
            <Tabs.Tab value="posts">Posts ({postResults.length})</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="people">
            {profilesLoading ? <Skeleton height={80} radius="md" /> :
              profileResults.length === 0
                ? <Text c="dimmed" ta="center" py="xl">No people found.</Text>
                : <Stack gap="sm">
                  {profileResults.map(p => (
                    <Paper
                      key={p.id} p="md"
                      style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 12, cursor: 'pointer' }}
                      onClick={() => navigate(`/profile/${p.username}`)}
                    >
                      <Group>
                        <Avatar src={p.avatar_url} radius="xl" size="md">{getInitials(p.full_name)}</Avatar>
                        <Stack gap={0}>
                          <Text c="white" fw={600}>{p.full_name}</Text>
                          <Text c="dimmed" size="sm">@{p.username}</Text>
                        </Stack>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
            }
          </Tabs.Panel>

          <Tabs.Panel value="posts">
            {postsLoading ? <Skeleton height={80} radius="md" /> :
              postResults.length === 0
                ? <Text c="dimmed" ta="center" py="xl">No posts found.</Text>
                : <Stack gap="sm">
                  {postResults.map(p => (
                    <Paper key={p.id} p="md" style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-border)', borderRadius: 12 }}>
                      <Group mb={4}>
                        <Avatar src={p.author?.avatar_url} radius="xl" size="sm">
                          {p.author?.full_name ? getInitials(p.author.full_name) : '?'}
                        </Avatar>
                        <Text c="dimmed" size="xs">@{p.author?.username} · {timeAgo(p.created_at)}</Text>
                      </Group>
                      <Text c="white" size="sm">{truncate(p.content, 200)}</Text>
                    </Paper>
                  ))}
                </Stack>
            }
          </Tabs.Panel>
        </Tabs>
      )}
    </Box>
  )
}
