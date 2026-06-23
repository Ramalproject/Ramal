import { supabase } from '../lib/supabase'
import type { Message, Room, Profile } from '../types'

export const messageService = {
  async getRooms(userId: string): Promise<Room[]> {
    let myRows: { room_id: string; last_read_at: string }[]
    let lastReadMap: Record<string, string> = {}

    // Step 1a: SECURITY DEFINER RPC — fully bypasses RLS (available after running the Settings→Database SQL)
    const { data: rpcRows, error: rpcErr } = await supabase
      .rpc('get_my_rooms', { p_user_id: userId })

    if (!rpcErr && rpcRows?.length) {
      myRows = rpcRows as { room_id: string; last_read_at: string }[]
      lastReadMap = Object.fromEntries(myRows.map(r => [r.room_id, r.last_read_at ?? new Date(0).toISOString()]))
    } else {
      // Step 1b: Direct query (may fail silently due to RLS recursion bug)
      const { data: participantRows } = await supabase
        .from('room_participants')
        .select('room_id, last_read_at')
        .eq('user_id', userId)

      if (participantRows?.length) {
        myRows = participantRows
        lastReadMap = Object.fromEntries(participantRows.map(r => [r.room_id, r.last_read_at ?? new Date(0).toISOString()]))
      } else {
        // Step 1c: Last resort — find rooms via messages this user sent
        const { data: sentMsgs } = await supabase
          .from('messages')
          .select('room_id')
          .eq('sender_id', userId)
          .eq('is_deleted', false)
          .limit(100)

        if (!sentMsgs?.length) return []
        const uniqueRoomIds = [...new Set(sentMsgs.map(m => m.room_id))]
        myRows = uniqueRoomIds.map(id => ({ room_id: id, last_read_at: new Date(0).toISOString() }))
      }
    }

    const roomIds = myRows.map(p => p.room_id)

    // Step 2: other participants in those rooms
    const { data: participantOtherRows } = await supabase
      .from('room_participants')
      .select('room_id, user_id')
      .in('room_id', roomIds)
      .neq('user_id', userId)

    let otherRows: { room_id: string; user_id: string }[]

    if (participantOtherRows?.length) {
      otherRows = participantOtherRows
    } else {
      // Fallback: find other users via messages in those rooms
      const { data: receivedMsgs } = await supabase
        .from('messages')
        .select('room_id, sender_id')
        .in('room_id', roomIds)
        .neq('sender_id', userId)
        .eq('is_deleted', false)
        .limit(200)

      if (receivedMsgs?.length) {
        const seen = new Set<string>()
        otherRows = receivedMsgs
          .filter(m => {
            const key = `${m.room_id}:${m.sender_id}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          .map(m => ({ room_id: m.room_id, user_id: m.sender_id }))
      } else {
        otherRows = []
      }
    }

    // Step 3: profiles for those participants
    const otherIds = [...new Set(otherRows.map(r => r.user_id))]
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, plan')
      .in('id', otherIds)

    const profileMap: Record<string, Profile> = Object.fromEntries(
      (profileRows ?? []).map(p => [p.id, p as Profile])
    )

    // Step 4: room timestamps (best-effort — if message_rooms RLS blocks, fall back to roomIds)
    const { data: roomsData } = await supabase
      .from('message_rooms')
      .select('id, created_at, updated_at')
      .in('id', roomIds)
      .order('updated_at', { ascending: false })

    // Use roomsData if available, otherwise build stubs from known roomIds
    const orderedIds = roomsData?.length ? roomsData.map(r => r.id) : roomIds
    const tsMap = Object.fromEntries(
      (roomsData ?? []).map(r => [r.id, { created_at: r.created_at, updated_at: r.updated_at }])
    )

    // Step 5: enrich each room
    const enriched = await Promise.all(orderedIds.map(async roomId => {
      const ts = tsMap[roomId] ?? { created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      const lastReadAt = lastReadMap[roomId] ?? new Date(0).toISOString()

      const participants = otherRows
        .filter(r => r.room_id === roomId)
        .map(r => profileMap[r.user_id])
        .filter(Boolean) as Profile[]

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(*)')
        .eq('room_id', roomId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { count: unread } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .neq('sender_id', userId)
        .gt('created_at', lastReadAt)
        .eq('is_deleted', false)

      return {
        id: roomId,
        created_at: ts.created_at,
        updated_at: ts.updated_at,
        participants,
        last_message: lastMsg as Message | undefined,
        unread_count: unread ?? 0,
      } as Room
    }))

    return enriched
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
    const { data, error } = await supabase
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

    if (error) throw error
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
        room_id: payload.room_id,
        sender_id: payload.sender_id,
        content: payload.content,
        message_type: payload.message_type ?? 'text',
        reply_to_id: payload.reply_to_id ?? null,
        attachment_url: payload.attachment_url ?? null,
        attachment_name: payload.attachment_name ?? null,
        attachment_type: payload.attachment_type ?? null,
        duration: payload.duration ?? null,
        is_deleted: false,
      })
      .select(`*, sender:profiles!sender_id(*), reply_to:messages!reply_to_id(*, sender:profiles!sender_id(*)), reactions:message_reactions(*)`)
      .single()
    if (error) throw error
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
