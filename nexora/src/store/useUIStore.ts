import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

type ColorScheme = 'dark' | 'light'

interface UIState {
  sidebarOpen: boolean
  notificationsOpen: boolean
  colorScheme: ColorScheme
}

interface UIActions {
  setSidebarOpen: (open: boolean) => void
  setNotificationsOpen: (open: boolean) => void
  toggleColorScheme: () => void
}

type UIStore = UIState & UIActions

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set) => ({
        // State
        sidebarOpen: true,
        notificationsOpen: false,
        colorScheme: 'dark' as ColorScheme,

        // Actions
        setSidebarOpen: (open) => {
          set({ sidebarOpen: open }, false, 'ui/setSidebarOpen')
        },

        setNotificationsOpen: (open) => {
          set({ notificationsOpen: open }, false, 'ui/setNotificationsOpen')
        },

        toggleColorScheme: () => {
          set(
            (state) => ({
              colorScheme: state.colorScheme === 'dark' ? 'light' : 'dark',
            }),
            false,
            'ui/toggleColorScheme',
          )
        },
      }),
      {
        name: 'nexora-ui-store',
        // Only persist colorScheme and sidebarOpen — not transient UI state
        partialize: (state) => ({
          colorScheme: state.colorScheme,
          sidebarOpen: state.sidebarOpen,
        }),
      },
    ),
    { name: 'nexora/ui' },
  ),
)

export default useUIStore
