import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commentService } from '../services/comment.service'
import { useAuthStore } from '../store/useAuthStore'

export function useComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: () => commentService.getByPost(postId),
    enabled: enabled && !!postId,
    staleTime: 1000 * 30,
  })
}

export function useAddComment(postId: string) {
  const qc = useQueryClient()
  const authUser = useAuthStore(s => s.user)
  return useMutation({
    mutationFn: (content: string) => commentService.create(postId, authUser!.id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] })
      qc.invalidateQueries({ queryKey: ['posts'] })
    }
  })
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => commentService.delete(commentId, postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] })
      qc.invalidateQueries({ queryKey: ['posts'] })
    }
  })
}
