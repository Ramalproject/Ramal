import { supabase } from '../lib/supabase'
import type { Comment } from '../types'

export const commentService = {
  async getByPost(postId: string): Promise<Comment[]> {
    const { data } = await supabase
      .from('comments')
      .select('*, author:profiles!user_id(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(50)
    return (data as Comment[]) ?? []
  },

  async create(postId: string, userId: string, content: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: userId, content })
      .select('*, author:profiles!user_id(*)')
      .single()
    if (error) throw error
    // bump comments_count
    await supabase.rpc('increment', { table_name: 'posts', id: postId, column_name: 'comments_count' })
      .then(() => {}, () => {
        supabase.from('posts').select('comments_count').eq('id', postId).single().then(({ data: p }) => {
          supabase.from('posts').update({ comments_count: (p?.comments_count ?? 0) + 1 }).eq('id', postId)
        })
      })
    return data as Comment
  },

  async delete(commentId: string, postId: string): Promise<void> {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) throw error
    const { data: p } = await supabase.from('posts').select('comments_count').eq('id', postId).single()
    await supabase.from('posts').update({ comments_count: Math.max(0, (p?.comments_count ?? 1) - 1) }).eq('id', postId)
  }
}
