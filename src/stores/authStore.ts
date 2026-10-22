import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  initialized: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  fetchProfile: (userId: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

let authListenerRegistered = false

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async (userId: string) => {
    const currentUser = get().user
    const fallbackProfile: Profile = {
      id: userId,
      email: currentUser?.email ?? '',
      full_name:
        (currentUser?.user_metadata?.full_name as string) ||
        (currentUser?.email ? currentUser.email.split('@')[0] : 'User'),
      role:
        (currentUser?.user_metadata?.role as 'administrator' | 'owner' | 'viewer') ||
        (currentUser?.email?.toLowerCase().includes('admin') ? 'administrator' : 'owner'),
      avatar_url: (currentUser?.user_metadata?.avatar_url as string) || null,
      created_at: currentUser?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // If not found in table (PGRST116), attempt to create profile record
        if (error.code === 'PGRST116') {
          try {
            const { data: inserted } = await supabase
              .from('profiles')
              .insert(fallbackProfile)
              .select('*')
              .single()
            if (inserted) {
              set({ profile: inserted })
              return
            }
          } catch {
            // ignore insert failure if table doesn't exist
          }
        }
        // Fall back to memory profile so UI never breaks
        set({ profile: fallbackProfile })
        return
      }

      set({ profile: data })
    } catch (err) {
      console.warn('fetchProfile using fallback profile:', err)
      set({ profile: fallbackProfile })
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Sign out error:', err)
    } finally {
      set({ user: null, profile: null, session: null })
    }
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({ user: session.user, session })
        await get().fetchProfile(session.user.id)
      } else {
        set({ user: null, session: null, profile: null })
      }
    } catch (err) {
      console.error('initialize error:', err)
    } finally {
      set({ loading: false, initialized: true })
    }

    // Register auth listener once
    if (!authListenerRegistered) {
      authListenerRegistered = true
      supabase.auth.onAuthStateChange(async (_event, session) => {
        set({ session, user: session?.user ?? null })
        if (session?.user) {
          await get().fetchProfile(session.user.id)
        } else {
          set({ profile: null })
        }
      })
    }
  },
}))
