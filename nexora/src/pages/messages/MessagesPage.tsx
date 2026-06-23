import {
  Box, Text, Avatar, Group, Stack, TextInput, ActionIcon, Paper,
  Badge, Loader, Center, ScrollArea, Tooltip, Popover, Modal, Button, Alert
} from '@mantine/core'
import {
  IconSearch, IconSend, IconPaperclip, IconMicrophone, IconMoodSmile,
  IconArrowLeft, IconPin, IconTrash, IconCornerUpLeft, IconX, IconCheck,
  IconChecks, IconPhone, IconVideo, IconMessage, IconDatabase, IconAlertTriangle,
} from '@tabler/icons-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { useRooms, useMessages, useRealtimeMessages, useSendMessage, useDeleteMessage, usePinMessage, useAddReaction, useMarkRead } from '../../hooks/useMessages'
import { useSearchProfiles, useProfile } from '../../hooks/useProfile'
import { useAuthStore } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabase'
import { getInitials, timeAgo, truncate } from '../../utils'
import { messageService } from '../../services/message.service'
import type { Message, Room, Profile } from '../../types'

const EMOJI_LIST = ['😊', '😂', '❤️', '👍', '🔥', '😮', '😢', '🎉', '👏', '💯', '🤔', '😍', '🙏', '✨', '💪']

function getOtherParticipant(room: Room, myId: string): Profile | undefined {
  return room.participants?.find(p => p.id !== myId)
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

function dateDividerLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diff > 365 ? 'numeric' : undefined })
}

// ─── Emoji Picker ────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect }: { onSelect: (e: string) => void }) {
  return (
    <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, padding: 8, background: 'var(--nex-border)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
      {EMOJI_LIST.map(e => (
        <button key={e} onClick={() => onSelect(e)} style={{ fontSize: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, borderRadius: 4 }}>
          {e}
        </button>
      ))}
    </Box>
  )
}

