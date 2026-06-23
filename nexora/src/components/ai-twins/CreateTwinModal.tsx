import {
  Modal, TextInput, Textarea, MultiSelect, Select, Switch,
  Button, Stack, Group, Avatar, Text, FileButton, ActionIcon
} from '@mantine/core'
import { IconRobot, IconCamera, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'

const EXPERTISE_OPTIONS = [
  'Coding', 'Python', 'JavaScript', 'AI/ML', 'Web Dev', 'Mobile Dev',
  'Career', 'Life Coaching', 'Mindset', 'Goals', 'Motivation',
  'Writing', 'Storytelling', 'Poetry', 'Creativity',
  'Fitness', 'Nutrition', 'Wellness', 'Yoga', 'Meditation', 'Mindfulness',
  'Business', 'Strategy', 'Marketing', 'Finance', 'Entrepreneurship',
  'Travel', 'Culture', 'Languages', 'Music', 'Art', 'Design',
  'Science', 'History', 'Philosophy', 'Psychology', 'Education',
  'Cooking', 'Fashion', 'Gaming', 'Sports', 'Relationships',
]

const STYLE_OPTIONS = [
  { value: 'conversational', label: 'Conversational' },
  { value: 'educational', label: 'Educational' },
  { value: 'motivational', label: 'Motivational' },
  { value: 'creative', label: 'Creative & Expressive' },
  { value: 'analytical', label: 'Analytical & Direct' },
  { value: 'nurturing', label: 'Nurturing & Supportive' },
  { value: 'humorous', label: 'Humorous & Playful' },
  { value: 'professional', label: 'Professional & Formal' },
]

interface Props {
  opened: boolean
  onClose: () => void
}

export default function CreateTwinModal({ opened, onClose }: Props) {
  const authUser = useAuthStore(s => s.user)
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [personality, setPersonality] = useState('')
  const [expertise, setExpertise] = useState<string[]>([])
  const [commStyle, setCommStyle] = useState<string | null>('conversational')
  const [isPublic, setIsPublic] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAvatarUpload(file: File | null) {
    if (!file || !authUser) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `twin-new-${authUser.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
      // preview
      const reader = new FileReader()
      reader.onload = e => setAvatarPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } catch {
      notifications.show({ title: 'Upload failed', message: 'Could not upload avatar', color: 'red' })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleCreate() {
    if (!authUser) return
    if (!name.trim()) {
      notifications.show({ title: 'Name required', message: 'Give your AI Twin a name', color: 'orange' })
      return
    }
    if (expertise.length === 0) {
      notifications.show({ title: 'Add expertise', message: 'Select at least one area of expertise', color: 'orange' })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('ai_twins').insert({
        owner_id: authUser.id,
        name: name.trim(),
        bio: bio.trim() || null,
        personality: personality.trim() || 'helpful and friendly',
        expertise,
        communication_style: commStyle ?? 'conversational',
        is_public: isPublic,
        is_for_sale: false,
        price: null,
        chats_count: 0,
        rating: 0,
        avatar_url: avatarUrl,
      })
      if (error) throw error

      notifications.show({ title: 'AI Twin created!', message: `${name} is ready to chat`, color: 'green' })
      qc.invalidateQueries({ queryKey: ['ai-twins'] })

      // reset
      setName('')
      setBio('')
      setPersonality('')
      setExpertise([])
      setCommStyle('conversational')
      setIsPublic(true)
      setAvatarUrl(null)
      setAvatarPreview(null)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not create AI Twin'
      notifications.show({ title: 'Error', message: msg, color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={8}>
          <IconRobot size={20} color="#7c3aed" />
          <Text fw={700}>Create Your AI Twin</Text>
        </Group>
      }
      size="lg"
      styles={{
        content: { background: 'var(--nex-surface)' },
        header: { background: 'var(--nex-surface)' },
      }}
    >
      <Stack gap="md">
        {/* Avatar */}
        <Group justify="center">
          <Stack align="center" gap="xs">
            <FileButton onChange={handleAvatarUpload} accept="image/*">
              {(props) => (
                <ActionIcon
                  {...props}
                  size={90} radius="xl" variant="outline"
                  loading={uploadingAvatar}
                  style={{
                    border: '3px dashed #7c3aed66',
                    background: avatarPreview ? 'transparent' : 'var(--nex-input)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {avatarPreview ? (
                    <Avatar src={avatarPreview} size={90} radius="xl" />
                  ) : (
                    <Stack align="center" gap={2}>
                      <IconCamera size={22} color="#7c3aed" />
                      <Text size="xs" c="dimmed">Add Photo</Text>
                    </Stack>
                  )}
                </ActionIcon>
              )}
            </FileButton>
            {avatarPreview && (
              <Text
                size="xs" c="dimmed" style={{ cursor: 'pointer' }}
                onClick={() => { setAvatarPreview(null); setAvatarUrl(null) }}
              >
                Remove photo
              </Text>
            )}
          </Stack>
        </Group>

        <TextInput
          label="Twin Name"
          placeholder="e.g. Alex, Luna, Coach Mike..."
          required
          value={name}
          onChange={e => setName(e.target.value)}
          styles={{ input: { background: 'var(--nex-input)' } }}
        />

        <Textarea
          label="Bio"
          placeholder="What does this AI Twin do? What can they help with?"
          minRows={2}
          value={bio}
          onChange={e => setBio(e.target.value)}
          styles={{ input: { background: 'var(--nex-input)' } }}
        />

        <Textarea
          label="Personality"
          placeholder="e.g. Friendly, patient, and encouraging. Loves to explain things step by step."
          minRows={2}
          value={personality}
          onChange={e => setPersonality(e.target.value)}
          styles={{ input: { background: 'var(--nex-input)' } }}
        />

        <MultiSelect
          label="Expertise"
          placeholder="Pick topics this twin is expert in"
          data={EXPERTISE_OPTIONS}
          value={expertise}
          onChange={setExpertise}
          searchable
          clearable
          maxValues={6}
          styles={{ input: { background: 'var(--nex-input)' } }}
        />

        <Select
          label="Communication Style"
          data={STYLE_OPTIONS}
          value={commStyle}
          onChange={setCommStyle}
          styles={{ input: { background: 'var(--nex-input)' } }}
        />

        <Switch
          label="Make this twin public (visible to everyone)"
          checked={isPublic}
          onChange={e => setIsPublic(e.currentTarget.checked)}
          color="violet"
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" c="dimmed" onClick={onClose}>Cancel</Button>
          <Button
            leftSection={<IconPlus size={14} />}
            loading={saving}
            onClick={handleCreate}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
          >
            Create Twin
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
