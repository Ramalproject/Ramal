import {
  Modal, Textarea, Button, Stack, Group, Avatar, Text, Box,
  Switch, SegmentedControl, Slider, Badge, ActionIcon, Divider,
  Paper, Tooltip, Menu, Popover, TextInput, ScrollArea, UnstyledButton,
} from '@mantine/core'
import {
  IconPhoto, IconMoodSmile, IconMapPin, IconUsers,
  IconRocket, IconTarget, IconMessage2, IconTrendingUp,
  IconClock, IconCurrencyDollar, IconEye, IconChevronDown,
  IconLock, IconWorld, IconUserCheck, IconSparkles, IconX, IconCheck, IconCurrentLocation,
} from '@tabler/icons-react'
import { useState, useRef, useCallback } from 'react'
import { notifications } from '@mantine/notifications'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { useQueryClient } from '@tanstack/react-query'
import { profileService } from '../../services/profile.service'
import { getInitials } from '../../utils'

interface Props { opened: boolean; onClose: () => void }

const BOOST_GOALS = [
  { id: 'reach', icon: IconTrendingUp, label: 'Boost Reach', desc: 'Show to more people', color: '#7c3aed' },
  { id: 'messages', icon: IconMessage2, label: 'Get Messages', desc: 'Drive conversations', color: '#06b6d4' },
  { id: 'community', icon: IconUsers, label: 'Grow Community', desc: 'Gain new followers', color: '#10b981' },
]
const DURATIONS = [
  { value: '1', label: '1 Day' }, { value: '3', label: '3 Days' },
  { value: '7', label: '7 Days' }, { value: '14', label: '14 Days' },
]
const AUDIENCES = [
  { id: 'auto', icon: IconSparkles, label: 'Auto Audience', desc: 'AI picks the best match', color: '#7c3aed' },
  { id: 'custom', icon: IconTarget, label: 'Custom Audience', desc: 'Set your own targeting', color: '#f59e0b' },
]
const FEELINGS = [
  { emoji: '😊', label: 'Happy' }, { emoji: '😍', label: 'Loved' }, { emoji: '🎉', label: 'Excited' },
  { emoji: '💪', label: 'Motivated' }, { emoji: '🤔', label: 'Thoughtful' }, { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' }, { emoji: '😴', label: 'Tired' }, { emoji: '🔥', label: 'On Fire' },
  { emoji: '🙏', label: 'Grateful' }, { emoji: '😎', label: 'Cool' }, { emoji: '🤩', label: 'Amazed' },
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
  const [feeling, setFeeling] = useState<{ emoji: string; label: string } | null>(null)
  const [locationText, setLocationText] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [locationOpen, setLocationOpen] = useState(false)
  const [feelingOpen, setFeelingOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const [tagResults, setTagResults] = useState<{ id: string; username: string; full_name: string; avatar_url: string | null }[]>([])
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [boostEnabled, setBoostEnabled] = useState(false)
  const [boostGoal, setBoostGoal] = useState('reach')
  const [boostAudience, setBoostAudience] = useState('auto')
  const [duration, setDuration] = useState('3')
  const [budget, setBudget] = useState(5)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalSpend = budget * Number(duration)
  const reach = estimateReach(budget, Number(duration))

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
      notifications.show({ title: 'Upload failed', message: 'Could not upload — ensure Supabase avatars bucket is public', color: 'red' })
    } finally {
      setUploadingMedia(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleTagSearch(q: string) {
    setTagQuery(q)
    const clean = q.replace(/^@+/, '').trim()
    if (clean.length < 1) { setTagResults([]); return }
    const results = await profileService.searchProfiles(clean, 6)
    setTagResults(results.filter(p => p.id !== user?.id) as typeof tagResults)
  }

  function insertTag(username: string) {
    setContent(c => c + (c.endsWith(' ') || c === '' ? '' : ' ') + `@${username} `)
    setTagOpen(false)
    setTagQuery('')
    setTagResults([])
  }

  function handleClose() {
    setContent(''); setMediaUrls([]); setFeeling(null); setLocationText('')
    setBoostEnabled(false); onClose()
  }

  async function handleSubmit() {
    if (!content.trim() && mediaUrls.length === 0 || !user) return
    setLoading(true)
    const fullContent = [
      content.trim(),
      feeling ? `— feeling ${feeling.emoji} ${feeling.label}` : '',
      locationText ? `📍 ${locationText}` : '',
    ].filter(Boolean).join('  ')

    const { error } = await supabase.from('posts').insert({
      content: fullContent,
      author_id: user.id,
      post_type: mediaUrls.length > 0 ? 'image' : 'text',
      visibility,
      media_urls: mediaUrls,
      likes_count: 0, comments_count: 0, shares_count: 0,
    })
    setLoading(false)
    if (error) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' })
    } else {
      notifications.show({
        title: boostEnabled ? '🚀 Post Boosted!' : '✅ Posted!',
        message: boostEnabled ? `Boosted for ${duration} days ($${totalSpend})` : 'Your post is now live',
        color: 'violet',
      })
      qc.invalidateQueries({ queryKey: ['posts'] })
      handleClose()
    }
  }

  const detectGPS = useCallback(async () => {
    setDetectingLocation(true)
    setLocationOpen(false)  // close popover immediately on click

    const tryGPS = (): Promise<{ lat: number; lon: number } | null> =>
      new Promise(resolve => {
        if (!navigator.geolocation || window.location.protocol !== 'https:') {
          resolve(null); return
        }
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude }),
          () => resolve(null),
          { timeout: 8000 }
        )
      })

    const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const json = await res.json()
      const a = json.address ?? {}
      const city = a.city ?? a.town ?? a.village ?? a.county ?? ''
      const country = a.country ?? ''
      return [city, country].filter(Boolean).join(', ') || `${lat.toFixed(3)}, ${lon.toFixed(3)}`
    }

    try {
      const gps = await tryGPS()
      if (gps) {
        setLocationText(await reverseGeocode(gps.lat, gps.lon))
        return
      }
      // Fallback: IP-based (works on HTTP, no permission needed)
      const res = await fetch('https://ipapi.co/json/')
      const json = await res.json()
      const city = json.city ?? ''
      const country = json.country_name ?? ''
      const place = [city, country].filter(Boolean).join(', ')
      setLocationText(place || '')
      if (!place) notifications.show({ title: 'Could not detect location', message: 'Please type your location manually', color: 'orange' })
    } catch {
      notifications.show({ title: 'Could not detect location', message: 'Please type your location manually', color: 'orange' })
    } finally {
      setDetectingLocation(false)
    }
  }, [])

  const VisIcon = visibility === 'public' ? IconWorld : visibility === 'connections' ? IconUserCheck : IconLock
  const canPost = content.trim().length > 0 || mediaUrls.length > 0

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size="lg"
      padding={0}
      withCloseButton={false}
      centered
      radius="xl"
      styles={{
        content: { background: 'var(--nex-surface-alt)', border: '1px solid var(--nex-border)', overflow: 'hidden' },
        overlay: { backdropFilter: 'blur(4px)' },
      }}
    >
      {/* Header */}
      <Box style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))',
        borderBottom: '1px solid var(--nex-border)', padding: '16px 20px',
      }}>
        <Group justify="space-between">
          <Group gap={10}>
            <Avatar src={profile?.avatar_url} radius="xl" size={40} style={{ border: '2px solid #7c3aed' }}>
              {getInitials(profile?.full_name ?? user?.email ?? 'U')}
            </Avatar>
            <Box>
              <Text fw={700} size="sm">{profile?.full_name ?? user?.email?.split('@')[0]}</Text>
              {/* ── Visibility dropdown ── */}
              <Menu shadow="md" width={180} withinPortal zIndex={1002}>
                <Menu.Target>
                  <UnstyledButton style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'rgba(124,58,237,0.15)', borderRadius: 20, padding: '2px 8px',
                    border: '1px solid rgba(124,58,237,0.3)', cursor: 'pointer' }}>
                    <VisIcon size={11} color="#7c3aed" />
                    <Text size="xs" c="violet" fw={500} style={{ textTransform: 'capitalize' }}>{visibility === 'connections' ? 'Connections' : visibility}</Text>
                    <IconChevronDown size={10} color="#7c3aed" />
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-subtle)' }}>
                  <Menu.Item leftSection={<IconWorld size={14} color="#22c55e" />} onClick={() => setVisibility('public')}
                    style={visibility === 'public' ? { color: '#a78bfa' } : undefined}>
                    Public {visibility === 'public' && '✓'}
                  </Menu.Item>
                  <Menu.Item leftSection={<IconUserCheck size={14} color="#06b6d4" />} onClick={() => setVisibility('connections')}
                    style={visibility === 'connections' ? { color: '#a78bfa' } : undefined}>
                    Connections {visibility === 'connections' && '✓'}
                  </Menu.Item>
                  <Menu.Item leftSection={<IconLock size={14} color="#f59e0b" />} onClick={() => setVisibility('private')}
                    style={visibility === 'private' ? { color: '#a78bfa' } : undefined}>
                    Only Me {visibility === 'private' && '✓'}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Box>
          </Group>
          <ActionIcon variant="subtle" c="dimmed" onClick={handleClose} radius="xl"><IconX size={16} /></ActionIcon>
        </Group>
      </Box>

      <ScrollArea style={{ maxHeight: '70vh' }}>
        <Box p="lg">
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={handleMediaSelect} />

          {/* Media preview grid */}
          {mediaUrls.length > 0 && (
            <Box style={{
              display: 'grid',
              gridTemplateColumns: mediaUrls.length === 1 ? '1fr' : '1fr 1fr',
              gap: 6, marginBottom: 12, borderRadius: 10, overflow: 'hidden',
              border: '1px solid var(--nex-subtle)',
            }}>
              {mediaUrls.map((url, i) => (
                <Box key={i} style={{ position: 'relative', background: 'var(--nex-surface)',
                  minHeight: mediaUrls.length === 1 ? 220 : 140,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img src={url} style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: mediaUrls.length === 1 ? 260 : 160, display: 'block' }} />
                  <ActionIcon size="sm" radius="xl" style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.75)', zIndex: 2 }}
                    onClick={() => setMediaUrls(prev => prev.filter((_, j) => j !== i))}>
                    <IconX size={12} color="white" />
                  </ActionIcon>
                </Box>
              ))}
            </Box>
          )}

          {/* Tags row (feeling + location) */}
          {(feeling || locationText) && (
            <Group gap={6} mb={8}>
              {feeling && (
                <Badge size="sm" variant="light" color="yellow" rightSection={
                  <ActionIcon size="xs" variant="transparent" onClick={() => setFeeling(null)}>
                    <IconX size={10} />
                  </ActionIcon>
                }>
                  {feeling.emoji} Feeling {feeling.label}
                </Badge>
              )}
              {locationText && (
                <Badge size="sm" variant="light" color="red" rightSection={
                  <ActionIcon size="xs" variant="transparent" onClick={() => setLocationText('')}>
                    <IconX size={10} />
                  </ActionIcon>
                }>
                  📍 {locationText}
                </Badge>
              )}
            </Group>
          )}

          {/* Text area */}
          <Textarea
            placeholder="What's on your mind? Share something amazing..."
            minRows={mediaUrls.length > 0 ? 2 : 4}
            maxRows={8}
            value={content}
            onChange={e => setContent(e.target.value)}
            autosize
            styles={{
              input: {
                background: 'transparent', border: 'none',
                fontSize: '1rem', lineHeight: 1.6, padding: '4px 0', resize: 'none',
              },
            }}
          />

          <Group justify="flex-end" mb={8}>
            <Text size="xs" c={content.length > 500 ? 'red' : 'dimmed'}>{content.length}/600</Text>
          </Group>

          {/* Action bar */}
          <Box style={{ background: 'var(--nex-surface)', borderRadius: 12, border: '1px solid var(--nex-border)', padding: '10px 14px', marginBottom: 16 }}>
            <Group justify="space-between" align="center">
              <Text size="xs" c="dimmed" fw={500}>Add to your post</Text>
              <Group gap={4}>

                {/* Photo/Video */}
                <Tooltip label={mediaUrls.length >= 4 ? 'Max 4 photos' : 'Photo/Video'} withArrow>
                  <ActionIcon variant="subtle" radius="xl" size={34} style={{ color: '#22c55e' }}
                    loading={uploadingMedia} disabled={mediaUrls.length >= 4}
                    onClick={() => fileInputRef.current?.click()}>
                    <IconPhoto size={18} />
                  </ActionIcon>
                </Tooltip>

                {/* Feeling */}
                <Popover opened={feelingOpen} onClose={() => setFeelingOpen(false)} position="top" withArrow withinPortal zIndex={1001}>
                  <Popover.Target>
                    <Tooltip label="Feeling" withArrow>
                      <ActionIcon variant="subtle" radius="xl" size={34} style={{ color: '#f59e0b' }}
                        onClick={() => { setLocationOpen(false); setTagOpen(false); setFeelingOpen(o => !o) }}>
                        <IconMoodSmile size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Popover.Target>
                  <Popover.Dropdown style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-subtle)', padding: 12 }}>
                    <Text size="xs" c="dimmed" mb={8} fw={600}>How are you feeling?</Text>
                    <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                      {FEELINGS.map(f => (
                        <Box key={f.label} onClick={() => { setFeeling(f); setFeelingOpen(false) }}
                          style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, cursor: 'pointer',
                            background: feeling?.label === f.label ? 'rgba(124,58,237,0.2)' : 'transparent',
                            border: feeling?.label === f.label ? '1px solid #7c3aed' : '1px solid transparent' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = feeling?.label === f.label ? 'rgba(124,58,237,0.2)' : 'transparent'}>
                          <Text style={{ fontSize: 20 }}>{f.emoji}</Text>
                          <Text size="9px" c="dimmed">{f.label}</Text>
                        </Box>
                      ))}
                    </Box>
                  </Popover.Dropdown>
                </Popover>

                {/* Location */}
                <Popover opened={locationOpen} onClose={() => setLocationOpen(false)} position="top" withArrow withinPortal zIndex={1001}>
                  <Popover.Target>
                    <Tooltip label="Location" withArrow>
                      <ActionIcon variant="subtle" radius="xl" size={34} style={{ color: '#ef4444' }}
                        onClick={() => { setFeelingOpen(false); setTagOpen(false); setLocationOpen(o => !o) }}>
                        <IconMapPin size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Popover.Target>
                  <Popover.Dropdown style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-subtle)', padding: 12, minWidth: 240 }}>
                    <Text size="xs" c="dimmed" mb={8} fw={600}>Add location</Text>
                    <Button
                      fullWidth size="xs" variant="light" color="red" radius="md" mb={8}
                      leftSection={<IconCurrentLocation size={13} />}
                      loading={detectingLocation}
                      onClick={detectGPS}
                    >
                      Use my current location
                    </Button>
                    <Text size="xs" c="dimmed" ta="center" mb={8}>or type manually</Text>
                    <Group gap={6}>
                      <TextInput
                        placeholder="City, country..."
                        value={locationInput}
                        onChange={e => setLocationInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && locationInput.trim()) { setLocationText(locationInput.trim()); setLocationInput(''); setLocationOpen(false) } }}
                        size="xs"
                        style={{ flex: 1 }}
                        styles={{ input: { background: 'var(--nex-input)', border: '1px solid var(--nex-subtle)' } }}
                      />
                      <ActionIcon size={28} style={{ background: '#7c3aed' }}
                        onClick={() => { if (locationInput.trim()) { setLocationText(locationInput.trim()); setLocationInput(''); setLocationOpen(false) } }}>
                        <IconCheck size={14} color="white" />
                      </ActionIcon>
                    </Group>
                  </Popover.Dropdown>
                </Popover>

                {/* Tag People */}
                <Popover opened={tagOpen} onClose={() => { setTagOpen(false); setTagQuery(''); setTagResults([]) }} position="top" withArrow withinPortal zIndex={1001}>
                  <Popover.Target>
                    <Tooltip label="Tag People" withArrow>
                      <ActionIcon variant="subtle" radius="xl" size={34} style={{ color: '#06b6d4' }}
                        onClick={() => { setFeelingOpen(false); setLocationOpen(false); setTagOpen(o => !o) }}>
                        <IconUsers size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Popover.Target>
                  <Popover.Dropdown style={{ background: 'var(--nex-surface)', border: '1px solid var(--nex-subtle)', padding: 12, minWidth: 240 }}>
                    <Text size="xs" c="dimmed" mb={8} fw={600}>Tag someone</Text>
                    <TextInput
                      placeholder="Search name..."
                      value={tagQuery}
                      onChange={e => handleTagSearch(e.target.value)}
                      size="xs"
                      styles={{ input: { background: 'var(--nex-input)', border: '1px solid var(--nex-subtle)' } }}
                      autoFocus
                      mb={tagResults.length > 0 ? 6 : 0}
                    />
                    {tagResults.map(u => (
                      <Box key={u.id} onClick={() => insertTag(u.username)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderRadius: 6, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <Avatar src={u.avatar_url} size={28} radius="xl">{getInitials(u.full_name)}</Avatar>
                        <Box>
                          <Text size="xs" fw={600}>{u.full_name}</Text>
                          <Text size="10px" c="dimmed">@{u.username}</Text>
                        </Box>
                      </Box>
                    ))}
                    {tagQuery.length >= 2 && tagResults.length === 0 && (
                      <Text size="xs" c="dimmed" ta="center" py={4}>No users found</Text>
                    )}
                  </Popover.Dropdown>
                </Popover>

              </Group>
            </Group>
          </Box>

          <Divider color="var(--nex-border)" mb={16} />

          {/* Boost toggle */}
          <Group justify="space-between" align="center" mb={boostEnabled ? 16 : 0}>
            <Group gap={10}>
              <Box style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                background: boostEnabled ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : 'var(--nex-border)' }}>
                <IconRocket size={18} color={boostEnabled ? 'white' : '#4a4a6a'} />
              </Box>
              <Box>
                <Text size="sm" fw={600}>Boost Post</Text>
                <Text size="xs" c="dimmed">Reach more people with paid promotion</Text>
              </Box>
            </Group>
            <Switch checked={boostEnabled} onChange={e => setBoostEnabled(e.currentTarget.checked)} color="violet" size="md" />
          </Group>

          {boostEnabled && (
            <Stack gap={16}>
              <Box>
                <Text size="xs" fw={600} c="dimmed" mb={8} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Campaign Goal</Text>
                <Group gap={8}>
                  {BOOST_GOALS.map(goal => {
                    const Icon = goal.icon; const active = boostGoal === goal.id
                    return (
                      <Box key={goal.id} onClick={() => setBoostGoal(goal.id)} style={{ flex: 1, cursor: 'pointer' }}>
                        <Paper style={{ background: active ? `${goal.color}22` : 'var(--nex-surface)', border: `1.5px solid ${active ? goal.color : 'var(--nex-border)'}`,
                          borderRadius: 12, padding: '12px 10px', textAlign: 'center', transition: 'all 0.2s' }}>
                          <Icon size={22} color={active ? goal.color : '#4a4a6a'} style={{ marginBottom: 6 }} />
                          <Text size="xs" fw={600} c={active ? 'white' : 'dimmed'}>{goal.label}</Text>
                          <Text size="10px" c="dimmed" mt={2}>{goal.desc}</Text>
                        </Paper>
                      </Box>
                    )
                  })}
                </Group>
              </Box>
              <Box>
                <Text size="xs" fw={600} c="dimmed" mb={8} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Audience</Text>
                <Group gap={8}>
                  {AUDIENCES.map(aud => {
                    const Icon = aud.icon; const active = boostAudience === aud.id
                    return (
                      <Box key={aud.id} onClick={() => setBoostAudience(aud.id)} style={{ flex: 1, cursor: 'pointer' }}>
                        <Paper style={{ background: active ? 'rgba(124,58,237,0.12)' : 'var(--nex-surface)', border: `1.5px solid ${active ? aud.color : 'var(--nex-border)'}`,
                          borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s' }}>
                          <Box style={{ width: 32, height: 32, borderRadius: 8, background: active ? `${aud.color}22` : 'var(--nex-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={16} color={active ? aud.color : '#4a4a6a'} />
                          </Box>
                          <Box>
                            <Text size="xs" fw={600} c={active ? 'white' : 'dimmed'}>{aud.label}</Text>
                            <Text size="10px" c="dimmed">{aud.desc}</Text>
                          </Box>
                        </Paper>
                      </Box>
                    )
                  })}
                </Group>
              </Box>
              <Box>
                <Text size="xs" fw={600} c="dimmed" mb={8} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Duration</Text>
                <SegmentedControl data={DURATIONS} value={duration} onChange={setDuration} fullWidth radius="md"
                  styles={{ root: { background: 'var(--nex-surface)', border: '1px solid var(--nex-border)' },
                    indicator: { background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', borderRadius: 8 },
                    label: { color: '#8892b0', fontSize: '0.8rem', fontWeight: 500 },
                    control: { borderColor: 'transparent !important' } }} />
              </Box>
              <Box>
                <Group justify="space-between" mb={10}>
                  <Text size="xs" fw={600} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Daily Budget</Text>
                  <Badge size="md" style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                    <Group gap={3}><IconCurrencyDollar size={12} />{budget}/day</Group>
                  </Badge>
                </Group>
                <Slider min={1} max={50} step={1} value={budget} onChange={setBudget} color="violet"
                  marks={[{ value: 1, label: '$1' }, { value: 10, label: '$10' }, { value: 25, label: '$25' }, { value: 50, label: '$50' }]}
                  styles={{ track: { background: 'var(--nex-border)' }, mark: { borderColor: 'var(--nex-subtle)' }, markLabel: { color: '#4a4a6a', fontSize: '10px' } }}
                  mb={24} />
              </Box>
              <Box style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.08))',
                border: '1px solid rgba(124,58,237,0.25)', borderRadius: 14, padding: '14px 16px' }}>
                <Group justify="space-around">
                  <Box ta="center">
                    <Group gap={4} justify="center" mb={2}><IconEye size={14} color="#7c3aed" /><Text size="xs" c="dimmed" fw={500}>Est. Reach</Text></Group>
                    <Text size="sm" fw={700}>{reach}</Text>
                  </Box>
                  <Divider orientation="vertical" color="var(--nex-border)" />
                  <Box ta="center">
                    <Group gap={4} justify="center" mb={2}><IconClock size={14} color="#06b6d4" /><Text size="xs" c="dimmed" fw={500}>Duration</Text></Group>
                    <Text size="sm" fw={700}>{duration} {Number(duration) === 1 ? 'Day' : 'Days'}</Text>
                  </Box>
                  <Divider orientation="vertical" color="var(--nex-border)" />
                  <Box ta="center">
                    <Group gap={4} justify="center" mb={2}><IconCurrencyDollar size={14} color="#10b981" /><Text size="xs" c="dimmed" fw={500}>Total Spend</Text></Group>
                    <Text size="sm" fw={700}>${totalSpend.toFixed(0)}</Text>
                  </Box>
                </Group>
              </Box>
            </Stack>
          )}
        </Box>
      </ScrollArea>

      {/* Footer */}
      <Box style={{ borderTop: '1px solid var(--nex-border)', padding: '14px 20px', background: 'var(--nex-bg)' }}>
        <Button fullWidth onClick={handleSubmit} loading={loading} disabled={!canPost} size="md" radius="xl"
          leftSection={boostEnabled ? <IconRocket size={16} /> : undefined}
          style={{ background: boostEnabled ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            border: 'none', fontWeight: 700, fontSize: '0.95rem', opacity: canPost ? 1 : 0.5 }}>
          {boostEnabled ? `Publish & Boost · $${totalSpend}` : 'Publish Post'}
        </Button>
      </Box>
    </Modal>
  )
}
