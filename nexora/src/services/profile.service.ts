import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export const profileService = {
  async getByUsername(username: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single()
    if (error) return null
    return data as Profile
  },

  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data as Profile
  },

  async update(id: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Profile
  },

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `${userId}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  },

  async uploadCover(userId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `${userId}.${ext}`
    const { error } = await supabase.storage.from('covers').upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('covers').getPublicUrl(path)
    return data.publicUrl
  },

  async followUser(followerId: string, followingId: string): Promise<void> {
    await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId })
    await supabase.rpc('increment_followers', { user_id: followingId })
    await supabase.rpc('increment_following', { user_id: followerId })
  },

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await supabase.from('follows').delete().match({ follower_id: followerId, following_id: followingId })
    await supabase.rpc('decrement_followers', { user_id: followingId })
    await supabase.rpc('decrement_following', { user_id: followerId })
  },

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const { data } = await supabase
      .from('follows')
      .select('id')
      .match({ follower_id: followerId, following_id: followingId })
      .single()
    return !!data
  },

  async searchProfiles(query: string, limit = 10): Promise<Profile[]> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(limit)
    return (data as Profile[]) ?? []
  },

  async getTopCreators(limit = 6): Promise<Profile[]> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('followers_count', { ascending: false })
      .limit(limit)
    return (data as Profile[]) ?? []
  }
}
