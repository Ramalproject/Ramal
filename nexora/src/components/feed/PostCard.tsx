import { Paper, Group, Avatar, Text, Badge, ActionIcon, Stack, Image, SimpleGrid } from '@mantine/core'
import { IconHeart, IconHeartFilled, IconMessageCircle, IconShare, IconBookmark } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Post } from '../../types'
import { useLikePost, useUnlikePost } from '../../hooks/usePosts'
import { useAuthStore } from '../../store/useAuthStore'
import { timeAgo, getInitials, getPlanColor, getPlanLabel, formatNumber } from '../../utils'

interface Props { post: Post }

export default function PostCard({ post }: Props) {
  const navigate = useNavigate()
  const authUser = useAuthStore(s => s.user)
  const [liked, setLiked] = useState(post.liked_by_me ?? false)
  const [likeCount, setLikeCount] = useState(post.likes_count)
  const likePost = useLikePost()
  const unlikePost = useUnlikePost()

  function toggleLike() {
    if (liked) {
      setLiked(false)
      setLikeCount(c => c - 1)
      unlikePost.mutate(post.id)
    } else {
      setLiked(true)
      setLikeCount(c => c + 1)
      likePost.mutate(post.id)
    }
  }

  const isOwn = post.author_id === authUser?.id

  return (
    <Paper p="md" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12 }}>
      <Group mb="sm" justify="space-between">
        <Group
          style={{ cursor: 'pointer' }}
          onClick={() => post.author?.username && navigate(`/profile/${post.author.username}`)}
        >
          <Avatar src={post.author?.avatar_url} radius="xl" size="md">
            {post.author?.full_name ? getInitials(post.author.full_name) : '?'}
          </Avatar>
          <Stack gap={0}>
            <Group gap={6}>
              <Text fw={600} c="white" size="sm">{post.author?.full_name ?? 'Unknown'}</Text>
              {post.author?.is_verified && <Text c="cyan" size="xs" fw={700}>✓</Text>}
              {post.author?.plan && post.author.plan !== 'free' && (
                <Badge size="xs" color={getPlanColor(post.author.plan)}>{getPlanLabel(post.author.plan)}</Badge>
              )}
            </Group>
            <Text c="dimmed" size="xs">@{post.author?.username} · {timeAgo(post.created_at)}</Text>
          </Stack>
        </Group>
        {isOwn && <Badge size="xs" variant="outline" color="violet">You</Badge>}
      </Group>

      <Text c="white" size="sm" mb={post.media_urls?.length > 0 ? 'sm' : 0} style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {post.content}
      </Text>

      {post.media_urls?.length > 0 && (
        <SimpleGrid cols={post.media_urls.length === 1 ? 1 : 2} mb="sm" mt="xs">
          {post.media_urls.map((url, i) => (
            <Image key={i} src={url} radius="md" style={{ maxHeight: 320, objectFit: 'cover' }} />
          ))}
        </SimpleGrid>
      )}

      <Group mt="sm" gap="md">
        <Group gap={6}>
          <ActionIcon variant="subtle" c={liked ? 'red' : 'dimmed'} onClick={toggleLike} size="sm">
            {liked ? <IconHeartFilled size={15} /> : <IconHeart size={15} />}
          </ActionIcon>
          <Text c="dimmed" size="xs">{formatNumber(likeCount)}</Text>
        </Group>
        <Group gap={6}>
          <ActionIcon variant="subtle" c="dimmed" size="sm"><IconMessageCircle size={15} /></ActionIcon>
          <Text c="dimmed" size="xs">{formatNumber(post.comments_count)}</Text>
        </Group>
        <ActionIcon variant="subtle" c="dimmed" size="sm"><IconShare size={15} /></ActionIcon>
        <ActionIcon variant="subtle" c="dimmed" size="sm" ml="auto"><IconBookmark size={15} /></ActionIcon>
      </Group>
    </Paper>
  )
}
