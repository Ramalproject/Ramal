import {
  Modal, Textarea, Button, Stack, Group, Avatar, Text, Box,
  Switch, SegmentedControl, Slider, Badge, ActionIcon, Divider,
  Paper, UnstyledButton, Tooltip,
} from '@mantine/core'
import {
  IconPhoto, IconMoodSmile, IconMapPin, IconUsers,
  IconRocket, IconTarget, IconMessage2, IconTrendingUp,
  IconClock, IconCurrencyDollar, IconEye, IconChevronDown,
  IconLock, IconWorld, IconUserCheck, IconSparkles,
} from '@tabler/icons-react'
import { useState, useRef } from 'react'
import { notifications } from '@mantine/notifications'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { useQueryClient } from '@tanstack/react-query'
import { getInitials } from '../../utils'

interface Props { opened: boolean; onClose: () => void }

const BOOST_GOALS = [
  { id: 'reach', icon: IconTrendingUp, label: 'Boost Reach', desc: 'Show to more people', color: '#7c3aed' },
  { id: 'messages', icon: IconMessage2, label: 'Get Messages', desc: 'Drive conversations', color: '#06b6d4' },
  { id: 'community', icon: IconUsers, label: 'Grow Community', desc: 'Gain new followers', color: '#10b981' },
]

const DURATIONS = [
  { value: '1', label: '1 Day' },
  { value: '3', label: '3 Days' },
  { value: '7', label: '7 Days' },
  { value: '14', label: '14 Days' },
]

const AUDIENCES = [
  { id: 'auto', icon: IconSparkles, label: 'Auto Audience', desc: 'AI picks the best match', color: '#7c3aed' },
  { id: 'custom', icon: IconTarget, label: 'Custom Audience', desc: 'Set your own targeting', color: '#f59e0b' },
]

function estimateReach(budget: number, days: number) {
  const base = budget * days * 180
  const low = Math.round(base * 0.8 / 100) * 100
  const high = Math.round(base * 1.4 / 100) * 100
  return `${low.toLocaleString()} – ${high.toLocaleString()}`
}

