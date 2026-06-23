import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileService } from '../services/profile.service'
import { notificationService } from '../services/notification.service'
import { useAuthStore } from '../store/useAuthStore'
import type { Profile } from '../types'

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
  const authProfile = useAuthStore(s => s.profile)
  return useMutation({
    mutationFn: ({ followingId }: { followingId: string }) =>
      profileService.followUser(authUser!.id, followingId),
    onSuccess: (_, { followingId }) => {
      notificationService.create({
        user_id: followingId,
        actor_id: authUser!.id,
        type: 'follow',
        title: 'New follower',
        body: `${authProfile?.full_name ?? 'Someone'} started following you`,
        link: authProfile?.username ? `/profile/${authProfile.username}` : undefined,
      }).catch(() => {})
      qc.setQueryData(['isFollowing', authUser?.id, followingId], true)
      // Optimistically update follower/following counts in every cached profile
      // (RLS blocks updating other users' rows in DB, so we update the cache directly)
      qc.setQueriesData<Profile | null>(
        { queryKey: ['profile'], exact: false },
        (old) => {
          if (!old) return old
          if (old.id === followingId) return { ...old, followers_count: old.followers_count + 1 }
          if (old.id === authUser?.id) return { ...old, following_count: old.following_count + 1 }
          return old
        }
      )
      qc.setQueriesData<Profile[]>(
        { queryKey: ['profiles', 'top-creators'] },
        (old) => old?.map(p => p.id === followingId ? { ...p, followers_count: p.followers_count + 1 } : p)
      )
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
      qc.setQueryData(['isFollowing', authUser?.id, followingId], false)
      qc.setQueriesData<Profile | null>(
        { queryKey: ['profile'], exact: false },
        (old) => {
          if (!old) return old
          if (old.id === followingId) return { ...old, followers_count: Math.max(0, old.followers_count - 1) }
          if (old.id === authUser?.id) return { ...old, following_count: Math.max(0, old.following_count - 1) }
          return old
        }
      )
      qc.setQueriesData<Profile[]>(
        { queryKey: ['profiles', 'top-creators'] },
        (old) => old?.map(p => p.id === followingId ? { ...p, followers_count: Math.max(0, p.followers_count - 1) } : p)
      )
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
    enabled: query.length >= 1,
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
