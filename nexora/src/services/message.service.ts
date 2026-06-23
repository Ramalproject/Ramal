import { supabase } from '../lib/supabase'
import type { Message, Room, Profile } from '../types'

export const messageService = {
  async getRooms(userId: string): Promise<Room[]> {
    const { data: participantRows } = await supabase
      .from('room_participants')
      .select('room_id, last_read_at')
      .eq('user_id', userId)

    if (!participantRows?.length) return []

    const roomIds = participantRows.map(p => p.room_id)

    const { data: rooms } = await supabase
      .from('message_rooms')
      .select(`
        id, created_at, updated_at,
        room_participants!inner(user_id, last_read_at, profiles!inner(*))
      `)
      .in('id', roomIds)
      .order('updated_at', { ascending: false })

    if (!rooms) return []

    const enrichedRooms = await Promise.all(rooms.map(async (room) => {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select(`*, sender:profiles!sender_id(*)`)
        .eq('room_id', room.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const userParticipant = participantRows.find(p => p.room_id === room.id)
      const lastReadAt = userParticipant?.last_read_at ?? new Date(0).toISOString()

      const { count: unread } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', room.id)
        .neq('sender_id', userId)
        .gt('created_at', lastReadAt)
        .eq('is_deleted', false)

      const participants = (room as any).room_participants
        ?.map((rp: any) => rp.profiles)
        .filter((p: any) => p && p.id !== userId) as Profile[]

      return {
        id: room.id,
        created_at: room.created_at,
        updated_at: room.updated_at,
        participants,
        last_message: lastMsg as Message | undefined,
        unread_count: unread ?? 0,
      } as Room
    }))

    return enrichedRooms
  },

  async getOrCreateRoom(userId1: string, userId2: string): Promise<string> {
    // Single SECURITY DEFINER RPC — bypasses all RLS, creates room + participants atomically
    const { data, error } = await supabase.rpc('create_dm_room', {
      user1: userId1, user2: userId2
    })
    if (error) throw error
    return data as string
  },

  async getMessages(roomId: string, page = 0, limit = 50): Promise<Message[]> {
    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(*),
        reply_to:messages!reply_to_id(*, sender:profiles!sender_id(*)),
        reactions:message_reactions(*, user:profiles!user_id(*))
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1)

    const messages = (data as Message[]) ?? []
    return messages.reverse()
  },

  async sendMessage(payload: {
    room_id: string; sender_id: string; content: string
    message_type?: string; reply_to_id?: string
    attachment_url?: string; attachment_name?: string; attachment_type?: string
    duration?: number
  }): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        ...payload,
        message_type: payload.message_type ?? 'text',
        is_deleted: false,
      })
      .select(`*, sender:profiles!sender_id(*), reply_to:messages!reply_to_id(*, sender:profiles!sender_id(*)), reactions:message_reactions(*, user:profiles!user_id(*))`)
      .single()
    if (error) throw error

    await supabase
      .from('message_rooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', payload.room_id)

    return data as Message
  },

  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true, deleted_at: new Date().toISOString(), content: 'This message was deleted' })
      .eq('id', messageId)
    if (error) throw error
  },

  async pinMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ pinned_at: new Date().toISOString() })
      .eq('id', messageId)
    if (error) throw error
  },

  async unpinMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ pinned_at: null })
      .eq('id', messageId)
    if (error) throw error
  },

  async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    await supabase
      .from('message_reactions')
      .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id' })
  },

  async removeReaction(messageId: string, userId: string): Promise<void> {
    await supabase
      .from('message_reactions')
      .delete()
      .match({ message_id: messageId, user_id: userId })
  },

  async markRead(roomId: string, userId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ last_read_at: new Date().toISOString() })
      .match({ room_id: roomId, user_id: userId })
  },

  async uploadAttachment(userId: string, file: File): Promise<{ url: string; name: string; type: string }> {
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('messages').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('messages').getPublicUrl(path)
    return { url: data.publicUrl, name: file.name, type: file.type }
  },

  subscribeToRoom(roomId: string, onMessage: (msg: Message) => void) {
    return supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`
      }, async (payload) => {
        const { data } = await supabase
          .from('messages')
          .select(`*, sender:profiles!sender_id(*), reply_to:messages!reply_to_id(*, sender:profiles!sender_id(*)), reactions:message_reactions(*)`)
          .eq('id', payload.new.id)
          .single()
        if (data) onMessage(data as Message)
      })
      .subscribe()
  },

  async getPinnedMessages(roomId: string): Promise<Message[]> {
    const { data } = await supabase
      .from('messages')
      .select(`*, sender:profiles!sender_id(*)`)
      .eq('room_id', roomId)
      .not('pinned_at', 'is', null)
      .eq('is_deleted', false)
      .order('pinned_at', { ascending: false })
    return (data as Message[]) ?? []
  },

  async searchMessages(roomId: string, query: string): Promise<Message[]> {
    const { data } = await supabase
      .from('messages')
      .select(`*, sender:profiles!sender_id(*)`)
      .eq('room_id', roomId)
      .ilike('content', `%${query}%`)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(20)
    return (data as Message[]) ?? []
  }
}
