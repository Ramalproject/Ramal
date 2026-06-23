import { Modal, Textarea, Button, Stack } from '@mantine/core'
import { useState } from 'react'
import { notifications } from '@mantine/notifications'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { useQueryClient } from '@tanstack/react-query'

interface Props { opened: boolean; onClose: () => void }

export default function CreatePostModal({ opened, onClose }: Props) {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!content.trim() || !user) return
    setLoading(true)
    const { error } = await supabase.from('posts').insert({
      content: content.trim(),
      author_id: user.id,
      post_type: 'text',
      visibility: 'public',
      likes_count: 0,
      comments_count: 0,
      shares_count: 0,
    })
    setLoading(false)
    if (error) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' })
    } else {
      notifications.show({ title: 'Posted!', message: 'Your post is live', color: 'violet' })
      qc.invalidateQueries({ queryKey: ['posts'] })
      setContent('')
      onClose()
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create Post"
      centered
      styles={{
        header: { background: '#0f0f1a', borderBottom: '1px solid #1e1e3a' },
        body: { background: '#0f0f1a' },
        content: { background: '#0f0f1a' },
      }}
    >
      <Stack>
        <Textarea
          placeholder="What's on your mind?"
          minRows={4}
          value={content}
          onChange={e => setContent(e.target.value)}
          styles={{
            input: { background: '#1a1a2e', border: '1px solid #2d2d4e', color: '#e2e8f0' },
          }}
        />
        <Button
          onClick={handleSubmit}
          loading={loading}
          style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}
        >
          Publish
        </Button>
      </Stack>
    </Modal>
  )
}