export default function CreatePostModal({ opened, onClose }: Props) {
  const user = useAuthStore(s => s.user)
  const profile = useAuthStore(s => s.profile)
  const qc = useQueryClient()

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [visibility, setVisibility] = useState('public')
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - mediaUrls.length)
    if (!files.length || !user) return
    setUploadingMedia(true)
    try {
      const urls = await Promise.all(files.map(async (file) => {
        const ext = file.name.split('.').pop()
        const path = `post-media/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('avatars').upload(path, file)
        if (error) throw error
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        return data.publicUrl
      }))
      setMediaUrls(prev => [...prev, ...urls].slice(0, 4))
    } catch {
      notifications.show({ title: 'Upload failed', message: 'Could not upload — check Supabase storage settings', color: 'red' })
    } finally {
      setUploadingMedia(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }
  const [boostEnabled, setBoostEnabled] = useState(false)
  const [boostGoal, setBoostGoal] = useState('reach')
  const [boostAudience, setBoostAudience] = useState('auto')
  const [duration, setDuration] = useState('3')
  const [budget, setBudget] = useState(5)

  const totalSpend = budget * Number(duration)
  const reach = estimateReach(budget, Number(duration))

  async function handleSubmit() {
    if (!content.trim() || !user) return
    setLoading(true)
    const { error } = await supabase.from('posts').insert({
      content: content.trim(),
      author_id: user.id,
      post_type: mediaUrls.length > 0 ? 'image' : 'text',
      visibility,
      media_urls: mediaUrls,
      likes_count: 0,
      comments_count: 0,
      shares_count: 0,
    })
    setLoading(false)
    if (error) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' })
    } else {
      notifications.show({
        title: boostEnabled ? '🚀 Post Boosted!' : '✅ Posted!',
        message: boostEnabled
          ? `Your post is live and boosted for ${duration} days ($${totalSpend} total)`
          : 'Your post is now live',
        color: 'violet',
      })
      qc.invalidateQueries({ queryKey: ['posts'] })
      setContent('')
      setMediaUrls([])
      setBoostEnabled(false)
      onClose()
    }
  }

  const visibilityIcon = visibility === 'public' ? IconWorld : visibility === 'connections' ? IconUserCheck : IconLock
  const VisIcon = visibilityIcon

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      padding={0}
      withCloseButton={false}
      centered
      radius="xl"
      styles={{
        content: { background: '#0f0f1a', border: '1px solid #1e1e3a', overflow: 'hidden' },
        overlay: { backdropFilter: 'blur(4px)' },
      }}
    >
      {/* Header */}
      <Box style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))',
        borderBottom: '1px solid #1e1e3a',
        padding: '16px 20px',
      }}>
        <Group justify="space-between">
          <Group gap={10}>
            <Avatar
              src={profile?.avatar_url}
              radius="xl" size={40}
              style={{ border: '2px solid #7c3aed' }}
            >
              {getInitials(profile?.full_name ?? user?.email ?? 'U')}
            </Avatar>
            <Box>
              <Text fw={700} c="white" size="sm">{profile?.full_name ?? user?.email?.split('@')[0]}</Text>
              <UnstyledButton
                onClick={() => setVisibility(v => v === 'public' ? 'connections' : v === 'connections' ? 'private' : 'public')}
              >
                <Group gap={4} style={{
                  background: 'rgba(124,58,237,0.15)', borderRadius: 20,
                  padding: '2px 8px', border: '1px solid rgba(124,58,237,0.3)',
                }}>
                  <VisIcon size={11} color="#7c3aed" />
                  <Text size="xs" c="violet" fw={500} style={{ textTransform: 'capitalize' }}>{visibility}</Text>
                  <IconChevronDown size={10} color="#7c3aed" />
                </Group>
              </UnstyledButton>
            </Box>
          </Group>
          <ActionIcon variant="subtle" c="dimmed" onClick={onClose} radius="xl">
            ✕
          </ActionIcon>
        </Group>
      </Box>

      <Box p="lg">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleMediaSelect}
        />

        {/* Media preview grid */}
        {mediaUrls.length > 0 && (
          <Box style={{
            display: 'grid',
            gridTemplateColumns: mediaUrls.length === 1 ? '1fr' : '1fr 1fr',
            gap: 6, marginBottom: 12,
          }}>
            {mediaUrls.map((url, i) => (
              <Box key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '16/9' }}>
                <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <ActionIcon
                  size="sm" radius="xl"
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)' }}
                  onClick={() => setMediaUrls(prev => prev.filter((_, j) => j !== i))}
                >
                  ✕
                </ActionIcon>
              </Box>
            ))}
          </Box>
        )}

        {/* Text area */}
        <Textarea
          placeholder="What's on your mind? Share something amazing..."
          minRows={4}
          maxRows={8}
          value={content}
          onChange={e => setContent(e.target.value)}
          autosize
          styles={{
            input: {
              background: 'transparent',
              border: 'none',
              color: '#e2e8f0',
              fontSize: '1rem',
              lineHeight: 1.6,
              padding: '4px 0',
              resize: 'none',
              '&::placeholder': { color: '#4a4a6a' },
            },
          }}
        />

        {/* Character count */}
        <Group justify="flex-end" mb={8}>
          <Text size="xs" c={content.length > 500 ? 'red' : 'dimmed'}>{content.length}/600</Text>
        </Group>

        {/* Media action bar */}
        <Box style={{
          background: '#141428', borderRadius: 12,
          border: '1px solid #1e1e3a', padding: '10px 14px',
          marginBottom: 16,
        }}>
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed" fw={500}>Add to your post</Text>
            <Group gap={4}>
              <Tooltip label={mediaUrls.length >= 4 ? 'Max 4 photos' : 'Photo/Video'} withArrow>
                <ActionIcon
                  variant="subtle" radius="xl" size={34}
                  style={{ color: '#22c55e' }}
                  loading={uploadingMedia}
                  disabled={mediaUrls.length >= 4}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconPhoto size={18} />
                </ActionIcon>
              </Tooltip>
              {[
                { icon: IconMoodSmile, label: 'Feeling', color: '#f59e0b' },
                { icon: IconMapPin, label: 'Location', color: '#ef4444' },
                { icon: IconUsers, label: 'Tag People', color: '#06b6d4' },
              ].map(({ icon: Icon, label, color }) => (
                <Tooltip key={label} label={label} withArrow>
                  <ActionIcon
                    variant="subtle" radius="xl" size={34}
                    style={{ color }}
                    onClick={() => notifications.show({ message: `${label} coming soon`, color: 'violet' })}
                  >
                    <Icon size={18} />
                  </ActionIcon>
                </Tooltip>
              ))}
            </Group>
          </Group>
        </Box>

        <Divider color="#1e1e3a" mb={16} />

        {/* Boost toggle */}
        <Group justify="space-between" align="center" mb={boostEnabled ? 16 : 0}>
          <Group gap={10}>
            <Box style={{
              width: 36, height: 36, borderRadius: 10,
              background: boostEnabled ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : '#1e1e3a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}>
              <IconRocket size={18} color={boostEnabled ? 'white' : '#4a4a6a'} />
            </Box>
            <Box>
              <Text size="sm" fw={600} c="white">Boost Post</Text>
              <Text size="xs" c="dimmed">Reach more people with paid promotion</Text>
            </Box>
          </Group>
          <Switch
            checked={boostEnabled}
            onChange={e => setBoostEnabled(e.currentTarget.checked)}
            color="violet"
            size="md"
          />
        </Group>

        {/* Boost options */}
        {boostEnabled && (
          <Stack gap={16}>
            {/* Goal */}
            <Box>
              <Text size="xs" fw={600} c="dimmed" mb={8} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Campaign Goal
              </Text>
              <Group gap={8}>
                {BOOST_GOALS.map(goal => {
                  const Icon = goal.icon
                  const active = boostGoal === goal.id
                  return (
                    <UnstyledButton
                      key={goal.id}
                      onClick={() => setBoostGoal(goal.id)}
                      style={{ flex: 1 }}
                    >
                      <Paper style={{
                        background: active ? `rgba(${goal.color === '#7c3aed' ? '124,58,237' : goal.color === '#06b6d4' ? '6,182,212' : '16,185,129'},0.15)` : '#141428',
                        border: `1.5px solid ${active ? goal.color : '#1e1e3a'}`,
                        borderRadius: 12, padding: '12px 10px',
                        textAlign: 'center', transition: 'all 0.2s',
                        cursor: 'pointer',
                      }}>
                        <Icon size={22} color={active ? goal.color : '#4a4a6a'} style={{ marginBottom: 6 }} />
                        <Text size="xs" fw={600} c={active ? 'white' : 'dimmed'}>{goal.label}</Text>
                        <Text size="10px" c="dimmed" mt={2}>{goal.desc}</Text>
                      </Paper>
                    </UnstyledButton>
                  )
                })}
              </Group>
            </Box>

            {/* Audience */}
            <Box>
              <Text size="xs" fw={600} c="dimmed" mb={8} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Audience
              </Text>
              <Group gap={8}>
                {AUDIENCES.map(aud => {
                  const Icon = aud.icon
                  const active = boostAudience === aud.id
                  return (
                    <UnstyledButton key={aud.id} onClick={() => setBoostAudience(aud.id)} style={{ flex: 1 }}>
                      <Paper style={{
                        background: active ? 'rgba(124,58,237,0.12)' : '#141428',
                        border: `1.5px solid ${active ? aud.color : '#1e1e3a'}`,
                        borderRadius: 12, padding: '12px 14px',
                        display: 'flex', alignItems: 'center', gap: 10,
                        transition: 'all 0.2s', cursor: 'pointer',
                      }}>
                        <Box style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: active ? `${aud.color}22` : '#1e1e3a',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <Icon size={16} color={active ? aud.color : '#4a4a6a'} />
                        </Box>
                        <Box>
                          <Text size="xs" fw={600} c={active ? 'white' : 'dimmed'}>{aud.label}</Text>
                          <Text size="10px" c="dimmed">{aud.desc}</Text>
                        </Box>
                      </Paper>
                    </UnstyledButton>
                  )
                })}
              </Group>
            </Box>

            {/* Duration */}
            <Box>
              <Text size="xs" fw={600} c="dimmed" mb={8} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Duration
              </Text>
              <SegmentedControl
                data={DURATIONS}
                value={duration}
                onChange={setDuration}
                fullWidth
                radius="md"
                styles={{
                  root: { background: '#141428', border: '1px solid #1e1e3a' },
                  indicator: { background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', borderRadius: 8 },
                  label: { color: '#8892b0', fontSize: '0.8rem', fontWeight: 500 },
                  control: { borderColor: 'transparent !important' },
                }}
              />
            </Box>

            {/* Daily budget */}
            <Box>
              <Group justify="space-between" mb={10}>
                <Text size="xs" fw={600} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Daily Budget
                </Text>
                <Badge
                  size="md"
                  style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
                >
                  <Group gap={3}>
                    <IconCurrencyDollar size={12} />
                    {budget}/day
                  </Group>
                </Badge>
              </Group>
              <Slider
                min={1} max={50} step={1}
                value={budget}
                onChange={setBudget}
                color="violet"
                marks={[
                  { value: 1, label: '$1' },
                  { value: 10, label: '$10' },
                  { value: 25, label: '$25' },
                  { value: 50, label: '$50' },
                ]}
                styles={{
                  track: { background: '#1e1e3a' },
                  mark: { borderColor: '#2d2d4e' },
                  markLabel: { color: '#4a4a6a', fontSize: '10px' },
                }}
                mb={24}
              />
            </Box>

            {/* Summary card */}
            <Box style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.08))',
              border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: 14, padding: '14px 16px',
            }}>
              <Group justify="space-around">
                <Box ta="center">
                  <Group gap={4} justify="center" mb={2}>
                    <IconEye size={14} color="#7c3aed" />
                    <Text size="xs" c="dimmed" fw={500}>Est. Reach</Text>
                  </Group>
                  <Text size="sm" fw={700} c="white">{reach}</Text>
                </Box>
                <Divider orientation="vertical" color="#1e1e3a" />
                <Box ta="center">
                  <Group gap={4} justify="center" mb={2}>
                    <IconClock size={14} color="#06b6d4" />
                    <Text size="xs" c="dimmed" fw={500}>Duration</Text>
                  </Group>
                  <Text size="sm" fw={700} c="white">{duration} {Number(duration) === 1 ? 'Day' : 'Days'}</Text>
                </Box>
                <Divider orientation="vertical" color="#1e1e3a" />
                <Box ta="center">
                  <Group gap={4} justify="center" mb={2}>
                    <IconCurrencyDollar size={14} color="#10b981" />
                    <Text size="xs" c="dimmed" fw={500}>Total Spend</Text>
                  </Group>
                  <Text size="sm" fw={700} c="white">${totalSpend.toFixed(0)}</Text>
                </Box>
              </Group>
            </Box>
          </Stack>
        )}
      </Box>

      {/* Footer */}
      <Box style={{
        borderTop: '1px solid #1e1e3a', padding: '14px 20px',
        background: '#0a0a14',
      }}>
        <Button
          fullWidth
          onClick={handleSubmit}
          loading={loading}
          disabled={!content.trim() && mediaUrls.length === 0}
          size="md"
          radius="xl"
          leftSection={boostEnabled ? <IconRocket size={16} /> : undefined}
          style={{
            background: boostEnabled
              ? 'linear-gradient(135deg, #7c3aed, #06b6d4)'
              : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.95rem',
            opacity: (!content.trim() && mediaUrls.length === 0) ? 0.5 : 1,
          }}
        >
          {boostEnabled ? `Publish & Boost · $${totalSpend}` : 'Publish Post'}
        </Button>
      </Box>
    </Modal>
  )
}
