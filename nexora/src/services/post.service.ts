import { supabase } from '../lib/supabase'
import type { Post } from '../types'

export const postService = {
  async getFeed(userId: string, page = 0, limit = 20): Promise<Post[]> {
    const { data } = await supabase
      .from('posts')
      .select(`*, author:profiles!author_id(*)`)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1)
    if (!data) return []
    const postIds = data.map(p => p.id)
    const { data: likes } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds)
    const likedSet = new Set(likes?.map(l => l.post_id) ?? [])
    return data.map(p => ({ ...p, liked_by_me: likedSet.has(p.id) })) as Post[]
  },

  async getByUser(authorId: string, page = 0, limit = 20): Promise<Post[]> {
    const { data } = await supabase
      .from('posts')
      .select(`*, author:profiles!author_id(*)`)
      .eq('author_id', authorId)
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1)
    return (data as Post[]) ?? []
  },

  async getTrending(limit = 20): Promise<Post[]> {
    const { data } = await supabase
      .from('posts')
      .select(`*, author:profiles!author_id(*)`)
      .eq('visibility', 'public')
      .order('likes_count', { ascending: false })
      .limit(limit)
    return (data as Post[]) ?? []
  },

  async create(payload: {
    author_id: string; content: string; media_urls?: string[]
    post_type?: string; visibility?: string
  }): Promise<Post> {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        ...payload,
        post_type: payload.post_type ?? 'text',
        visibility: payload.visibility ?? 'public',
        likes_count: 0, comments_count: 0, shares_count: 0,
        media_urls: payload.media_urls ?? []
      })
      .select(`*, author:profiles!author_id(*)`)
      .single()
    if (error) throw error
    return data as Post
  },

  async delete(postId: string): Promise<void> {
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) throw error
  },

  async likePost(postId: string, userId: string): Promise<void> {
    await supabase.from('likes').insert({ post_id: postId, user_id: userId })
    await supabase.rpc('increment_likes', { post_id: postId })
  },

  async unlikePost(postId: string, userId: string): Promise<void> {
    await supabase.from('likes').delete().match({ post_id: postId, user_id: userId })
    await supabase.rpc('decrement_likes', { post_id: postId })
  },

  async search(query: string, limit = 20): Promise<Post[]> {
    const { data } = await supabase
      .from('posts')
      .select(`*, author:profiles!author_id(*)`)
      .ilike('content', `%${query}%`)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data as Post[]) ?? []
  },

  async uploadMedia(userId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('posts').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('posts').getPublicUrl(path)
    return data.publicUrl
  }
}
