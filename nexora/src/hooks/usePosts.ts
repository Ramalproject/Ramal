import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { postService } from '../services/post.service'
import { useAuthStore } from '../store/useAuthStore'

export function useFeed() {
  const authUser = useAuthStore(s => s.user)
  return useQuery({
    queryKey: ['posts', 'feed', authUser?.id],
    queryFn: () => postService.getFeed(authUser!.id),
    enabled: !!authUser?.id,
    staleTime: 1000 * 30,
  })
}

export function useUserPosts(authorId: string) {
  return useQuery({
    queryKey: ['posts', 'user', authorId],
    queryFn: () => postService.getByUser(authorId),
    enabled: !!authorId,
    staleTime: 1000 * 60,
  })
}

export function useTrendingPosts() {
  return useQuery({
    queryKey: ['posts', 'trending'],
    queryFn: () => postService.getTrending(20),
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreatePost() {
  const qc = useQueryClient()
  const authUser = useAuthStore(s => s.user)
  return useMutation({
    mutationFn: (payload: { content: string; media_urls?: string[]; post_type?: string; visibility?: string }) =>
      postService.create({ ...payload, author_id: authUser!.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
    }
  })
}

export function useLikePost() {
  const qc = useQueryClient()
  const authUser = useAuthStore(s => s.user)
  return useMutation({
    mutationFn: (postId: string) => postService.likePost(postId, authUser!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
    }
  })
}

export function useUnlikePost() {
  const qc = useQueryClient()
  const authUser = useAuthStore(s => s.user)
  return useMutation({
    mutationFn: (postId: string) => postService.unlikePost(postId, authUser!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
    }
  })
}

export function useDeletePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => postService.delete(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
    }
  })
}

export function useEditPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) =>
      postService.update(postId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] })
  })
}

export function useSearchPosts(query: string) {
  return useQuery({
    queryKey: ['posts', 'search', query],
    queryFn: () => postService.search(query),
    enabled: query.length >= 2,
    staleTime: 1000 * 30,
  })
}
