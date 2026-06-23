import { Paper, Group, Avatar, Text, Badge, ActionIcon, Stack, SimpleGrid, Menu, Modal, Textarea, Button, Box, TextInput, Loader, Divider } from '@mantine/core'
import { IconHeart, IconHeartFilled, IconMessageCircle, IconShare, IconBookmark, IconBookmarkFilled, IconDots, IconEdit, IconTrash, IconCheck, IconX, IconSend, IconCopy, IconBrandFacebook } from '@tabler/icons-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import type { Post } from '../../types'
import { useLikePost, useUnlikePost, useDeletePost, useEditPost, useCreatePost } from '../../hooks/usePosts'
import { useComments, useAddComment, useDeleteComment } from '../../hooks/useComments'
import { useAuthStore } from '../../store/useAuthStore'
import { timeAgo, getInitials, getPlanColor, getPlanLabel, formatNumber } from '../../utils'

interface Props { post: Post }

// Protected image — blocks right-click save and drag-to-desktop
function ProtectedImage({ src, alt }: { src: string; alt?: string }) {
  return (
    <Box style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
      <img
        src={src}
        alt={alt ?? ''}
        draggable={false}
        style={{
          width: '100%', maxHeight: 320,
          objectFit: 'cover', display: 'block',
          userSelect: 'none',
          WebkitUserDrag: 'none',
          pointerEvents: 'none',
        } as React.CSSProperties}
      />
      {/* Invisible overlay blocks right-click context menu */}
      <Box
        style={{ position: 'absolute', inset: 0, zIndex: 2, cursor: 'default' }}
        onContextMenu={e => e.preventDefault()}
        onDragStart={e => e.preventDefault()}
      />
      {/* Subtle watermark */}
      <Box style={{
        position: 'absolute', bottom: 6, right: 8, zIndex: 3,
        color: 'rgba(255,255,255,0.18)', fontSize: 10,
        fontWeight: 600, letterSpacing: 1, userSelect: 'none',
        pointerEvents: 'none',
        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
      }}>
        NEXORA
      </Box>
    </Box>
  )
}

