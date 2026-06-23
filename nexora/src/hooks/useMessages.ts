import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useMemo } from 'react'
import { notifications } from '@mantine/notifications'
import { messageService } from '../services/message.service'
import { useAuthStore } from '../store/useAuthStore'
import { supabase } from '../lib/supabase'
import type { Message } from '../types'

export function useRooms() {
  const authUser = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const instanceId = useMemo(() => Math.random().toString(36).slice(2), [])

  useEffect(() => {
    if (!authUser?.id) return
    const channel = supabase
      .channel(`room-participants-${authUser.id}-${instanceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_participants',
        filter: `user_id=eq.${authUser.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['rooms', authUser.id] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authUser?.id, qc])

  return useQuery({
    queryKey: ['rooms', authUser?.id],
    queryFn: () => messageService.getRooms(authUser!.id),
    enabled: !!authUser?.id,
    staleTime: 0,
  })
}

// Reads from the shared React Query cache without creating its own realtime subscription.
// Safe to call from Sidebar alongside MessagesPage (which has useRooms with a subscription).
export function useTotalUnreadMessages() {
  const authUser = useAuthStore(s => s.user)
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', authUser?.id],
    queryFn: () => messageService.getRooms(authUser!.id),
    enabled: !!authUser?.id,
    staleTime: 0,
  })
  return rooms.reduce((sum, r) => sum + (r.unread_count ?? 0), 0)
}

export function useMessages(roomId: string) {
  return useQuery({
    queryKey: ['messages', roomId],
    queryFn: () => messageService.getMessages(roomId),
    enabled: !!roomId,
    staleTime: 0,
  })
}

export function useRealtimeMessages(roomId: string) {
  const qc = useQueryClient()
  const subRef = useRef<ReturnType<typeof messageService.subscribeToRoom> | null>(null)

  useEffect(() => {
    if (!roomId) return
    subRef.current = messageService.subscribeToRoom(roomId, (newMsg: Message) => {
      qc.setQueryData(['messages', roomId], (old: Message[] | undefined) => {
        if (!old) return [newMsg]
        const exists = old.some(m => m.id === newMsg.id)
        return exists ? old : [...old, newMsg]
      })
      qc.invalidateQueries({ queryKey: ['rooms'] })
    })
    return () => {
      subRef.current?.unsubscribe()
    }
  }, [roomId, qc])
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: messageService.sendMessage,
    onSuccess: (msg) => {
      qc.setQueryData(['messages', msg.room_id], (old: Message[] | undefined) => {
        if (!old) return [msg]
        const exists = old.some(m => m.id === msg.id)
        return exists ? old : [...old, msg]
      })
      qc.invalidateQueries({ queryKey: ['rooms'] })
    },
    onError: (err: any) => {
      const detail = err?.message ?? err?.error_description ?? JSON.stringify(err)
      notifications.show({ title: 'Send failed', message: detail, color: 'red', autoClose: 10000 })
    }
  })
}

export function useDeleteMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, roomId: _roomId }: { messageId: string; roomId: string }) =>
      messageService.deleteMessage(messageId),
    onSuccess: (_, { roomId }) => {
      qc.invalidateQueries({ queryKey: ['messages', roomId] })
    }
  })
}

export function usePinMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, roomId: _roomId }: { messageId: string; roomId: string }) =>
      messageService.pinMessage(messageId),
    onSuccess: (_, { roomId }) => {
      qc.invalidateQueries({ queryKey: ['messages', roomId] })
      qc.invalidateQueries({ queryKey: ['pinned', roomId] })
    }
  })
}

export function useAddReaction() {
  const qc = useQueryClient()
  const authUser = useAuthStore(s => s.user)
  return useMutation({
    mutationFn: ({ messageId, emoji, roomId: _roomId }: { messageId: string; emoji: string; roomId: string }) =>
      messageService.addReaction(messageId, authUser!.id, emoji),
    onSuccess: (_, { roomId }) => {
      qc.invalidateQueries({ queryKey: ['messages', roomId] })
    }
  })
}

export function usePinnedMessages(roomId: string) {
  return useQuery({
    queryKey: ['pinned', roomId],
    queryFn: () => messageService.getPinnedMessages(roomId),
    enabled: !!roomId,
    staleTime: 1000 * 60,
  })
}

export function useMarkRead() {
  return useMutation({
    mutationFn: ({ roomId, userId }: { roomId: string; userId: string }) =>
      messageService.markRead(roomId, userId),
  })
}
