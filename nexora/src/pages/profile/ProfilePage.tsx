import { Box, Group, Text, Avatar, Badge, Button, Tabs, Stack, Skeleton, Paper } from '@mantine/core'
import { IconMapPin, IconLink, IconUserCheck, IconUserPlus } from '@tabler/icons-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useProfileByUsername, useIsFollowing, useFollowUser, useUnfollowUser } from '../../hooks/useProfile'
import { useUserPosts } from '../../hooks/usePosts'
import { useAuthStore } from '../../store/useAuthStore'
import { formatNumber, getInitials, getPlanColor, getPlanLabel } from '../../utils'
import PostCard from '../../components/feed/PostCard'

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const authUser = useAuthStore(s => s.user)
  const { data: profile, isLoading } = useProfileByUsername(username ?? '')
  const isOwnProfile = profile?.id === authUser?.id
  const { data: isFollowing = false } = useIsFollowing(profile?.id ?? '')
  const { data: posts = [] } = useUserPosts(profile?.id ?? '')
  const followUser = useFollowUser()
  const unfollowUser = useUnfollowUser()
  const [activeTab, setActiveTab] = useState<string | null>('posts')

  if (isLoading) return <Box p="xl"><Skeleton height={300} radius="md" /></Box>
  if (!profile) return <Box p="xl"><Text c="dimmed">Profile not found.</Text></Box>

  function handleFollowToggle() {
    if (!profile) return
    if (isFollowing) {
      unfollowUser.mutate({ followingId: profile.id })
    } else {
      followUser.mutate({ followingId: profile.id })
    }
  }

  return (
    <Box>
      <Box style={{
        height: 200,
        background: profile.cover_url
          ? `url(${profile.cover_url}) center/cover`
          : 'linear-gradient(135deg, #1a0a2e, #0a1628)',
        position: 'relative'
      }}>
        <Avatar
          src={profile.avatar_url}
          radius="xl"
          size={96}
          style={{ position: 'absolute', bottom: -48, left: 24, border: '4px solid #0a0a14' }}
        >
          {getInitials(profile.full_name)}
        </Avatar>
      </Box>

      <Box px={24} pt={60} pb="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap={8}>
              <Text size="xl" fw={700} c="white">{profile.full_name}</Text>
              {profile.is_verified && <Text c="cyan" fw={700}>✓</Text>}
              {profile.plan !== 'free' && (
                <Badge color={getPlanColor(profile.plan)} size="sm">{getPlanLabel(profile.plan)}</Badge>
              )}
            </Group>
            <Text c="dimmed">@{profile.username}</Text>
          </Stack>

          {isOwnProfile ? (
            <Button variant="outline" color="violet" size="sm" onClick={() => navigate('/settings')}>
              Edit Profile
            </Button>
          ) : (
            <Button
              size="sm"
              color="violet"
              variant={isFollowing ? 'outline' : 'filled'}
              leftSection={isFollowing ? <IconUserCheck size={14} /> : <IconUserPlus size={14} />}
              onClick={handleFollowToggle}
              loading={followUser.isPending || unfollowUser.isPending}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          )}
        </Group>

        {profile.bio && <Text c="gray.4" mt="sm" size="sm">{profile.bio}</Text>}

        <Group gap="lg" mt="xs">
          {profile.location && (
            <Group gap={4}>
              <IconMapPin size={14} color="#8892b0" />
              <Text c="dimmed" size="sm">{profile.location}</Text>
            </Group>
          )}
          {profile.website && (
            <Group gap={4}>
              <IconLink size={14} color="#06b6d4" />
              <Text
                c="cyan" size="sm" component="a"
                href={profile.website} target="_blank" rel="noreferrer"
              >
                {profile.website.replace(/^https?:\/\//, '')}
              </Text>
            </Group>
          )}
        </Group>

        <Group gap="xl" mt="md">
          {[
            { label: 'Posts', value: profile.posts_count },
            { label: 'Followers', value: profile.followers_count },
            { label: 'Following', value: profile.following_count },
          ].map(({ label, value }) => (
            <Stack key={label} gap={0} align="center">
              <Text fw={700} c="white">{formatNumber(value)}</Text>
              <Text c="dimmed" size="xs">{label}</Text>
            </Stack>
          ))}
        </Group>
      </Box>

      <Box px={24}>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="posts">Posts</Tabs.Tab>
            <Tabs.Tab value="about">About</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="posts" pt="md">
            {posts.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">No posts yet.</Text>
            ) : (
              <Stack gap="md" pb="xl">
                {posts.map(post => <PostCard key={post.id} post={post} />)}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="about" pt="md">
            <Paper p="md" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12 }}>
              <Stack gap="sm">
                {profile.skills?.length > 0 && (
                  <Group gap={6}>
                    {profile.skills.map(s => <Badge key={s} variant="outline" color="violet">{s}</Badge>)}
                  </Group>
                )}
                <Text c="dimmed" size="sm">
                  Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              </Stack>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Box>
    </Box>
  )
}
