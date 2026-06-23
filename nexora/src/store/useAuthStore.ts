import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
}

interface AuthActions {
  setUser: (user: User | null) => Promise<void>
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set, get) => ({
      // State
      user: null,
      profile: null,
      loading: true,

      // Actions
      setLoading: (loading) => {
        set({ loading }, false, 'auth/setLoading')
      },

      setProfile: (profile) => {
        set({ profile }, false, 'auth/setProfile')
      },

      setUser: async (user) => {
        set({ user }, false, 'auth/setUser')

        if (!user) {
          set({ profile: null }, false, 'auth/clearProfile')
          return
        }

        // Fetch profile from Supabase whenever user changes
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (error) {
            console.error('[AuthStore] Failed to fetch profile:', error.message)
            get().setProfile(null)
            return
          }

          get().setProfile(data as Profile)
        } catch (err) {
          console.error('[AuthStore] Unexpected error fetching profile:', err)
          get().setProfile(null)
        }
      },

      signOut: async () => {
        try {
          set({ loading: true }, false, 'auth/signOut/start')
          const { error } = await supabase.auth.signOut()
          if (error) {
            console.error('[AuthStore] Sign-out error:', error.message)
          }
        } catch (err) {
          console.error('[AuthStore] Unexpected sign-out error:', err)
        } finally {
          set({ user: null, profile: null, loading: false }, false, 'auth/signOut/complete')
        }
      },
    }),
    { name: 'nexora/auth' },
  ),
)

export default useAuthStore
