import { Box, Paper, Avatar, Text, Badge, Button, Group, Stack, TextInput, ActionIcon, ScrollArea, Loader, Tooltip } from '@mantine/core'
import { IconRobot, IconSend, IconVideo, IconArrowLeft, IconCamera } from '@tabler/icons-react'
import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { formatNumber } from '../../utils'
import type { AiTwin } from '../../types'
import VideoCallModal from '../../components/ai-twins/VideoCallModal'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const OPENAI_KEY_STORAGE = 'nexora_openai_api_key'

function useTwin(id: string) {
  return useQuery({
    queryKey: ['ai-twin', id],
    queryFn: async () => {
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
  const authUser = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const { data: twin, isLoading } = useTwin(id ?? '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [videoCallOpen, setVideoCallOpen] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const isOwner = !!authUser && !!twin && twin.owner_id === authUser.id

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !twin) return
    setUploadingPhoto(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `twin-${twin.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('ai_twins').update({ avatar_url: urlData.publicUrl }).eq('id', twin.id)
      if (dbErr) throw dbErr
      qc.invalidateQueries({ queryKey: ['ai-twin', twin.id] })
      notifications.show({ title: 'Photo updated!', message: 'Your AI Twin photo is now set', color: 'green' })
    } catch {
      notifications.show({ title: 'Upload failed', message: 'Could not upload photo', color: 'red' })
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
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
      const systemPrompt = `You are ${twin.name}, an AI Twin. ${twin.bio ?? ''} Personality: ${twin.personality ?? 'helpful and friendly'}. Expertise: ${twin.expertise.join(', ')}. Communication style: ${twin.communication_style ?? 'conversational'}.`

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

          {/* Avatar with edit-photo overlay for owner */}
          <Box style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar src={twin.avatar_url} radius="xl" size={48}>
              <IconRobot size={24} color="#7c3aed" />
            </Avatar>
            {isOwner && (
              <Tooltip label="Change photo" withArrow position="bottom">
                <ActionIcon
                  size={20} radius="xl"
                  loading={uploadingPhoto}
                  onClick={() => photoInputRef.current?.click()}
                  style={{
                    position: 'absolute', bottom: -2, right: -2,
                    background: '#7c3aed',
                    border: '2px solid var(--nex-surface)',
                  }}
                >
                  <IconCamera size={11} color="white" />
                </ActionIcon>
              </Tooltip>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
          </Box>
          <Stack gap={0} style={{ flex: 1 }}>
            <Group gap={6}>
              <Text fw={700} c="white">{twin.name}</Text>
              <Badge size="xs" color="violet" variant="light">AI Twin</Badge>
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
              leftSection={<IconVideo size={14} />}
              style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
              onClick={() => setVideoCallOpen(true)}
            >
              Video Call
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Messages */}
      <ScrollArea style={{ flex: 1 }} p="md">
        {messages.length === 0 && (
          <Box ta="center" py="xl">
            <Avatar src={twin.avatar_url} radius="xl" size={80} mx="auto" mb="md">
              <IconRobot size={40} color="#7c3aed" />
            </Avatar>
            <Text fw={600} c="white" size="lg">{twin.name}</Text>
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
                <Avatar src={twin.avatar_url} radius="xl" size="sm">
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
                <Text c="white" size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {msg.content}
                </Text>
              </Paper>
            </Group>
          ))}
          {chatLoading && (
            <Group>
              <Avatar src={twin.avatar_url} radius="xl" size="sm">
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

      {videoCallOpen && <VideoCallModal twin={twin} onEnd={() => setVideoCallOpen(false)} />}

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
            styles={{ input: { background: 'var(--nex-input)', border: '1px solid var(--nex-subtle)', color: 'white' } }}
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
