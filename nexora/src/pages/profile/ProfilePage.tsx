import { Box, Group, Text, Avatar, Badge, Button, Tabs, Stack, Skeleton, Paper, Tooltip, Modal, Code, ScrollArea, CopyButton } from '@mantine/core'
import { IconMapPin, IconLink, IconUserCheck, IconUserPlus, IconMessage, IconLock, IconCopy, IconCheck } from '@tabler/icons-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useProfileByUsername, useIsFollowing, useFollowUser, useUnfollowUser } from '../../hooks/useProfile'
import { useUserPosts } from '../../hooks/usePosts'
import { useAuthStore } from '../../store/useAuthStore'
import { formatNumber, getInitials, getPlanColor, getPlanLabel } from '../../utils'
import { messageService } from '../../services/message.service'
import PostCard from '../../components/feed/PostCard'

const MESSAGING_SQL = `-- Run this in Supabase → SQL Editor → New query
-- FULL MESSAGING SETUP — run once, safe to re-run

DROP POLICY IF EXISTS "participants can see their rooms" ON message_rooms;
DROP POLICY IF EXISTS "participants can insert rooms" ON message_rooms;
DROP POLICY IF EXISTS "participants can update rooms" ON message_rooms;
DROP POLICY IF EXISTS "users can see participants in their rooms" ON room_participants;
DROP POLICY IF EXISTS "users can join rooms" ON room_participants;
DROP POLICY IF EXISTS "users can update own participant row" ON room_participants;
DROP POLICY IF EXISTS "participants can see messages" ON messages;
DROP POLICY IF EXISTS "participants can send messages" ON messages;
DROP POLICY IF EXISTS "sender can edit their message" ON messages;
DROP POLICY IF EXISTS "participants can see reactions" ON message_reactions;
DROP POLICY IF EXISTS "users can manage own reactions" ON message_reactions;

CREATE TABLE IF NOT EXISTS message_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES message_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  UNIQUE(room_id, user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES message_rooms(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text',
  attachment_url text, attachment_name text, attachment_type text,
  duration int, reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  is_deleted boolean DEFAULT false, deleted_at timestamptz, pinned_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL, created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- SECURITY DEFINER: creates DM room atomically, bypasses all RLS
CREATE OR REPLACE FUNCTION create_dm_room(user1 uuid, user2 uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  existing_room uuid;
  new_room_id uuid;
BEGIN
  SELECT r.id INTO existing_room FROM message_rooms r
  WHERE (SELECT COUNT(*) FROM room_participants p WHERE p.room_id = r.id AND p.user_id IN (user1, user2)) = 2
  LIMIT 1;
  IF existing_room IS NOT NULL THEN RETURN existing_room; END IF;
  new_room_id := gen_random_uuid();
  INSERT INTO message_rooms (id, updated_at) VALUES (new_room_id, now());
  INSERT INTO room_participants (room_id, user_id, last_read_at)
  VALUES (new_room_id, user1, now()), (new_room_id, user2, '1970-01-01'::timestamptz);
  RETURN new_room_id;
END;
$$;

ALTER TABLE message_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants can see their rooms" ON message_rooms FOR SELECT USING (EXISTS (SELECT 1 FROM room_participants WHERE room_id = id AND user_id = auth.uid()));
CREATE POLICY "participants can insert rooms" ON message_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "participants can update rooms" ON message_rooms FOR UPDATE USING (EXISTS (SELECT 1 FROM room_participants WHERE room_id = id AND user_id = auth.uid()));
CREATE POLICY "users can see participants in their rooms" ON room_participants FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM room_participants rp WHERE rp.room_id = room_id AND rp.user_id = auth.uid()));
CREATE POLICY "users can join rooms" ON room_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "users can update own participant row" ON room_participants FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "participants can see messages" ON messages FOR SELECT USING (EXISTS (SELECT 1 FROM room_participants WHERE room_id = messages.room_id AND user_id = auth.uid()));
CREATE POLICY "participants can send messages" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM room_participants WHERE room_id = messages.room_id AND user_id = auth.uid()));
CREATE POLICY "sender can edit their message" ON messages FOR UPDATE USING (sender_id = auth.uid());
CREATE POLICY "participants can see reactions" ON message_reactions FOR SELECT USING (EXISTS (SELECT 1 FROM messages m JOIN room_participants rp ON rp.room_id = m.room_id WHERE m.id = message_id AND rp.user_id = auth.uid()));
CREATE POLICY "users can manage own reactions" ON message_reactions FOR ALL USING (user_id = auth.uid());`

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
  const [setupOpen, setSetupOpen] = useState(false)
  const queryClient = useQueryClient()

  if (isLoading) return <Box p="xl"><Skeleton height={300} radius="md" /></Box>
  if (!profile) return <Box p="xl"><Text c="dimmed">Profile not found.</Text></Box>

  function handleFollowToggle() {
    if (!profile) return
    if (isFollowing) unfollowUser.mutate({ followingId: profile.id })
    else followUser.mutate({ followingId: profile.id })
  }

  return (
    <Box>
      {/* Messaging Setup Modal */}
      <Modal
        opened={setupOpen}
        onClose={() => setSetupOpen(false)}
        title={<Text fw={700} c="white" size="lg">⚙️ Messaging Setup Required</Text>}
        size="xl" centered
        styles={{
          header: { background: '#0f0f1a', borderBottom: '1px solid #1e1e3a' },
          body: { background: '#0f0f1a' },
          content: { background: '#0f0f1a' },
        }}
      >
        <Stack gap="md">
          <Text c="gray.4" size="sm">
            The messaging tables don't exist in your Supabase database yet. Follow these steps:
          </Text>
          <Stack gap={6}>
            <Text c="white" size="sm" fw={600}>1. Open your Supabase project dashboard</Text>
            <Text c="white" size="sm" fw={600}>2. Click <Text span c="violet" fw={700}>SQL Editor</Text> in the left menu</Text>
            <Text c="white" size="sm" fw={600}>3. Click <Text span c="violet" fw={700}>+ New query</Text></Text>
            <Text c="white" size="sm" fw={600}>4. Copy the SQL below and paste it</Text>
            <Text c="white" size="sm" fw={600}>5. Click the green <Text span c="green" fw={700}>Run</Text> button</Text>
          </Stack>
          <Box style={{ position: 'relative' }}>
            <CopyButton value={MESSAGING_SQL}>
              {({ copied, copy }) => (
                <Button
                  size="xs"
                  leftSection={copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  color={copied ? 'green' : 'violet'}
                  onClick={copy}
                  style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
                >
                  {copied ? 'Copied!' : 'Copy SQL'}
                </Button>
              )}
            </CopyButton>
            <ScrollArea h={300}>
              <Code block style={{ background: '#0a0a14', color: '#a78bfa', fontSize: 11, display: 'block', padding: 12, whiteSpace: 'pre' }}>
                {MESSAGING_SQL}
              </Code>
            </ScrollArea>
          </Box>
          <Button fullWidth color="violet" onClick={() => setSetupOpen(false)}>
            I've run the SQL — close this
          </Button>
        </Stack>
      </Modal>

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
              {profile.is_private && (
                <Tooltip label="Private Account"><Badge color="gray" size="sm" leftSection={<IconLock size={10} />}>Private</Badge></Tooltip>
              )}
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
            <Group gap={8}>
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
              {profile.is_private ? (
                <Tooltip label="This account is private and cannot receive messages">
                  <Button size="sm" variant="outline" color="gray" leftSection={<IconLock size={14} />} disabled>
                    Message
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  color="violet"
                  leftSection={<IconMessage size={14} />}
                  onClick={async () => {
                    if (!authUser) return
                    try {
                      const roomId = await messageService.getOrCreateRoom(authUser.id, profile.id)
                      await queryClient.invalidateQueries({ queryKey: ['rooms'] })
                      navigate(`/messages/${roomId}`)
                    } catch {
                      setSetupOpen(true)
                    }
                  }}
                >
                  Message
                </Button>
              )}
            </Group>
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
              <Text c="cyan" size="sm" component="a" href={profile.website} target="_blank" rel="noreferrer">
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
