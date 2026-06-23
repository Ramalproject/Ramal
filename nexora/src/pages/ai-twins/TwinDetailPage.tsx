import { Box, Paper, Avatar, Text, Badge, Button, Group, Stack, TextInput, ActionIcon, ScrollArea, Loader, Tooltip, FileButton } from '@mantine/core'
import { IconRobot, IconSend, IconVideo, IconArrowLeft, IconCamera, IconPhone, IconSparkles } from '@tabler/icons-react'
import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { supabase } from '../../lib/supabase'
import { formatNumber } from '../../utils'
import type { AiTwin } from '../../types'
import VideoCallModal from '../../components/ai-twins/VideoCallModal'
import AiVoiceCallModal from '../../components/ai-twins/AiVoiceCallModal'
import { FEATURED_CHARACTERS } from '../../data/featuredCharacters'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const OPENAI_KEY_STORAGE = 'nexora_openai_api_key'
const FEAT_AVATAR_PREFIX = 'nexora_feat_avatar_'

function useTwin(id: string) {
  const isFeatured = id.startsWith('featured-')
  return useQuery({
    queryKey: ['ai-twin', id],
    queryFn: async () => {
      if (isFeatured) {
        return FEATURED_CHARACTERS.find(c => c.id === id) ?? null
      }
      const { data } = await supabase
        .from('ai_twins')
        .select('*, owner:profiles!owner_id(*)')
        .eq('id', id)
        .single()
      return data as AiTwin
    },
    enabled: !!id,
  })
}

