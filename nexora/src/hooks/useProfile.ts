import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileService } from '../services/profile.service'
import { useAuthStore } from '../store/useAuthStore'

export function useProfile(userId: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileService.getById(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useProfileByUsername(username: string) {
  return useQuery({
    queryKey: ['profile', 'username', username],
    queryFn: () => profileService.getByUsername(username),
    enabled: !!username,
    staleTime: 1000 * 60 * 5,
  })
}

export function useIsFollowing(targetUserId: string) {
  const authUser = useAuthStore(s => s.user)
  return useQuery({
    queryKey: ['isFollowing', authUser?.id, targetUserId],
    queryFn: () => profileService.isFollowing(authUser!.id, targetUserId),
    enabled: !!authUser?.id && !!targetUserId && authUser.id !== targetUserId,
    staleTime: 1000 * 60,
  })
}

export function useFollowUser() {
  const qc = useQueryClient()
  const authUser = useAuthStore(s => s.user)
  return useMutation({
    mutationFn: ({ followingId }: { followingId: string }) =>
      profileService.followUser(authUser!.id, followingId),
    onSuccess: (_, { followingId }) => {
      qc.invalidateQueries({ queryKey: ['isFollowing', authUser?.id, followingId] })
      qc.invalidateQueries({ queryKey: ['profile', followingId] })
    }
  })
}

export function useUnfollowUser() {
  const qc = useQueryClient()
  const authUser = useAuthStore(s => s.user)
  return useMutation({
    mutationFn: ({ followingId }: { followingId: string }) =>
      profileService.unfollowUser(authUser!.id, followingId),
    onSuccess: (_, { followingId }) => {
      qc.invalidateQueries({ queryKey: ['isFollowing', authUser?.id, followingId] })
      qc.invalidateQueries({ queryKey: ['profile', followingId] })
    }
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const authUser = useAuthStore(s => s.user)
  const setProfile = useAuthStore(s => s.setProfile)
  return useMutation({
    mutationFn: (updates: Parameters<typeof profileService.update>[1]) =>
      profileService.update(authUser!.id, updates),
    onSuccess: (profile) => {
      setProfile(profile)
      qc.invalidateQueries({ queryKey: ['profile', authUser?.id] })
    }
  })
}

export function useSearchProfiles(query: string) {
  return useQuery({
    queryKey: ['profiles', 'search', query],
    queryFn: () => profileService.searchProfiles(query),
    enabled: query.length >= 2,
    staleTime: 1000 * 30,
  })
}

export function useTopCreators() {
  return useQuery({
    queryKey: ['profiles', 'top-creators'],
    queryFn: () => profileService.getTopCreators(6),
    staleTime: 1000 * 60 * 5,
  })
}
