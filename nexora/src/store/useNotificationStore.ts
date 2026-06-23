import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface NotificationState {
  unreadCount: number
}

interface NotificationActions {
  setUnreadCount: (count: number) => void
  incrementUnreadCount: () => void
  resetUnreadCount: () => void
}

type NotificationStore = NotificationState & NotificationActions

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    (set) => ({
      // State
      unreadCount: 0,

      // Actions
      setUnreadCount: (count) => {
        set({ unreadCount: count }, false, 'notifications/setUnreadCount')
      },

      incrementUnreadCount: () => {
        set(
          (state) => ({ unreadCount: state.unreadCount + 1 }),
          false,
          'notifications/increment',
        )
      },

      resetUnreadCount: () => {
        set({ unreadCount: 0 }, false, 'notifications/reset')
      },
    }),
    { name: 'nexora/notifications' },
  ),
)

export default useNotificationStore