export default function PostCard({ post }: Props) {
  const navigate = useNavigate()
  const authUser = useAuthStore(s => s.user)
  const [liked, setLiked] = useState(post.liked_by_me ?? false)
  const [likeCount, setLikeCount] = useState(post.likes_count)
  const [commentCount, setCommentCount] = useState(post.comments_count)
  const [bookmarked, setBookmarked] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [showComments, setShowComments] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [sharePosting, setSharePosting] = useState(false)

  const likePost = useLikePost()
  const unlikePost = useUnlikePost()
  const deletePost = useDeletePost()
  const editPost = useEditPost()
  const createPost = useCreatePost()
  const addComment = useAddComment(post.id)
  const deleteComment = useDeleteComment(post.id)
  const { data: comments = [], isLoading: commentsLoading } = useComments(post.id, showComments)

  // Once comments load, persist the real count so it's correct even after hiding
  useEffect(() => {
    if (showComments && !commentsLoading) setCommentCount(comments.length)
  }, [comments.length, commentsLoading, showComments])

  const displayCommentCount = commentCount

  const isOwn = post.author_id === authUser?.id

  function toggleLike() {
    if (liked) { setLiked(false); setLikeCount(c => c - 1); unlikePost.mutate(post.id) }
    else { setLiked(true); setLikeCount(c => c + 1); likePost.mutate(post.id) }
  }

  function toggleBookmark() {
    setBookmarked(b => !b)
    notifications.show({ message: bookmarked ? 'Removed from bookmarks' : 'Saved to bookmarks', color: 'violet' })
  }

  function handleCopyLink() {
    const text = `${post.author?.full_name ?? 'Someone'} on Nexora:\n"${post.content.slice(0, 200)}${post.content.length > 200 ? '...' : ''}"`
    navigator.clipboard.writeText(text)
      .then(() => { notifications.show({ message: 'Copied to clipboard', color: 'teal' }); setShareOpen(false) })
      .catch(() => notifications.show({ message: 'Could not copy', color: 'red' }))
  }

  async function handleShareToFeed() {
    setSharePosting(true)
    try {
      const shareContent = `🔁 Shared from @${post.author?.username ?? 'someone'}:\n\n"${post.content}"`
      await new Promise<void>((resolve, reject) => {
        createPost.mutate(
          { content: shareContent, post_type: 'text', visibility: 'public' },
          { onSuccess: () => resolve(), onError: () => reject() }
        )
      })
      notifications.show({ title: 'Shared!', message: 'Post shared to your feed', color: 'violet' })
      setShareOpen(false)
    } catch {
      notifications.show({ message: 'Could not share post', color: 'red' })
    } finally {
      setSharePosting(false)
    }
  }

  function handleDelete() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    deletePost.mutate(post.id, {
      onSuccess: () => notifications.show({ message: 'Post deleted', color: 'red' }),
      onError: () => notifications.show({ message: 'Failed to delete post', color: 'red' }),
    })
  }

  function handleSaveEdit() {
    if (!editContent.trim()) return
    editPost.mutate({ postId: post.id, content: editContent.trim() }, {
      onSuccess: () => { notifications.show({ message: 'Post updated', color: 'green' }); setEditOpen(false) },
      onError: () => notifications.show({ message: 'Failed to update post', color: 'red' }),
    })
  }

  function handleAddComment() {
    const text = commentInput.trim()
    if (!text) return
    addComment.mutate(text, {
      onSuccess: () => { setCommentInput(''); setCommentCount(c => c + 1) },
      onError: () => notifications.show({ message: 'Could not add comment — database table may not exist yet', color: 'red' }),
    })
  }

  return (
    <>
      <Paper p="md" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12 }}>
        {/* Header */}
        <Group mb="sm" justify="space-between" align="flex-start">
          <Group style={{ cursor: 'pointer' }} onClick={() => post.author?.username && navigate(`/profile/${post.author.username}`)}>
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

          {isOwn && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" c="dimmed" size="sm"><IconDots size={16} /></ActionIcon>
              </Menu.Target>
              <Menu.Dropdown style={{ background: '#141428', border: '1px solid #2d2d4e' }}>
                <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => { setEditContent(post.content); setEditOpen(true) }} style={{ color: '#e2e8f0' }}>Edit Post</Menu.Item>
                <Menu.Divider style={{ borderColor: '#2d2d4e' }} />
                <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={handleDelete} disabled={deletePost.isPending}>Delete Post</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>

        {/* Content */}
        <Text c="white" size="sm" mb={post.media_urls?.length > 0 ? 'sm' : 0} style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {post.content}
        </Text>

        {/* Protected images */}
        {post.media_urls?.length > 0 && (
          <SimpleGrid cols={post.media_urls.length === 1 ? 1 : 2} mb="sm" mt="xs">
            {post.media_urls.map((url, i) => (
              <ProtectedImage key={i} src={url} alt={`Post image ${i + 1}`} />
            ))}
          </SimpleGrid>
        )}

        {/* Action bar */}
        <Group mt="sm" gap="md">
          <Group gap={6}>
            <ActionIcon variant="subtle" c={liked ? 'red' : 'dimmed'} onClick={toggleLike} size="sm">
              {liked ? <IconHeartFilled size={15} /> : <IconHeart size={15} />}
            </ActionIcon>
            <Text c="dimmed" size="xs">{formatNumber(likeCount)}</Text>
          </Group>

          <Group gap={6}>
            <ActionIcon variant="subtle" c={showComments ? 'violet' : 'dimmed'} size="sm" onClick={() => setShowComments(s => !s)}>
              <IconMessageCircle size={15} />
            </ActionIcon>
            <Text c="dimmed" size="xs">{formatNumber(displayCommentCount)}</Text>
          </Group>

          <ActionIcon variant="subtle" c="dimmed" size="sm" onClick={() => setShareOpen(true)}>
            <IconShare size={15} />
          </ActionIcon>

          <ActionIcon variant="subtle" c={bookmarked ? 'violet' : 'dimmed'} size="sm" ml="auto" onClick={toggleBookmark}>
            {bookmarked ? <IconBookmarkFilled size={15} /> : <IconBookmark size={15} />}
          </ActionIcon>
        </Group>

        {/* Comments */}
        {showComments && (
          <Box mt="sm" style={{ borderTop: '1px solid #1e1e3a', paddingTop: 12 }}>
            {authUser && (
              <Group gap={8} mb="sm" align="flex-end">
                <Avatar src={authUser?.user_metadata?.avatar_url} radius="xl" size={32}>
                  {authUser?.email?.[0]?.toUpperCase()}
                </Avatar>
                <TextInput
                  style={{ flex: 1 }}
                  placeholder="Write a comment..."
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() } }}
                  size="sm"
                  styles={{ input: { background: '#1a1a2e', border: '1px solid #2d2d4e', color: 'white', borderRadius: 20 } }}
                />
                <ActionIcon size={32} radius="xl" disabled={!commentInput.trim()} loading={addComment.isPending} onClick={handleAddComment}
                  style={{ background: commentInput.trim() ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : '#1a1a2e', flexShrink: 0 }}>
                  <IconSend size={14} color="white" />
                </ActionIcon>
              </Group>
            )}
            {commentsLoading ? (
              <Box ta="center" py="sm"><Loader size="xs" color="violet" /></Box>
            ) : comments.length === 0 ? (
              <Text c="dimmed" size="xs" ta="center" py="sm">No comments yet. Be the first!</Text>
            ) : (
              <Stack gap={10}>
                <Divider color="#1e1e3a" />
                {comments.map(comment => (
                  <Group key={comment.id} align="flex-start" gap={8}>
                    <Avatar src={comment.author?.avatar_url} radius="xl" size={28} style={{ cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => comment.author?.username && navigate(`/profile/${comment.author.username}`)}>
                      {comment.author?.full_name ? getInitials(comment.author.full_name) : '?'}
                    </Avatar>
                    <Box style={{ flex: 1, background: '#141428', borderRadius: 12, padding: '6px 12px', border: '1px solid #1e1e3a' }}>
                      <Group gap={6} mb={2}>
                        <Text size="xs" fw={600} c="white">{comment.author?.full_name ?? 'Unknown'}</Text>
                        <Text size="xs" c="dimmed">{timeAgo(comment.created_at)}</Text>
                        {comment.user_id === authUser?.id && (
                          <ActionIcon size="xs" variant="subtle" c="dimmed" ml="auto" onClick={() => deleteComment.mutate(comment.id, { onSuccess: () => setCommentCount(c => Math.max(0, c - 1)) })}>
                            <IconTrash size={11} />
                          </ActionIcon>
                        )}
                      </Group>
                      <Text size="xs" c="gray.3" style={{ lineHeight: 1.5 }}>{comment.content}</Text>
                    </Box>
                  </Group>
                ))}
              </Stack>
            )}
          </Box>
        )}
      </Paper>

      {/* ── FB-STYLE SHARE MODAL ── */}
      <Modal
        opened={shareOpen}
        onClose={() => setShareOpen(false)}
        title={<Group gap={8}><IconBrandFacebook size={18} color="#7c3aed" /><Text fw={600} c="white">Share Post</Text></Group>}
        centered size="md"
        styles={{
          header: { background: '#0f0f1a', borderBottom: '1px solid #1e1e3a' },
          body: { background: '#0f0f1a', padding: 0 },
          content: { background: '#0f0f1a' },
        }}
      >
        {/* Post preview card */}
        <Box style={{ padding: '16px 20px 0' }}>
          <Paper p="md" style={{ background: '#141428', border: '1px solid #2d2d4e', borderRadius: 12 }}>
            <Group mb="sm">
              <Avatar src={post.author?.avatar_url} radius="xl" size={40}>
                {post.author?.full_name ? getInitials(post.author.full_name) : '?'}
              </Avatar>
              <Stack gap={0}>
                <Text fw={600} c="white" size="sm">{post.author?.full_name ?? 'Unknown'}</Text>
                <Text c="dimmed" size="xs">@{post.author?.username} · {timeAgo(post.created_at)}</Text>
              </Stack>
            </Group>
            <Text c="gray.3" size="sm" lineClamp={4} style={{ lineHeight: 1.6 }}>{post.content}</Text>
            {post.media_urls?.length > 0 && (
              <Box mt="sm" style={{ borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                <img
                  src={post.media_urls[0]}
                  draggable={false}
                  onContextMenu={e => e.preventDefault()}
                  style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                />
                <Box style={{ position: 'absolute', inset: 0 }} onContextMenu={e => e.preventDefault()} />
              </Box>
            )}
          </Paper>
        </Box>

        {/* Share actions */}
        <Stack gap={0} p="md">
          <Button
            fullWidth size="md"
            loading={sharePosting}
            onClick={handleShareToFeed}
            leftSection={<IconShare size={16} />}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', marginBottom: 10 }}
          >
            Share to your Feed
          </Button>
          <Button
            fullWidth size="md" variant="outline" color="violet"
            onClick={handleCopyLink}
            leftSection={<IconCopy size={16} />}
            style={{ marginBottom: 10 }}
          >
            Copy to Clipboard
          </Button>
          <Button fullWidth size="sm" variant="subtle" c="dimmed" leftSection={<IconX size={14} />} onClick={() => setShareOpen(false)}>
            Cancel
          </Button>
        </Stack>
      </Modal>

      {/* Edit modal */}
      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Edit Post" centered
        styles={{ header: { background: '#0f0f1a', borderBottom: '1px solid #1e1e3a' }, body: { background: '#0f0f1a' }, content: { background: '#0f0f1a' } }}>
        <Stack>
          <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} minRows={4} autosize
            styles={{ input: { background: '#1a1a2e', border: '1px solid #2d2d4e', color: '#e2e8f0' } }} />
          <Group justify="flex-end" gap={8}>
            <Button variant="subtle" c="dimmed" leftSection={<IconX size={14} />} onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button leftSection={<IconCheck size={14} />} loading={editPost.isPending} disabled={!editContent.trim()} onClick={handleSaveEdit}
              style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
