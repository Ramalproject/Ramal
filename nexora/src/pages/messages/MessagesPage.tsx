import {
  Box, Text, Avatar, Group, Stack, ActionIcon, Badge,
  Loader, Center, ScrollArea, Tooltip, Popover, Modal, Button, Alert,
} from '@mantine/core'
import {
  IconSearch, IconSend, IconPaperclip, IconMicrophone, IconMoodSmile,
  IconArrowLeft, IconPin, IconTrash, IconCornerUpLeft, IconX, IconCheck,
  IconChecks, IconPhone, IconVideo, IconMessage, IconDatabase, IconAlertTriangle,
  IconPlus,
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
    <Box style={{
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4,
      padding: 10, background: 'var(--nex-surface)',
      border: '1px solid var(--nex-border)',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      {EMOJI_LIST.map(e => (
        <button
          key={e}
          onClick={() => onSelect(e)}
          style={{
            fontSize: 20, border: 'none', background: 'transparent', cursor: 'pointer',
            padding: 6, borderRadius: 8, transition: 'background 0.15s',
          }}
          onMouseEnter={ev => (ev.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.2)'}
          onMouseLeave={ev => (ev.currentTarget as HTMLButtonElement).style.background = 'transparent'}
        >
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
    <Group gap={4} mt={6}>
      {reactions.map(({ emoji, count }) => (
        <Box
          key={emoji}
          style={{
            background: 'rgba(124,58,237,0.15)',
            border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: 12, padding: '2px 8px', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span>{emoji}</span>
          <Text size="xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{count}</Text>
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

  // Bug fix: only show reply preview when reply_to exists AND has valid content
  const hasValidReply = !isDeleted && msg.reply_to && (msg.reply_to.content || msg.reply_to.sender)

  return (
    <Group
      justify={isMine ? 'flex-end' : 'flex-start'}
      align="flex-end"
      gap={8}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setEmojiOpen(false) }}
      style={{ position: 'relative', marginBottom: 2 }}
    >
      {/* Left avatar for received messages */}
      {!isMine && (
        <Avatar
          src={msg.sender?.avatar_url}
          radius="xl"
          size={28}
          style={{
            flexShrink: 0,
            border: '2px solid rgba(124,58,237,0.3)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {msg.sender?.full_name ? getInitials(msg.sender.full_name) : '?'}
        </Avatar>
      )}

      <Box style={{ maxWidth: '68%' }}>
        {/* Reply preview — only when valid reply data exists */}
        {hasValidReply && (
          <Box style={{
            background: isMine ? 'rgba(0,0,0,0.2)' : 'var(--nex-input)',
            borderLeft: '3px solid #7c3aed',
            borderRadius: '10px 10px 0 0',
            padding: '5px 10px',
            marginBottom: 0,
          }}>
            <Text size="xs" style={{ color: '#a78bfa', fontWeight: 600 }}>
              {msg.reply_to!.sender?.full_name ?? '↩ Reply'}
            </Text>
            <Text size="xs" style={{ color: 'var(--nex-text-muted)' }} lineClamp={1}>
              {msg.reply_to!.content}
            </Text>
          </Box>
        )}

        {/* Bubble */}
        <Box
          style={{
            background: isDeleted
              ? 'var(--nex-input)'
              : isMine
                ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                : 'var(--nex-input)',
            border: isDeleted
              ? '1px solid var(--nex-border)'
              : isMine
                ? 'none'
                : '1px solid var(--nex-border)',
            borderRadius: hasValidReply
              ? isMine ? '0 4px 18px 18px' : '4px 0 18px 18px'
              : isMine
                ? '18px 18px 4px 18px'
                : '4px 18px 18px 18px',
            padding: '10px 14px',
            boxShadow: isMine
              ? '0 4px 16px rgba(124,58,237,0.35)'
              : '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          {/* Attachment */}
          {!isDeleted && msg.attachment_url && (
            msg.message_type === 'image'
              ? <img
                  src={msg.attachment_url}
                  alt="attachment"
                  style={{ maxWidth: 260, maxHeight: 260, borderRadius: 10, display: 'block', marginBottom: 6 }}
                />
              : msg.message_type === 'voice'
                ? <Group gap={8} mb={6} style={{
                    background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '6px 10px',
                  }}>
                    <Box style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(124,58,237,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <IconMicrophone size={14} color="#a78bfa" />
                    </Box>
                    <Text size="xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Voice message · {msg.duration ? formatDuration(msg.duration) : '—'}
                    </Text>
                  </Group>
                : <Group gap={6} mb={6} style={{
                    background: 'rgba(6,182,212,0.1)', borderRadius: 8, padding: '6px 10px',
                    border: '1px solid rgba(6,182,212,0.2)',
                  }}>
                    <IconPaperclip size={14} color="#06b6d4" />
                    <Text size="xs" style={{ color: '#06b6d4' }} component="a" href={msg.attachment_url} target="_blank" rel="noreferrer">
                      {msg.attachment_name ?? 'Download file'}
                    </Text>
                  </Group>
          )}

          <Text
            size="sm"
            style={{
              color: isDeleted ? 'var(--nex-text-muted)' : isMine ? '#ffffff' : 'var(--nex-text)',
              fontStyle: isDeleted ? 'italic' : 'normal',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.55,
            }}
          >
            {msg.content}
          </Text>

          <Group gap={4} justify="flex-end" mt={4}>
            <Text size="xs" style={{ color: isMine ? 'rgba(255,255,255,0.55)' : 'var(--nex-text-muted)' }}>
              {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMine && !isDeleted && (
              <IconChecks size={12} color="rgba(255,255,255,0.5)" />
            )}
          </Group>
        </Box>

        <ReactionBar reactions={reactionList} />
      </Box>

      {/* Hover action bar */}
      {hovered && !isDeleted && (
        <Box
          style={{
            position: 'absolute',
            [isMine ? 'left' : 'right']: -108,
            bottom: 6,
            display: 'flex',
            gap: 2,
            background: 'var(--nex-surface)',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 20,
            padding: '3px 5px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <Popover opened={emojiOpen} onClose={() => setEmojiOpen(false)} position="top" withArrow>
            <Popover.Target>
              <Tooltip label="React" withArrow>
                <ActionIcon
                  size="sm" variant="subtle" radius="xl"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                  onClick={() => setEmojiOpen(o => !o)}
                >
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

          <Tooltip label="Reply" withArrow>
            <ActionIcon
              size="sm" variant="subtle" radius="xl"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onClick={() => onReply(msg)}
            >
              <IconCornerUpLeft size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={msg.pinned_at ? 'Unpin' : 'Pin'} withArrow>
            <ActionIcon
              size="sm" variant="subtle" radius="xl"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onClick={() => pinMsg.mutate({ messageId: msg.id, roomId })}
            >
              <IconPin size={14} />
            </ActionIcon>
          </Tooltip>

          {isMine && (
            <Tooltip label="Delete" withArrow>
              <ActionIcon
                size="sm" variant="subtle" radius="xl"
                style={{ color: '#f87171' }}
                onClick={() => deleteMsg.mutate({ messageId: msg.id, roomId })}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Box>
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
        background: isActive
          ? 'linear-gradient(90deg, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0.06) 100%)'
          : 'transparent',
        borderLeft: isActive ? '3px solid #7c3aed' : '3px solid transparent',
        transition: 'all 0.15s ease',
        borderRadius: '0 8px 8px 0',
        marginRight: 8,
        marginBottom: 2,
      }}
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.08)'
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <Group gap={12} wrap="nowrap">
        <Box style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar
            src={other?.avatar_url}
            radius="xl"
            size={46}
            style={{
              border: isActive ? '2px solid rgba(124,58,237,0.5)' : '2px solid rgba(255,255,255,0.06)',
              boxShadow: isActive ? '0 0 0 2px rgba(124,58,237,0.15)' : 'none',
            }}
          >
            {getInitials(displayName)}
          </Avatar>
          <Box style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 11, height: 11, borderRadius: '50%',
            background: '#22c55e',
            border: '2px solid var(--nex-surface)',
            boxShadow: '0 0 6px rgba(34,197,94,0.6)',
          }} />
        </Box>

        <Stack gap={3} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={0} justify="space-between" wrap="nowrap">
            <Text
              fw={600}
              size="sm"
              style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: 'var(--nex-text)',
              }}
            >
              {displayName}
            </Text>
            <Text size="xs" style={{ color: 'var(--nex-text-muted)', flexShrink: 0, marginLeft: 6 }}>
              {lastMsg ? timeAgo(lastMsg.created_at) : ''}
            </Text>
          </Group>
          <Group gap={0} justify="space-between" wrap="nowrap">
            <Text
              size="xs"
              style={{
                color: 'var(--nex-text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
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
              <Badge
                size="xs"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  color: '#fff',
                  minWidth: 20,
                  padding: '0 6px',
                  flexShrink: 0,
                  marginLeft: 6,
                }}
              >
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

  // Detect whether the DB SQL fix has been applied (get_my_rooms RPC exists)
  const { data: rpcWorking } = useQuery({
    queryKey: ['rpc-check', authUser?.id],
    queryFn: async () => {
      const { error } = await supabase.rpc('get_my_rooms', { p_user_id: authUser!.id })
      return !error || !error.message?.toLowerCase().includes('function')
    },
    enabled: !!authUser?.id,
    staleTime: 1000 * 60 * 5,
  })

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

  const myId = authUser?.id ?? ''

  return (
    <Box style={{ display: 'flex', height: '100vh', background: 'var(--nex-bg)', overflow: 'hidden' }}>

      {/* ══════════════════════════════════════════════════════
          LEFT SIDEBAR
      ══════════════════════════════════════════════════════ */}
      <Box style={{
        width: 320,
        flexShrink: 0,
        background: 'var(--nex-surface)',
        borderRight: '1px solid rgba(124,58,237,0.12)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '2px 0 24px rgba(0,0,0,0.3)',
      }}>

        {/* Sidebar Header */}
        <Box style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--nex-border)' }}>
          <Group justify="space-between" mb={14} align="center">
            <Group gap={8}>
              <Box style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                boxShadow: '0 0 8px rgba(124,58,237,0.8)',
              }} />
              <Text fw={700} size="lg" style={{ color: 'var(--nex-text)', letterSpacing: '-0.3px' }}>
                Messages
              </Text>
            </Group>
            <Tooltip label="New Chat" withArrow>
              <ActionIcon
                size={34}
                onClick={() => setNewChatOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  borderRadius: 10,
                  boxShadow: '0 2px 12px rgba(124,58,237,0.4)',
                }}
              >
                <IconPlus size={16} color="#fff" />
              </ActionIcon>
            </Tooltip>
          </Group>

          {/* Search bar */}
          <Box style={{ position: 'relative' }}>
            <IconSearch
              size={14}
              style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--nex-text-muted)',
                zIndex: 1,
              }}
            />
            <input
              type="text"
              placeholder="Search conversations..."
              value={roomSearch}
              onChange={e => setRoomSearch(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--nex-input)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '8px 12px 8px 34px',
                color: 'var(--nex-text)',
                fontSize: 13,
                outline: 'none',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.5)')}
              onBlur={e => (e.target.style.borderColor = 'var(--nex-border)')}
            />
          </Box>
        </Box>

        {/* Room List */}
        <ScrollArea style={{ flex: 1 }} pt={8}>
          {roomsLoading ? (
            <Center py="xl"><Loader size="sm" color="violet" /></Center>
          ) : filteredRooms.length === 0 ? (
            <Box p="md">
              {rpcWorking === false ? (
                <>
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
                </>
              ) : (
                <Stack align="center" gap="xs" pt="xl">
                  <Box style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(124,58,237,0.1)',
                    border: '1px solid rgba(124,58,237,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IconMessage size={24} color="rgba(124,58,237,0.6)" />
                  </Box>
                  <Text style={{ color: 'var(--nex-text-muted)' }} size="sm" ta="center">No conversations yet</Text>
                  <Text style={{ color: 'var(--nex-text-muted)' }} size="xs" ta="center">Click + above to start a new chat</Text>
                  <Button
                    size="xs"
                    mt={4}
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', borderRadius: 8 }}
                    onClick={() => setNewChatOpen(true)}
                  >
                    Start a conversation
                  </Button>
                </Stack>
              )}
            </Box>
          ) : (
            filteredRooms.map(room => (
              <RoomItem
                key={room.id}
                room={room}
                isActive={room.id === activeRoomId}
                myId={myId}
                onClick={() => selectRoom(room.id)}
              />
            ))
          )}
        </ScrollArea>
      </Box>

      {/* ══════════════════════════════════════════════════════
          RIGHT: CHAT AREA
      ══════════════════════════════════════════════════════ */}
      {!activeRoomId ? (
        /* Empty state */
        <Center style={{ flex: 1, background: 'radial-gradient(ellipse at 60% 40%, rgba(124,58,237,0.08) 0%, var(--nex-bg) 70%)' }}>
          <Stack align="center" gap="lg">
            <Box style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.15))',
              border: '1px solid rgba(124,58,237,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(124,58,237,0.2)',
            }}>
              <IconMessage size={36} color="#7c3aed" />
            </Box>
            <Stack align="center" gap={6}>
              <Text fw={700} size="xl" style={{ color: 'var(--nex-text)', letterSpacing: '-0.3px' }}>
                NEXORA Messages
              </Text>
              <Text style={{ color: 'var(--nex-text-muted)' }} size="sm">
                Select a conversation to start messaging
              </Text>
            </Stack>
            <Button
              size="sm"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', borderRadius: 10 }}
              leftSection={<IconPlus size={14} />}
              onClick={() => setNewChatOpen(true)}
            >
              New Conversation
            </Button>
          </Stack>
        </Center>
      ) : (
        <Box style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'radial-gradient(ellipse at 70% 20%, rgba(124,58,237,0.06) 0%, var(--nex-bg) 60%)',
          overflow: 'hidden',
        }}>

          {/* ── Chat Header ────────────────────────────────────── */}
          <Box style={{
            padding: '14px 20px',
            background: 'var(--nex-surface)',
            borderBottom: '1px solid rgba(124,58,237,0.12)',
            flexShrink: 0,
            boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
          }}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap={12} wrap="nowrap">
                <ActionIcon
                  variant="subtle"
                  style={{ color: 'var(--nex-text-muted)' }}
                  hiddenFrom="sm"
                  onClick={() => setActiveRoomId(null)}
                >
                  <IconArrowLeft size={18} />
                </ActionIcon>

                <Box style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar
                    src={otherUser?.avatar_url}
                    radius="xl"
                    size={42}
                    style={{
                      border: '2px solid rgba(124,58,237,0.4)',
                      boxShadow: '0 0 0 3px rgba(124,58,237,0.1)',
                    }}
                  >
                    {otherUser?.full_name ? getInitials(otherUser.full_name) : '?'}
                  </Avatar>
                  <Box style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: 11, height: 11, borderRadius: '50%',
                    background: '#22c55e',
                    border: '2px solid var(--nex-surface)',
                    boxShadow: '0 0 6px rgba(34,197,94,0.7)',
                  }} />
                </Box>

                <Stack gap={1}>
                  <Text fw={700} size="sm" style={{ color: 'var(--nex-text)', letterSpacing: '-0.2px' }}>
                    {otherUser?.full_name || otherUser?.username || 'Unknown'}
                  </Text>
                  <Group gap={5} align="center">
                    <Box style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                    <Text size="xs" style={{ color: '#22c55e' }}>Online</Text>
                  </Group>
                </Stack>
              </Group>

              <Group gap={4}>
                <Tooltip label="Search messages" withArrow>
                  <ActionIcon
                    size={36}
                    variant="subtle"
                    style={{ color: 'var(--nex-text-muted)', borderRadius: 10 }}
                    onClick={() => setShowSearch(s => !s)}
                  >
                    <IconSearch size={17} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Voice call" withArrow>
                  <ActionIcon
                    size={36}
                    variant="subtle"
                    style={{ color: 'var(--nex-text-muted)', borderRadius: 10 }}
                  >
                    <IconPhone size={17} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Video call" withArrow>
                  <ActionIcon
                    size={36}
                    variant="subtle"
                    style={{ color: 'var(--nex-text-muted)', borderRadius: 10 }}
                  >
                    <IconVideo size={17} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Pinned messages" withArrow>
                  <ActionIcon
                    size={36}
                    variant="subtle"
                    style={{ color: 'var(--nex-text-muted)', borderRadius: 10 }}
                  >
                    <IconPin size={17} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            {/* Inline search bar */}
            {showSearch && (
              <Group mt={12} gap={8}>
                <Box style={{ flex: 1, position: 'relative' }}>
                  <IconSearch
                    size={13}
                    style={{
                      position: 'absolute', left: 10, top: '50%',
                      transform: 'translateY(-50%)', color: 'var(--nex-text-muted)', zIndex: 1,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search in conversation..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                    style={{
                      width: '100%',
                      background: 'var(--nex-input)',
                      border: '1px solid rgba(124,58,237,0.3)',
                      borderRadius: 8,
                      padding: '7px 10px 7px 30px',
                      color: 'var(--nex-text)',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </Box>
                <ActionIcon
                  size={32}
                  onClick={handleSearch}
                  style={{
                    background: 'rgba(124,58,237,0.25)',
                    border: '1px solid rgba(124,58,237,0.4)',
                    borderRadius: 8,
                  }}
                >
                  <IconSearch size={14} color="#a78bfa" />
                </ActionIcon>
              </Group>
            )}

            {/* Search results */}
            {searchResults.length > 0 && (
              <Box
                mt={8}
                style={{
                  maxHeight: 110, overflowY: 'auto',
                  background: 'var(--nex-input)',
                  borderRadius: 8, padding: '4px 8px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {searchResults.map(r => (
                  <Text
                    key={r.id}
                    size="xs"
                    style={{ color: 'var(--nex-text-muted)', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    {r.sender?.full_name}: {truncate(r.content, 60)}
                  </Text>
                ))}
              </Box>
            )}
          </Box>

          {/* ── Messages Area ──────────────────────────────────── */}
          <ScrollArea style={{ flex: 1 }}>
            {msgsLoading ? (
              <Center py="xl"><Loader color="violet" /></Center>
            ) : messages.length === 0 ? (
              <Center py="xl">
                <Stack align="center" gap="md">
                  <Avatar
                    src={otherUser?.avatar_url}
                    radius="xl"
                    size={64}
                    style={{
                      border: '3px solid rgba(124,58,237,0.4)',
                      boxShadow: '0 0 0 4px rgba(124,58,237,0.1)',
                    }}
                  >
                    {otherUser?.full_name ? getInitials(otherUser.full_name) : '?'}
                  </Avatar>
                  <Stack align="center" gap={4}>
                    <Text fw={700} size="lg" style={{ color: 'var(--nex-text)' }}>
                      {otherUser?.full_name || otherUser?.username || 'Unknown'}
                    </Text>
                    <Text style={{ color: 'var(--nex-text-muted)' }} size="sm">
                      Send a message to start the conversation
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            ) : (
              <Stack gap={4} px={24} py={20}>
                {groupedMessages.map(item => {
                  if ('type' in item && item.type === 'divider') {
                    return (
                      <Group key={item.key} justify="center" my="sm">
                        <Box style={{
                          background: 'var(--nex-input)',
                          border: '1px solid var(--nex-border)',
                          borderRadius: 20,
                          padding: '3px 14px',
                        }}>
                          <Text size="xs" style={{ color: 'var(--nex-text-muted)' }}>
                            {item.label}
                          </Text>
                        </Box>
                      </Group>
                    )
                  }
                  const msg = item as Message
                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isMine={myId ? msg.sender_id === myId : false}
                      roomId={activeRoomId}
                      onReply={setReplyTo}
                    />
                  )
                })}
              </Stack>
            )}
            <div ref={endRef} />
          </ScrollArea>

          {/* ── Input Bar ──────────────────────────────────────── */}
          <Box style={{
            background: 'var(--nex-surface)',
            borderTop: '1px solid rgba(124,58,237,0.12)',
            flexShrink: 0,
            padding: '0 16px',
          }}>

            {/* Attachment preview */}
            {attachment && (
              <Group px={4} pt={10} gap={8}>
                <Group
                  gap={6}
                  style={{
                    background: 'rgba(6,182,212,0.08)',
                    border: '1px solid rgba(6,182,212,0.25)',
                    borderRadius: 8,
                    padding: '5px 10px',
                  }}
                >
                  <IconPaperclip size={13} color="#06b6d4" />
                  <Text size="xs" style={{ color: '#06b6d4' }}>{truncate(attachment.name, 30)}</Text>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    style={{ color: 'var(--nex-text-muted)' }}
                    onClick={() => setAttachment(null)}
                  >
                    <IconX size={10} />
                  </ActionIcon>
                </Group>
              </Group>
            )}

            {/* Reply preview */}
            {replyTo && (
              <Group px={4} pt={10} gap={8} align="flex-start">
                <Box style={{
                  flex: 1,
                  background: 'rgba(124,58,237,0.08)',
                  borderLeft: '3px solid #7c3aed',
                  borderRadius: '0 8px 8px 0',
                  padding: '5px 10px',
                }}>
                  <Text size="xs" style={{ color: '#a78bfa', fontWeight: 600 }}>
                    ↩ Replying to {replyTo.sender?.full_name ?? 'message'}
                  </Text>
                  <Text size="xs" style={{ color: 'var(--nex-text-muted)' }} lineClamp={1}>
                    {replyTo.content}
                  </Text>
                </Box>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  style={{ color: 'var(--nex-text-muted)', marginTop: 2 }}
                  onClick={() => setReplyTo(null)}
                >
                  <IconX size={12} />
                </ActionIcon>
              </Group>
            )}

            {/* Recording state */}
            {isRecording ? (
              <Group py={14} gap={10}>
                <Box style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 8px rgba(239,68,68,0.8)',
                  animation: 'pulse 1s infinite',
                }} />
                <Text style={{ color: '#f87171' }} size="sm" fw={500}>
                  Recording... {formatDuration(recordDuration)}
                </Text>
                <ActionIcon
                  variant="subtle"
                  style={{ color: 'var(--nex-text-muted)', marginLeft: 4 }}
                  onClick={stopRecording}
                >
                  <IconX size={14} />
                </ActionIcon>
                <ActionIcon
                  size={36}
                  onClick={stopRecording}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    borderRadius: 10,
                    marginLeft: 'auto',
                    boxShadow: '0 2px 10px rgba(239,68,68,0.4)',
                  }}
                >
                  <IconCheck size={16} color="#fff" />
                </ActionIcon>
              </Group>
            ) : (
              <Group py={12} gap={6} align="center">
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                  accept="image/*,video/*,.pdf,.doc,.docx,.zip"
                />

                <Tooltip label="Attach file" withArrow>
                  <ActionIcon
                    size={36}
                    variant="subtle"
                    style={{
                      color: uploading ? '#fbbf24' : 'var(--nex-text-muted)',
                      borderRadius: 10,
                      flexShrink: 0,
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                  >
                    <IconPaperclip size={18} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label="Voice message" withArrow>
                  <ActionIcon
                    size={36}
                    variant="subtle"
                    style={{ color: 'var(--nex-text-muted)', borderRadius: 10, flexShrink: 0 }}
                    onMouseDown={startRecording}
                  >
                    <IconMicrophone size={18} />
                  </ActionIcon>
                </Tooltip>

                <Popover opened={showEmojiPicker} onClose={() => setShowEmojiPicker(false)} position="top-start" withArrow>
                  <Popover.Target>
                    <Tooltip label="Emoji" withArrow>
                      <ActionIcon
                        size={36}
                        variant="subtle"
                        style={{ color: 'var(--nex-text-muted)', borderRadius: 10, flexShrink: 0 }}
                        onClick={() => setShowEmojiPicker(o => !o)}
                      >
                        <IconMoodSmile size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Popover.Target>
                  <Popover.Dropdown p={0} style={{ background: 'transparent', border: 'none' }}>
                    <EmojiPicker onSelect={e => { setMsgInput(i => i + e); setShowEmojiPicker(false) }} />
                  </Popover.Dropdown>
                </Popover>

                {/* Message input */}
                <Box style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    style={{
                      width: '100%',
                      background: 'var(--nex-input)',
                      border: '1px solid var(--nex-border)',
                      borderRadius: 24,
                      padding: '10px 18px',
                      color: 'var(--nex-text)',
                      fontSize: 14,
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'rgba(124,58,237,0.5)'
                      e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.08)'
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'var(--nex-border)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </Box>

                {/* Send button */}
                <ActionIcon
                  size={40}
                  onClick={handleSend}
                  disabled={!msgInput.trim() && !attachment}
                  style={{
                    background: (msgInput.trim() || attachment)
                      ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                      : 'var(--nex-border)',
                    borderRadius: '50%',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                    boxShadow: (msgInput.trim() || attachment)
                      ? '0 2px 12px rgba(124,58,237,0.5)'
                      : 'none',
                  }}
                >
                  <IconSend size={17} color={(msgInput.trim() || attachment) ? '#fff' : 'var(--nex-text-muted)'} />
                </ActionIcon>
              </Group>
            )}
          </Box>
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════
          NEW CHAT MODAL
      ══════════════════════════════════════════════════════ */}
      <Modal
        opened={newChatOpen}
        onClose={() => { setNewChatOpen(false); setNewChatRaw('') }}
        title={
          <Group gap={8}>
            <Box style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconMessage size={14} color="#fff" />
            </Box>
            <Text fw={700} size="md" style={{ color: 'var(--nex-text)' }}>New Message</Text>
          </Group>
        }
        centered
        size="sm"
        styles={{
          header: {
            background: 'var(--nex-surface)',
            borderBottom: '1px solid rgba(124,58,237,0.15)',
            paddingBottom: 12,
          },
          body: { background: 'var(--nex-surface)', padding: 0 },
          content: {
            background: 'var(--nex-surface)',
            border: '1px solid rgba(124,58,237,0.2)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          },
          close: { color: 'var(--nex-text-muted)' },
        }}
      >
        <Box p="md">
          {/* Search input */}
          <Box style={{ position: 'relative', marginBottom: 12 }}>
            <IconSearch
              size={14}
              style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--nex-text-muted)', zIndex: 1,
              }}
            />
            <input
              type="text"
              placeholder="Search people..."
              value={newChatRaw}
              onChange={e => setNewChatRaw(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                background: 'var(--nex-input)',
                border: '1px solid rgba(124,58,237,0.25)',
                borderRadius: 10,
                padding: '10px 12px 10px 34px',
                color: 'var(--nex-text)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.6)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(124,58,237,0.25)')}
            />
          </Box>

          {newChatQuery.length < 1 ? (
            <Center py="md">
              <Text style={{ color: 'var(--nex-text-muted)' }} size="sm">Type a name to search</Text>
            </Center>
          ) : newChatResults.length === 0 ? (
            <Center py="md">
              <Text style={{ color: 'var(--nex-text-muted)' }} size="sm">No users found</Text>
            </Center>
          ) : (
            <Stack gap={4}>
              {newChatResults.filter(u => u.id !== authUser?.id).map(user => (
                <Box
                  key={user.id}
                  onClick={() => !newChatLoading && startNewChat(user.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: 'transparent',
                    transition: 'background 0.15s',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.1)'
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.2)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
                  }}
                >
                  <Group gap={12}>
                    <Avatar
                      src={user.avatar_url}
                      radius="xl"
                      size={42}
                      style={{ border: '2px solid rgba(124,58,237,0.3)' }}
                    >
                      {getInitials(user.full_name)}
                    </Avatar>
                    <Stack gap={1} style={{ flex: 1 }}>
                      <Text fw={600} size="sm" style={{ color: 'var(--nex-text)' }}>{user.full_name}</Text>
                      <Text style={{ color: 'var(--nex-text-muted)' }} size="xs">@{user.username}</Text>
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
