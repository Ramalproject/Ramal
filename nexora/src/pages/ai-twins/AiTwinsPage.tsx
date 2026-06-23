import { Box, Title, Grid, Paper, Avatar, Text, Badge, Button, Group, Stack, Tabs } from '@mantine/core'
import { IconRobot, IconPlus, IconStar } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { formatNumber } from '../../utils'
import type { AiTwin } from '../../types'

function usePublicTwins() {
  return useQuery({
    queryKey: ['ai-twins', 'public'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_twins')
        .select('*, owner:profiles!owner_id(*)')
        .eq('is_public', true)
        .order('chats_count', { ascending: false })
        .limit(20)
      return (data as AiTwin[]) ?? []
    },
    staleTime: 1000 * 60 * 5,
  })
}

function useMyTwins(userId: string) {
  return useQuery({
    queryKey: ['ai-twins', 'my', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_twins')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
      return (data as AiTwin[]) ?? []
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  })
}

function TwinCard({ twin }: { twin: AiTwin }) {
  const navigate = useNavigate()
  return (
    <Paper
      p="lg"
      onClick={() => navigate(`/ai-twins/${twin.id}`)}
      style={{
        background: 'var(--nex-surface)',
        border: '1px solid var(--nex-border)',
        borderRadius: 16,
        cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.1s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#7c3aed' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--nex-border)' }}
    >
      <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }} />

      <Stack align="center" gap="sm" mt="sm">
        <Avatar src={twin.avatar_url} radius="xl" size={72} style={{ border: '3px solid #7c3aed33' }}>
          <IconRobot size={36} color="#7c3aed" />
        </Avatar>
        <Stack gap={0} align="center">
          <Group gap={6}>
            <Text fw={700}>{twin.name}</Text>
            <Badge size="xs" color="violet" variant="light">AI</Badge>
          </Group>
          {twin.owner && <Text c="dimmed" size="xs">by @{twin.owner.username}</Text>}
        </Stack>
        {twin.bio && <Text c="dimmed" size="xs" ta="center" lineClamp={2}>{twin.bio}</Text>}
        <Group gap={4} wrap="wrap" justify="center">
          {twin.expertise.slice(0, 3).map(e => <Badge key={e} size="xs" variant="outline" color="cyan">{e}</Badge>)}
        </Group>
        <Group gap="xl">
          <Stack gap={0} align="center">
            <Text fw={700} size="sm">{formatNumber(twin.chats_count)}</Text>
            <Text c="dimmed" size="xs">Chats</Text>
          </Stack>
          {twin.rating > 0 && (
            <Stack gap={0} align="center">
              <Group gap={2}>
                <IconStar size={12} color="#f59e0b" />
                <Text fw={700} size="sm">{twin.rating.toFixed(1)}</Text>
              </Group>
              <Text c="dimmed" size="xs">Rating</Text>
            </Stack>
          )}
        </Group>
        <Button size="sm" fullWidth style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
          Chat Now
        </Button>
      </Stack>
    </Paper>
  )
}

export default function AiTwinsPage() {
  const authUser = useAuthStore(s => s.user)
  const { data: publicTwins = [] } = usePublicTwins()
  const { data: myTwins = [] } = useMyTwins(authUser?.id ?? '')

  return (
    <Box p="xl" maw={1100} mx="auto">
      <Group justify="space-between" mb="xl">
        <Title order={2}>
          <Group gap={8}><IconRobot color="#7c3aed" size={28} /> AI Twins</Group>
        </Title>
        <Button leftSection={<IconPlus size={14} />} style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
          Create My Twin
        </Button>
      </Group>

      <Tabs defaultValue="discover">
        <Tabs.List mb="xl">
          <Tabs.Tab value="discover">Discover</Tabs.Tab>
          <Tabs.Tab value="my-twins">My Twins ({myTwins.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="discover">
          {publicTwins.length === 0 ? (
            <Box ta="center" py="xl">
              <IconRobot size={64} color="var(--nex-subtle)" />
              <Text c="dimmed" mt="md">No AI Twins yet. Create the first one!</Text>
            </Box>
          ) : (
            <Grid>
              {publicTwins.map(twin => (
                <Grid.Col key={twin.id} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                  <TwinCard twin={twin} />
                </Grid.Col>
              ))}
            </Grid>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="my-twins">
          {myTwins.length === 0 ? (
            <Box ta="center" py="xl">
              <IconRobot size={64} color="var(--nex-subtle)" />
              <Text c="dimmed" mt="md">You haven&apos;t created any AI Twins yet.</Text>
              <Button mt="md" leftSection={<IconPlus size={14} />} style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
                Create My First Twin
              </Button>
            </Box>
          ) : (
            <Grid>
              {myTwins.map(twin => (
                <Grid.Col key={twin.id} span={{ base: 12, sm: 6, md: 4 }}>
                  <TwinCard twin={twin} />
                </Grid.Col>
              ))}
            </Grid>
          )}
        </Tabs.Panel>
      </Tabs>
    </Box>
  )
}
