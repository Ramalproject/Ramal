import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

const FOLLOWS_KEY = 'nexora_follows'
const COUNTS_KEY = 'nexora_follow_counts'

function _getLocalFollows(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FOLLOWS_KEY) ?? '[]')) } catch { return new Set() }
}
function _saveLocalFollows(s: Set<string>) {
  localStorage.setItem(FOLLOWS_KEY, JSON.stringify([...s]))
}
function _localFollowKey(a: string, b: string) { return `${a}:${b}` }

type CountCache = Record<string, { followers: number; following: number }>
function _getCounts(): CountCache {
  try { return JSON.parse(localStorage.getItem(COUNTS_KEY) ?? '{}') } catch { return {} }
}
function _saveCounts(c: CountCache) { localStorage.setItem(COUNTS_KEY, JSON.stringify(c)) }

// Merge localStorage counts with DB profile — reads both count cache AND follow relationships
function _applyLocalCounts(profile: Profile): Profile {
  const follows = _getLocalFollows()
  const counts = _getCounts()
  const c = counts[profile.id]
  // Count known followers/following directly from the follow relationship set
  const knownFollowers = [...follows].filter(k => k.endsWith(`:${profile.id}`)).length
  const knownFollowing = [...follows].filter(k => k.startsWith(`${profile.id}:`)).length
  return {
    ...profile,
    followers_count: Math.max(profile.followers_count, c?.followers ?? 0, knownFollowers),
    following_count: Math.max(profile.following_count, c?.following ?? 0, knownFollowing),
  }
}

export const profileService = {
  async getByUsername(username: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('username', username).single()
    if (error) return null
    return _applyLocalCounts(data as Profile)
  },

  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', id).single()
    if (error) return null
    return _applyLocalCounts(data as Profile)
  },

  async update(id: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
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
    // 1. Save follow state to localStorage
    const s = _getLocalFollows(); s.add(_localFollowKey(followerId, followingId)); _saveLocalFollows(s)
    // 2. Update local count cache immediately
    const counts = _getCounts()
    const target = counts[followingId] ?? { followers: 0, following: 0 }
    const actor  = counts[followerId]  ?? { followers: 0, following: 0 }
    counts[followingId] = { ...target, followers: target.followers + 1 }
    counts[followerId]  = { ...actor,  following: actor.following  + 1 }
    _saveCounts(counts)
    // 3. Try DB RPC (silently ignored if SQL hasn't been run yet)
    await supabase.rpc('follow_user', { p_follower_id: followerId, p_following_id: followingId }).then(() => {}, () => {})
  },

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const s = _getLocalFollows(); s.delete(_localFollowKey(followerId, followingId)); _saveLocalFollows(s)
    const counts = _getCounts()
    const target = counts[followingId] ?? { followers: 1, following: 0 }
    const actor  = counts[followerId]  ?? { followers: 0, following: 1 }
    counts[followingId] = { ...target, followers: Math.max(0, target.followers - 1) }
    counts[followerId]  = { ...actor,  following: Math.max(0, actor.following  - 1) }
    _saveCounts(counts)
    await supabase.rpc('unfollow_user', { p_follower_id: followerId, p_following_id: followingId }).then(() => {}, () => {})
  },

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_following', { p_follower_id: followerId, p_following_id: followingId })
    if (!error && data !== null) return data as boolean
    return _getLocalFollows().has(_localFollowKey(followerId, followingId))
  },

  async searchProfiles(query: string, limit = 10): Promise<Profile[]> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(limit)
    return ((data as Profile[]) ?? []).map(_applyLocalCounts)
  },

  async getTopCreators(limit = 6): Promise<Profile[]> {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('followers_count', { ascending: false })
      .limit(limit)
    return ((data as Profile[]) ?? []).map(_applyLocalCounts)
  }
}
