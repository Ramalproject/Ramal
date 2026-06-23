import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

const FOLLOWS_KEY = 'nexora_follows'

function _getLocalFollows(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FOLLOWS_KEY) ?? '[]')) } catch { return new Set() }
}
function _saveLocalFollows(s: Set<string>) {
  localStorage.setItem(FOLLOWS_KEY, JSON.stringify([...s]))
}
function _localFollowKey(a: string, b: string) { return `${a}:${b}` }

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
    const s = _getLocalFollows(); s.add(_localFollowKey(followerId, followingId)); _saveLocalFollows(s)
    // SECURITY DEFINER RPC bypasses RLS — updates both users' counts in DB permanently
    await supabase.rpc('follow_user', { p_follower_id: followerId, p_following_id: followingId })
  },

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const s = _getLocalFollows(); s.delete(_localFollowKey(followerId, followingId)); _saveLocalFollows(s)
    await supabase.rpc('unfollow_user', { p_follower_id: followerId, p_following_id: followingId })
  },

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_following', { p_follower_id: followerId, p_following_id: followingId })
    if (!error && data !== null) return data as boolean
    // Fallback to localStorage if RPC not available yet
    return _getLocalFollows().has(_localFollowKey(followerId, followingId))
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
