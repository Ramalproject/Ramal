import { supabase } from '../lib/supabase'
import type { Notification } from '../types'

export const notificationService = {
  async getAll(userId: string, limit = 30): Promise<Notification[]> {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data as Notification[]) ?? []
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    return count ?? 0
  },

  async create(payload: {
    user_id: string
    actor_id: string
    type: string
    title: string
    body: string
    link?: string
  }): Promise<void> {
    // Skip if notifying yourself
    if (payload.user_id === payload.actor_id) return
    await supabase.from('notifications').insert(payload)
  },

  async markRead(id: string): Promise<void> {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  },

  async markAllRead(userId: string): Promise<void> {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId)
  }
}
