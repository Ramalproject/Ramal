import { supabase } from '../lib/supabase'
import type { Comment } from '../types'

export const commentService = {
  async getByPost(postId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(50)
    if (error || !data?.length) return []

    // Fetch author profiles separately — avoids needing FK constraints
    const userIds = [...new Set(data.map((c: { user_id: string }) => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', userIds)

    const profileMap = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]))
    return data.map((c: { user_id: string }) => ({
      ...c,
      author: profileMap.get(c.user_id) ?? undefined,
    })) as Comment[]
  },

  async create(postId: string, userId: string, content: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: userId, content })
      .select('*')
      .single()
    if (error) throw error

    // Bump comments_count directly
    const { data: post } = await supabase
      .from('posts')
      .select('comments_count')
      .eq('id', postId)
      .single()
    await supabase
      .from('posts')
      .update({ comments_count: (post?.comments_count ?? 0) + 1 })
      .eq('id', postId)

    // Fetch author separately
    const { data: author } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .eq('id', userId)
      .single()

    return { ...data, author: author ?? undefined } as Comment
  },

  async delete(commentId: string, postId: string): Promise<void> {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) throw error
    const { data: post } = await supabase
      .from('posts')
      .select('comments_count')
      .eq('id', postId)
      .single()
    await supabase
      .from('posts')
      .update({ comments_count: Math.max(0, (post?.comments_count ?? 1) - 1) })
      .eq('id', postId)
  },
}