// ─── Reaction Bar ─────────────────────────────────────────────────────────────
function ReactionBar({ reactions }: { reactions: { emoji: string; count: number }[] }) {
  if (!reactions.length) return null
  return (
    <Group gap={4} mt={4}>
      {reactions.map(({ emoji, count }) => (
        <Box key={emoji} style={{ background: 'var(--nex-subtle)', borderRadius: 12, padding: '1px 6px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span>{emoji}</span>
          <Text size="xs" c="dimmed">{count}</Text>
        </Box>
      ))}
    </Group>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
interface BubbleProps {
  msg: Message
  isMine: boolean
  roomId: string
  onReply: (msg: Message) => void
}

function MessageBubble({ msg, isMine, roomId, onReply }: BubbleProps) {
  const deleteMsg = useDeleteMessage()
  const pinMsg = usePinMessage()
  const addReaction = useAddReaction()
  const [hovered, setHovered] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)

  const reactions = (msg.reactions ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
    return acc
  }, {})
  const reactionList = Object.entries(reactions).map(([emoji, count]) => ({ emoji, count }))

  const isDeleted = msg.is_deleted

  return (
    <Group
      justify={isMine ? 'flex-end' : 'flex-start'}
      align="flex-end"
      gap={6}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setEmojiOpen(false) }}
      style={{ position: 'relative' }}
    >
      {!isMine && (
        <Avatar src={msg.sender?.avatar_url} radius="xl" size={28}>
          {msg.sender?.full_name ? getInitials(msg.sender.full_name) : '?'}
        </Avatar>
      )}

      <Box style={{ maxWidth: '70%' }}>
        {/* Reply preview */}
        {msg.reply_to && !isDeleted && (
          <Box style={{
            background: 'var(--nex-surface)', borderLeft: '3px solid #7c3aed', borderRadius: '8px 8px 0 0',
            padding: '4px 8px', marginBottom: 0, opacity: 0.8
          }}>
            <Text size="xs" c="violet" fw={600}>{msg.reply_to.sender?.full_name ?? 'Message'}</Text>
            <Text size="xs" c="dimmed" lineClamp={1}>{msg.reply_to.content}</Text>
          </Box>
        )}

        <Paper
          p="xs"
          style={{
            background: isDeleted
              ? 'var(--nex-input)'
              : isMine
                ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                : 'var(--nex-border)',
            borderRadius: msg.reply_to
              ? '0 8px 8px 8px'
              : isMine
                ? '12px 12px 4px 12px'
                : '12px 12px 12px 4px',
          }}
        >
          {/* Attachment */}
          {!isDeleted && msg.attachment_url && (
            msg.message_type === 'image'
              ? <img src={msg.attachment_url} alt="attachment" style={{ maxWidth: 240, maxHeight: 240, borderRadius: 8, display: 'block', marginBottom: 4 }} />
              : msg.message_type === 'voice'
                ? <Group gap={6} mb={4}>
                  <IconMicrophone size={16} color="#7c3aed" />
                  <Text size="xs" c="dimmed">Voice message · {msg.duration ? formatDuration(msg.duration) : '—'}</Text>
                </Group>
                : <Group gap={6} mb={4}>
                  <IconPaperclip size={14} color="#06b6d4" />
                  <Text size="xs" c="cyan" component="a" href={msg.attachment_url} target="_blank" rel="noreferrer">
                    {msg.attachment_name ?? 'Download file'}
                  </Text>
                </Group>
          )}

          <Text
            c={isDeleted ? 'dimmed' : isMine ? 'white' : undefined}
            size="sm"
            style={{ fontStyle: isDeleted ? 'italic' : 'normal', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
          >
            {msg.content}
          </Text>

          <Group gap={4} justify="flex-end" mt={2}>
            <Text size="xs" c={isMine ? 'rgba(255,255,255,0.5)' : 'dimmed'}>
              {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMine && !isDeleted && (
              <IconChecks size={12} color="rgba(255,255,255,0.6)" />
            )}
          </Group>
        </Paper>

        <ReactionBar reactions={reactionList} />
      </Box>

      {/* Hover action bar */}
      {hovered && !isDeleted && (
        <Group gap={2} style={{ position: 'absolute', [isMine ? 'left' : 'right']: -90, bottom: 8 }}>
          <Popover opened={emojiOpen} onClose={() => setEmojiOpen(false)} position="top" withArrow>
            <Popover.Target>
              <Tooltip label="React">
                <ActionIcon size="sm" variant="subtle" c="dimmed" onClick={() => setEmojiOpen(o => !o)}>
                  <IconMoodSmile size={14} />
                </ActionIcon>
              </Tooltip>
            </Popover.Target>
            <Popover.Dropdown p={0} style={{ background: 'transparent', border: 'none' }}>
              <EmojiPicker onSelect={emoji => {
                addReaction.mutate({ messageId: msg.id, emoji, roomId })
                setEmojiOpen(false)
              }} />
            </Popover.Dropdown>
          </Popover>

          <Tooltip label="Reply">
            <ActionIcon size="sm" variant="subtle" c="dimmed" onClick={() => onReply(msg)}>
              <IconCornerUpLeft size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={msg.pinned_at ? 'Unpin' : 'Pin'}>
            <ActionIcon size="sm" variant="subtle" c="dimmed"
              onClick={() => pinMsg.mutate({ messageId: msg.id, roomId })}>
              <IconPin size={14} />
            </ActionIcon>
          </Tooltip>

          {isMine && (
            <Tooltip label="Delete">
              <ActionIcon size="sm" variant="subtle" c="red"
                onClick={() => deleteMsg.mutate({ messageId: msg.id, roomId })}>
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      )}
    </Group>
  )
}

// ─── Room List Item ───────────────────────────────────────────────────────────
function RoomItem({ room, isActive, myId, onClick }: { room: Room; isActive: boolean; myId: string; onClick: () => void }) {
  const other = getOtherParticipant(room, myId)
  const displayName = other?.full_name || other?.username || 'Unknown'
  const lastMsg = room.last_message

  return (
    <Box
      onClick={onClick}
      style={{
        padding: '12px 16px',
        cursor: 'pointer',
        background: isActive ? 'rgba(124,58,237,0.12)' : 'transparent',
        borderLeft: isActive ? '3px solid #7c3aed' : '3px solid transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <Group gap={10}>
        <Box style={{ position: 'relative' }}>
          <Avatar src={other?.avatar_url} radius="xl" size={44}>
            {getInitials(displayName)}
          </Avatar>
          <Box style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 10, height: 10, borderRadius: '50%',
            background: '#22c55e', border: '2px solid var(--nex-surface)'
          }} />
        </Box>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={0} justify="space-between">
            <Text fw={600} size="sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </Text>
            <Text size="xs" c="dimmed">
              {lastMsg ? timeAgo(lastMsg.created_at) : ''}
            </Text>
          </Group>
          <Group gap={0} justify="space-between">
            <Text size="xs" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {lastMsg?.is_deleted
                ? 'Message deleted'
                : lastMsg?.message_type === 'voice'
                  ? '🎤 Voice message'
                  : lastMsg?.message_type === 'image'
                    ? '📷 Image'
                    : lastMsg?.message_type === 'file'
                      ? '📎 File'
                      : truncate(lastMsg?.content ?? '', 32)}
            </Text>
            {(room.unread_count ?? 0) > 0 && (
              <Badge size="xs" color="violet" variant="filled" style={{ minWidth: 18, padding: '0 5px' }}>
                {room.unread_count}
              </Badge>
            )}
          </Group>
        </Stack>
      </Group>
    </Box>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MessagesPage() {
  const { roomId: urlRoomId } = useParams<{ roomId?: string }>()
  const [searchParams] = useSearchParams()
  const withUserId = searchParams.get('with') ?? ''
  const navigate = useNavigate()
  const authUser = useAuthStore(s => s.user)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(urlRoomId ?? null)
  const [roomSearch, setRoomSearch] = useState('')
  const [msgInput, setMsgInput] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Message[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordDuration, setRecordDuration] = useState(0)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [attachment, setAttachment] = useState<{ url: string; name: string; type: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newChatRaw, setNewChatRaw] = useState('')
  const [newChatLoading, setNewChatLoading] = useState(false)

  const newChatQuery = newChatRaw.replace(/^@+/, '').trim()
  const { data: newChatResults = [] } = useSearchProfiles(newChatQuery)
  const { data: rooms = [], isLoading: roomsLoading, refetch: refetchRooms } = useRooms()
  const { data: withProfile } = useProfile(withUserId)
  const { data: messages = [], isLoading: msgsLoading } = useMessages(activeRoomId ?? '')
  useRealtimeMessages(activeRoomId ?? '')

  // When the rooms list is empty (getRooms RLS issue) but we have an active room,
  // fetch the other participant directly so the header doesn't show "Unknown"
  const activeRoom = rooms.find(r => r.id === activeRoomId)
  const { data: directOtherUser } = useQuery({
    queryKey: ['room-other-user', activeRoomId, authUser?.id],
    queryFn: async () => {
      const { data: part } = await supabase
        .from('room_participants')
        .select('user_id')
        .eq('room_id', activeRoomId!)
        .neq('user_id', authUser!.id)
        .limit(1)
        .maybeSingle()
      if (!part) return null
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', part.user_id)
        .single()
      return prof as Profile | null
    },
    enabled: !!activeRoomId && !!authUser?.id && !activeRoom,
    staleTime: 1000 * 60 * 5,
  })
  const sendMessage = useSendMessage()
  const markRead = useMarkRead()

  const endRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (urlRoomId) refetchRooms()
  }, [urlRoomId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (activeRoomId && authUser?.id) {
      markRead.mutate({ roomId: activeRoomId, userId: authUser.id })
    }
  }, [activeRoomId, authUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectRoom(id: string) {
    setActiveRoomId(id)
    setReplyTo(null)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    navigate(`/messages/${id}`, { replace: true })
  }

  async function handleSend() {
    if ((!msgInput.trim() && !attachment) || !activeRoomId || !authUser) return
    const payload = {
      room_id: activeRoomId,
      sender_id: authUser.id,
      content: msgInput.trim() || (attachment ? attachment.name : ''),
      message_type: attachment ? (attachment.type.startsWith('image/') ? 'image' : 'file') : 'text' as const,
      reply_to_id: replyTo?.id,
      ...(attachment ? { attachment_url: attachment.url, attachment_name: attachment.name, attachment_type: attachment.type } : {}),
    }
    setMsgInput('')
    setReplyTo(null)
    setAttachment(null)
    sendMessage.mutate(payload)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !authUser) return
    setUploading(true)
    try {
      const result = await messageService.uploadAttachment(authUser.id, file)
      setAttachment(result)
    } catch {
      notifications.show({ title: 'Upload failed', message: 'Could not upload file', color: 'red' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = e => audioChunksRef.current.push(e.data)
      recorder.onstop = async () => {
        if (!authUser || !activeRoomId) return
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        try {
          const { url, name, type } = await messageService.uploadAttachment(authUser.id, file)
          sendMessage.mutate({
            room_id: activeRoomId,
            sender_id: authUser.id,
            content: '🎤 Voice message',
            message_type: 'voice',
            attachment_url: url,
            attachment_name: name,
            attachment_type: type,
            duration: recordDuration,
          })
        } catch {
          notifications.show({ title: 'Failed', message: 'Could not send voice message', color: 'red' })
        }
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordDuration(0)
      recordTimerRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000)
    } catch {
      notifications.show({ title: 'Microphone error', message: 'Could not access microphone', color: 'red' })
    }
  }, [authUser, activeRoomId, recordDuration, sendMessage])

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    setIsRecording(false)
    setRecordDuration(0)
  }

  async function startNewChat(targetUserId: string) {
    if (!authUser) return
    setNewChatLoading(true)
    try {
      const roomId = await messageService.getOrCreateRoom(authUser.id, targetUserId)
      selectRoom(roomId)
      setNewChatOpen(false)
      setNewChatRaw('')
    } catch {
      notifications.show({ title: 'Error', message: 'Could not start conversation — messaging tables may not exist yet', color: 'red' })
    } finally {
      setNewChatLoading(false)
    }
  }

  async function handleSearch() {
    if (!activeRoomId || !searchQuery.trim()) return
    const results = await messageService.searchMessages(activeRoomId, searchQuery)
    setSearchResults(results)
  }

  // Derive other user: from rooms list → direct DB fetch → messages sender → ?with= param
  const otherUserFromMsg = messages.find(m => m.sender_id !== authUser?.id)?.sender as Profile | undefined
  const otherUser = activeRoom
    ? getOtherParticipant(activeRoom, authUser?.id ?? '')
    : directOtherUser ?? otherUserFromMsg ?? (withProfile ?? undefined)
  const baseRooms: Room[] = rooms.length > 0
    ? rooms
    : (activeRoomId && otherUser
      ? [{ id: activeRoomId, participants: [otherUser], last_message: messages[messages.length - 1], unread_count: 0, created_at: '', updated_at: '' } as Room]
      : [])

  const filteredRooms = baseRooms.filter(r => {
    const other = getOtherParticipant(r, authUser?.id ?? '')
    const name = other?.full_name || other?.username || ''
    return !roomSearch || name.toLowerCase().includes(roomSearch.toLowerCase())
  })

  // Group messages by date
  const groupedMessages: (Message | { type: 'divider'; label: string; key: string })[] = []
  messages.forEach((msg, i) => {
    const prev = messages[i - 1]
    if (!prev || !isSameDay(prev.created_at, msg.created_at)) {
      groupedMessages.push({ type: 'divider', label: dateDividerLabel(msg.created_at), key: `divider-${i}` })
    }
    groupedMessages.push(msg)
  })

  return (
    <Box style={{ display: 'flex', height: '100vh', background: 'var(--nex-bg)', overflow: 'hidden' }}>
      {/* ── Left: Rooms List ─────────────────────────────────────── */}
      <Box style={{ width: 320, flexShrink: 0, background: 'var(--nex-surface)', borderRight: '1px solid var(--nex-border)', display: 'flex', flexDirection: 'column' }}>
        <Box p="md" style={{ borderBottom: '1px solid var(--nex-border)' }}>
          <Group justify="space-between" mb="xs">
            <Text fw={700} size="lg">Messages</Text>
            <Tooltip label="New Chat">
              <ActionIcon variant="subtle" c="violet" onClick={() => setNewChatOpen(true)}><IconMessage size={18} /></ActionIcon>
            </Tooltip>
          </Group>
          <TextInput
            placeholder="Search conversations..."
            leftSection={<IconSearch size={14} />}
            value={roomSearch}
            onChange={e => setRoomSearch(e.target.value)}
            size="sm"
            styles={{ input: { background: 'var(--nex-input)', border: '1px solid var(--nex-subtle)' } }}
          />
        </Box>
        <ScrollArea style={{ flex: 1 }}>
          {roomsLoading ? (
            <Center py="xl"><Loader size="sm" color="violet" /></Center>
          ) : filteredRooms.length === 0 ? (
            <Box p="md">
              <Alert
                color="orange"
                icon={<IconAlertTriangle size={16} />}
                title="Database fix needed"
                radius="md"
                mb="sm"
              >
                <Text size="xs" mb={8}>
                  Your conversations are hidden due to a Supabase database bug. Run the SQL fix once to permanently repair it.
                </Text>
                <Button
                  size="xs"
                  leftSection={<IconDatabase size={13} />}
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}
                  onClick={() => navigate('/settings?tab=database')}
                >
                  Go to Settings → Database
                </Button>
              </Alert>
              <Text size="xs" c="dimmed" ta="center">Steps: Settings → Database tab → Copy SQL → Run in Supabase</Text>
            </Box>
          ) : (
            filteredRooms.map(room => (
              <RoomItem
                key={room.id}
                room={room}
                isActive={room.id === activeRoomId}
                myId={authUser?.id ?? ''}
                onClick={() => selectRoom(room.id)}
              />
            ))
          )}
        </ScrollArea>
      </Box>

      {/* ── Right: Chat Window ───────────────────────────────────── */}
      {!activeRoomId ? (
        <Center style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Text style={{ fontSize: 48 }}>💬</Text>
            <Text fw={700} size="xl">NEXORA Messages</Text>
            <Text c="dimmed">Select a conversation to start messaging</Text>
          </Stack>
        </Center>
      ) : (
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Chat Header */}
          <Box p="md" style={{ background: 'var(--nex-surface)', borderBottom: '1px solid var(--nex-border)', flexShrink: 0 }}>
            <Group justify="space-between">
              <Group>
                <ActionIcon variant="subtle" c="dimmed" hiddenFrom="sm" onClick={() => setActiveRoomId(null)}>
                  <IconArrowLeft size={18} />
                </ActionIcon>
                <Box style={{ position: 'relative' }}>
                  <Avatar src={otherUser?.avatar_url} radius="xl" size={40}>
                    {otherUser?.full_name ? getInitials(otherUser.full_name) : '?'}
                  </Avatar>
                  <Box style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: 10, height: 10, borderRadius: '50%',
                    background: '#22c55e', border: '2px solid var(--nex-surface)'
                  }} />
                </Box>
                <Stack gap={0}>
                  <Text fw={600}>{otherUser?.full_name || otherUser?.username || 'Unknown'}</Text>
                  <Text size="xs" c="green">Online</Text>
                </Stack>
              </Group>
              <Group gap={4}>
                <Tooltip label="Search messages">
                  <ActionIcon variant="subtle" c="dimmed" onClick={() => setShowSearch(s => !s)}>
                    <IconSearch size={18} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Voice call">
                  <ActionIcon variant="subtle" c="dimmed"><IconPhone size={18} /></ActionIcon>
                </Tooltip>
                <Tooltip label="Video call">
                  <ActionIcon variant="subtle" c="dimmed"><IconVideo size={18} /></ActionIcon>
                </Tooltip>
                <Tooltip label="Pinned messages">
                  <ActionIcon variant="subtle" c="dimmed"><IconPin size={18} /></ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            {/* Search bar */}
            {showSearch && (
              <Group mt="sm">
                <TextInput
                  style={{ flex: 1 }}
                  placeholder="Search in conversation..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                  size="xs"
                  styles={{ input: { background: 'var(--nex-input)', border: '1px solid var(--nex-subtle)' } }}
                />
                <ActionIcon size="sm" onClick={handleSearch}><IconSearch size={14} /></ActionIcon>
              </Group>
            )}

            {/* Search results */}
            {searchResults.length > 0 && (
              <Box mt="xs" style={{ maxHeight: 120, overflowY: 'auto' }}>
                {searchResults.map(r => (
                  <Text key={r.id} size="xs" c="dimmed" py={2} style={{ borderBottom: '1px solid var(--nex-border)' }}>
                    {r.sender?.full_name}: {truncate(r.content, 60)}
                  </Text>
                ))}
              </Box>
            )}
          </Box>

          {/* Messages Area */}
          <ScrollArea style={{ flex: 1, padding: '16px 24px' }}>
            {msgsLoading ? (
              <Center py="xl"><Loader color="violet" /></Center>
            ) : messages.length === 0 ? (
              <Center py="xl">
                <Stack align="center" gap="sm">
                  <Avatar src={otherUser?.avatar_url} radius="xl" size={60}>
                    {otherUser?.full_name ? getInitials(otherUser.full_name) : '?'}
                  </Avatar>
                  <Text fw={600}>{otherUser?.full_name || otherUser?.username || 'Say hello!'}</Text>
                  <Text c="dimmed" size="sm">Say hello! 👋</Text>
                </Stack>
              </Center>
            ) : (
              <Stack gap="sm" px="md" py="md">
                {groupedMessages.map(item => {
                  if ('type' in item && item.type === 'divider') {
                    return (
                      <Group key={item.key} justify="center" my="xs">
                        <Text size="xs" c="dimmed" px="sm" py={2}
                          style={{ background: 'var(--nex-input)', borderRadius: 12 }}>{item.label}</Text>
                      </Group>
                    )
                  }
                  const msg = item as Message
                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isMine={msg.sender_id === authUser?.id}
                      roomId={activeRoomId}
                      onReply={setReplyTo}
                    />
                  )
                })}
              </Stack>
            )}
            <div ref={endRef} />
          </ScrollArea>

          {/* Input Area */}
          <Box style={{ background: 'var(--nex-surface)', borderTop: '1px solid var(--nex-border)', flexShrink: 0 }}>
            {/* Attachment preview */}
            {attachment && (
              <Group px="md" pt="sm" gap={8}>
                <Box style={{ background: 'var(--nex-input)', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconPaperclip size={14} color="#06b6d4" />
                  <Text size="xs" c="cyan">{truncate(attachment.name, 30)}</Text>
                  <ActionIcon size="xs" variant="subtle" c="dimmed" onClick={() => setAttachment(null)}>
                    <IconX size={10} />
                  </ActionIcon>
                </Box>
              </Group>
            )}

            {/* Reply preview */}
            {replyTo && (
              <Group px="md" pt="sm" gap={8} align="flex-start">
                <Box style={{ flex: 1, background: 'var(--nex-input)', borderLeft: '3px solid #7c3aed', borderRadius: '0 8px 8px 0', padding: '4px 8px' }}>
                  <Text size="xs" c="violet" fw={600}>↩ Replying to {replyTo.sender?.full_name ?? 'message'}</Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>{replyTo.content}</Text>
                </Box>
                <ActionIcon size="xs" variant="subtle" c="dimmed" onClick={() => setReplyTo(null)}>
                  <IconX size={12} />
                </ActionIcon>
              </Group>
            )}

            {/* Recording state */}
            {isRecording ? (
              <Group px="md" py="sm" gap={8}>
                <Box style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                <Text c="red" size="sm">Recording... {formatDuration(recordDuration)}</Text>
                <ActionIcon variant="subtle" c="dimmed" onClick={stopRecording}>
                  <IconX size={14} />
                </ActionIcon>
                <ActionIcon
                  size="lg"
                  style={{ background: '#ef4444', borderRadius: 8, marginLeft: 'auto' }}
                  onClick={stopRecording}
                >
                  <IconCheck size={16} />
                </ActionIcon>
              </Group>
            ) : (
              <Group px="md" py="sm" gap={8}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                  accept="image/*,video/*,.pdf,.doc,.docx,.zip"
                />
                <Tooltip label="Attach file">
                  <ActionIcon
                    variant="subtle"
                    c={uploading ? 'yellow' : 'dimmed'}
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                  >
                    <IconPaperclip size={18} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label="Voice message">
                  <ActionIcon variant="subtle" c="dimmed" onMouseDown={startRecording}>
                    <IconMicrophone size={18} />
                  </ActionIcon>
                </Tooltip>

                <Popover opened={showEmojiPicker} onClose={() => setShowEmojiPicker(false)} position="top-start" withArrow>
                  <Popover.Target>
                    <Tooltip label="Emoji">
                      <ActionIcon variant="subtle" c="dimmed" onClick={() => setShowEmojiPicker(o => !o)}>
                        <IconMoodSmile size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Popover.Target>
                  <Popover.Dropdown p={0} style={{ background: 'transparent', border: 'none' }}>
                    <EmojiPicker onSelect={e => { setMsgInput(i => i + e); setShowEmojiPicker(false) }} />
                  </Popover.Dropdown>
                </Popover>

                <TextInput
                  style={{ flex: 1 }}
                  placeholder="Type a message..."
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  styles={{ input: { background: 'var(--nex-input)', border: '1px solid var(--nex-subtle)', borderRadius: 20 } }}
                />

                <ActionIcon
                  size="lg"
                  onClick={handleSend}
                  disabled={!msgInput.trim() && !attachment}
                  style={{
                    background: msgInput.trim() || attachment ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : 'var(--nex-border)',
                    borderRadius: '50%',
                    transition: 'background 0.2s',
                  }}
                >
                  <IconSend size={16} />
                </ActionIcon>
              </Group>
            )}
          </Box>
        </Box>
      )}

      {/* ── New Chat Modal ── */}
      <Modal
        opened={newChatOpen}
        onClose={() => { setNewChatOpen(false); setNewChatRaw('') }}
        title={<Text fw={700}>New Message</Text>}
        centered size="sm"
        styles={{
          header: { background: 'var(--nex-surface-alt)', borderBottom: '1px solid var(--nex-border)' },
          body: { background: 'var(--nex-surface-alt)', padding: 0 },
          content: { background: 'var(--nex-surface-alt)' },
        }}
      >
        <Box p="md">
          <TextInput
            placeholder="Search people..."
            leftSection={<IconSearch size={14} />}
            value={newChatRaw}
            onChange={e => setNewChatRaw(e.target.value)}
            autoFocus
            styles={{ input: { background: 'var(--nex-input)', border: '1px solid var(--nex-subtle)' } }}
            mb="sm"
          />
          {newChatQuery.length < 1 ? (
            <Text c="dimmed" size="sm" ta="center" py="md">Type a name to search</Text>
          ) : newChatResults.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center" py="md">No users found</Text>
          ) : (
            <Stack gap={4}>
              {newChatResults.filter(u => u.id !== authUser?.id).map(user => (
                <Box
                  key={user.id}
                  onClick={() => !newChatLoading && startNewChat(user.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                    background: 'transparent', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.12)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <Group gap={10}>
                    <Avatar src={user.avatar_url} radius="xl" size={40}>{getInitials(user.full_name)}</Avatar>
                    <Stack gap={0} style={{ flex: 1 }}>
                      <Text fw={600} size="sm">{user.full_name}</Text>
                      <Text c="dimmed" size="xs">@{user.username}</Text>
                    </Stack>
                    {newChatLoading && <Loader size="xs" color="violet" />}
                  </Group>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Modal>
    </Box>
  )
}