export default function TwinDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: twin, isLoading } = useTwin(id ?? '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [videoCallOpen, setVideoCallOpen] = useState(false)
  const [voiceCallOpen, setVoiceCallOpen] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const isFeatured = (id ?? '').startsWith('featured-')

  // Custom avatar — from localStorage for featured, from DB for owned
  const [customAvatar, setCustomAvatar] = useState<string | null>(() => {
    if (isFeatured && id) return localStorage.getItem(`${FEAT_AVATAR_PREFIX}${id}`)
    return null
  })

  const endRef = useRef<HTMLDivElement>(null)

  const displayAvatar = customAvatar ?? twin?.avatar_url ?? null

  async function handlePhotoUpload(file: File | null) {
    if (!file || !twin) return
    setUploadingPhoto(true)
    try {
      if (isFeatured) {
        // For featured characters: store as data URL in localStorage
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string
          localStorage.setItem(`${FEAT_AVATAR_PREFIX}${twin.id}`, dataUrl)
          setCustomAvatar(dataUrl)
          notifications.show({ title: 'Photo updated!', message: `${twin.name} now has your custom photo`, color: 'green' })
        }
        reader.readAsDataURL(file)
      } else {
        // For owned twins: upload to Supabase storage
        const ext = file.name.split('.').pop()
        const path = `twin-${twin.id}.${ext}`
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        const { error: dbErr } = await supabase.from('ai_twins').update({ avatar_url: urlData.publicUrl }).eq('id', twin.id)
        if (dbErr) throw dbErr
        qc.invalidateQueries({ queryKey: ['ai-twin', twin.id] })
        notifications.show({ title: 'Photo updated!', message: 'Your AI Twin photo is now set', color: 'green' })
      }
    } catch {
      notifications.show({ title: 'Upload failed', message: 'Could not upload photo', color: 'red' })
    } finally {
      setUploadingPhoto(false)
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || !twin) return
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) {
      notifications.show({
        title: 'No API Key',
        message: 'Go to Settings → API Keys to add your OpenAI API key',
        color: 'orange',
      })
      return
    }

    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setChatLoading(true)

    try {
      const systemPrompt = `You are ${twin.name}, an AI character with a distinct personality. ${twin.bio ?? ''} Personality: ${twin.personality ?? 'helpful and friendly'}. Expertise: ${twin.expertise.join(', ')}. Communication style: ${twin.communication_style ?? 'conversational'}. Respond naturally as this character — never break character or reveal you are an AI unless directly asked.`

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMsg.content }
          ],
          max_tokens: 500,
        })
      })

      if (!res.ok) throw new Error('API error')
      const data = await res.json() as { choices: { message: { content: string } }[] }
      const reply = data.choices[0]?.message?.content ?? "I couldn't respond. Please try again."
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting. Please check your API key in Settings → API Keys.'
      }])
    } finally {
      setChatLoading(false)
    }
  }

  if (isLoading) return <Box p="xl" ta="center"><Loader color="violet" /></Box>
  if (!twin) return <Box p="xl"><Text c="dimmed">AI Twin not found.</Text></Box>

  return (
    <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box p="md" style={{ background: 'var(--nex-surface)', borderBottom: '1px solid var(--nex-border)', flexShrink: 0 }}>
        <Group>
          <ActionIcon variant="subtle" c="dimmed" onClick={() => navigate('/ai-twins')}>
            <IconArrowLeft size={18} />
          </ActionIcon>

          {/* Avatar with edit-photo overlay */}
          <Box style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar src={displayAvatar} radius="xl" size={48} style={{ background: '#1e1b4b' }}>
              <IconRobot size={24} color="#7c3aed" />
            </Avatar>
            <Tooltip label="Change photo" withArrow position="bottom">
              <Box style={{ position: 'absolute', bottom: -2, right: -2 }}>
                <FileButton onChange={handlePhotoUpload} accept="image/*">
                  {(props) => (
                    <ActionIcon
                      {...props}
                      size={20} radius="xl"
                      loading={uploadingPhoto}
                      style={{
                        background: isFeatured ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : '#7c3aed',
                        border: '2px solid var(--nex-surface)',
                      }}
                    >
                      <IconCamera size={11} color="white" />
                    </ActionIcon>
                  )}
                </FileButton>
              </Box>
            </Tooltip>
          </Box>

          <Stack gap={0} style={{ flex: 1 }}>
            <Group gap={6}>
              <Text fw={700}>{twin.name}</Text>
              <Badge size="xs" color="violet" variant="light">AI Twin</Badge>
              {isFeatured && <Badge size="xs" color="cyan" leftSection={<IconSparkles size={9} />}>Featured</Badge>}
            </Group>
            <Group gap={4}>
              {twin.expertise.slice(0, 3).map(e => (
                <Badge key={e} size="xs" variant="outline" color="cyan">{e}</Badge>
              ))}
            </Group>
          </Stack>
          <Group gap={8}>
            <Text c="dimmed" size="xs">{formatNumber(twin.chats_count)} chats</Text>
            <Button
              size="sm"
              leftSection={<IconPhone size={14} />}
              style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
              onClick={() => setVoiceCallOpen(true)}
            >
              AI Call
            </Button>
            <Button
              size="sm"
              leftSection={<IconVideo size={14} />}
              style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
              onClick={() => setVideoCallOpen(true)}
            >
              Video
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Messages */}
      <ScrollArea style={{ flex: 1 }} p="md">
        {messages.length === 0 && (
          <Box ta="center" py="xl">
            <Avatar src={displayAvatar} radius="xl" size={80} mx="auto" mb="md" style={{ background: '#1e1b4b' }}>
              <IconRobot size={40} color="#7c3aed" />
            </Avatar>
            <Text fw={600} size="lg">{twin.name}</Text>
            {twin.bio && <Text c="dimmed" size="sm" mt={4} maw={400} mx="auto">{twin.bio}</Text>}
            <Text c="dimmed" size="sm" mt="xl">
              👋 Start a conversation with {twin.name}!
            </Text>
          </Box>
        )}
        <Stack gap="sm" px="md" pb="md">
          {messages.map((msg, i) => (
            <Group key={i} justify={msg.role === 'user' ? 'flex-end' : 'flex-start'} align="flex-end">
              {msg.role === 'assistant' && (
                <Avatar src={displayAvatar} radius="xl" size="sm" style={{ background: '#1e1b4b' }}>
                  <IconRobot size={14} color="#7c3aed" />
                </Avatar>
              )}
              <Paper
                p="sm"
                style={{
                  maxWidth: '72%',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                    : 'var(--nex-border)',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                }}
              >
                <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {msg.content}
                </Text>
              </Paper>
            </Group>
          ))}
          {chatLoading && (
            <Group>
              <Avatar src={displayAvatar} radius="xl" size="sm" style={{ background: '#1e1b4b' }}>
                <IconRobot size={14} color="#7c3aed" />
              </Avatar>
              <Paper p="sm" style={{ background: 'var(--nex-border)', borderRadius: '16px 16px 16px 4px' }}>
                <Loader size="xs" color="violet" />
              </Paper>
            </Group>
          )}
        </Stack>
        <div ref={endRef} />
      </ScrollArea>

      {videoCallOpen && <VideoCallModal twin={{ ...twin, avatar_url: displayAvatar }} onEnd={() => setVideoCallOpen(false)} />}
      {voiceCallOpen && <AiVoiceCallModal twin={{ ...twin, avatar_url: displayAvatar }} onEnd={() => setVoiceCallOpen(false)} />}

      {/* Input */}
      <Box p="md" style={{ background: 'var(--nex-surface)', borderTop: '1px solid var(--nex-border)', flexShrink: 0 }}>
        <Group>
          <TextInput
            style={{ flex: 1 }}
            placeholder={`Message ${twin.name}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            disabled={chatLoading}
            styles={{ input: { background: 'var(--nex-input)', border: '1px solid var(--nex-subtle)' } }}
          />
          <ActionIcon
            size="lg"
            onClick={sendMessage}
            loading={chatLoading}
            disabled={!input.trim()}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', borderRadius: 8 }}
          >
            <IconSend size={16} />
          </ActionIcon>
        </Group>
      </Box>
    </Box>
  )
}
