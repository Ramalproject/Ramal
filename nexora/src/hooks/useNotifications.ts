import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { notificationService } from '../services/notification.service'
import { useAuthStore } from '../store/useAuthStore'
import { useNotificationStore } from '../store/useNotificationStore'
import { supabase } from '../lib/supabase'

export function useNotifications() {
  const authUser = useAuthStore(s => s.user)
  return useQuery({
    queryKey: ['notifications', authUser?.id],
    queryFn: () => notificationService.getAll(authUser!.id),
    enabled: !!authUser?.id,
    staleTime: 1000 * 30,
  })
}

export function useNotificationCount() {
  const authUser = useAuthStore(s => s.user)
  const setUnreadCount = useNotificationStore(s => s.setUnreadCount)
  const instanceId = useMemo(() => Math.random().toString(36).slice(2), [])

  useEffect(() => {
    if (!authUser?.id) return
    notificationService.getUnreadCount(authUser.id).then(setUnreadCount)

    const channel = supabase
      .channel(`notifications:${authUser.id}:${instanceId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${authUser.id}`
      }, () => {
        notificationService.getUnreadCount(authUser.id).then(setUnreadCount)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [authUser?.id, setUnreadCount])
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    }
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  const authUser = useAuthStore(s => s.user)
  const setUnreadCount = useNotificationStore(s => s.setUnreadCount)
  return useMutation({
    mutationFn: () => notificationService.markAllRead(authUser!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      setUnreadCount(0)
    }
  })
}
