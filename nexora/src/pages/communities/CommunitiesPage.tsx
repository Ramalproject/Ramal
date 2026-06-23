import { Box, Title, Grid, Paper, Avatar, Text, Badge, Button, Group, Stack, TextInput } from '@mantine/core'
import { IconUsers, IconSearch, IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatNumber } from '../../utils'
import type { Community } from '../../types'

function useCommunities() {
  return useQuery({
    queryKey: ['communities'],
    queryFn: async () => {
      const { data } = await supabase
        .from('communities')
        .select('*')
        .order('members_count', { ascending: false })
        .limit(20)
      return (data as Community[]) ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}

export default function CommunitiesPage() {
  const { data: communities = [], isLoading } = useCommunities()

  return (
    <Box p="xl" maw={1000} mx="auto">
      <Group justify="space-between" mb="xl">
        <Title order={2} c="white">
          <Group gap={8}><IconUsers color="#7c3aed" size={28} /> Communities</Group>
        </Title>
        <Button leftSection={<IconPlus size={14} />} style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
          Create Community
        </Button>
      </Group>

      <TextInput
        placeholder="Search communities..."
        leftSection={<IconSearch size={14} />}
        mb="xl"
        styles={{ input: { background: '#1a1a2e', border: '1px solid #2d2d4e', color: 'white' } }}
      />

      {isLoading ? (
        <Text c="dimmed" ta="center">Loading communities...</Text>
      ) : communities.length === 0 ? (
        <Paper p="xl" ta="center" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12 }}>
          <IconUsers size={48} color="#2d2d4e" />
          <Text c="dimmed" mt="md">No communities yet.</Text>
          <Text c="dimmed" size="sm">Be the first to create one!</Text>
          <Button mt="md" leftSection={<IconPlus size={14} />} style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
            Create a Community
          </Button>
        </Paper>
      ) : (
        <Grid>
          {communities.map(c => (
            <Grid.Col key={c.id} span={{ base: 12, sm: 6, md: 4 }}>
              <Paper p="md" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12, height: '100%' }}>
                <Stack>
                  <Group>
                    <Avatar src={c.avatar_url} radius="md" size={48} style={{ background: '#7c3aed22' }}>
                      {c.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Stack gap={0} style={{ flex: 1 }}>
                      <Text c="white" fw={700}>{c.name}</Text>
                      {c.category && <Badge size="xs" variant="outline" color="violet">{c.category}</Badge>}
                    </Stack>
                  </Group>
                  {c.description && <Text c="dimmed" size="sm" lineClamp={2}>{c.description}</Text>}
                  <Group justify="space-between">
                    <Text c="dimmed" size="xs">{formatNumber(c.members_count)} members</Text>
                    <Button size="xs" variant="light" color="violet">Join</Button>
                  </Group>
                </Stack>
              </Paper>
            </Grid.Col>
          ))}
        </Grid>
      )}
    </Box>
  )
}
