'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const AuthContext = createContext(null)

/**
 * AuthProvider
 *
 * Provides auth state (session, user, dbUser, role, loading) to the entire app.
 * Wraps the root layout. Handles Supabase auth state changes reactively.
 *
 * dbUser is always fetched from the `users` table — never from JWT claims.
 */
export function AuthProvider({ children }) {
  const [supabase] = useState(() => createClient())
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [dbUser, setDbUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDbUser = useCallback(
    async (authUser) => {
      if (!authUser) {
        setDbUser(null)
        return
      }
      try {
        const { data, error: dbError } = await supabase
          .from('users')
          .select('id, account_id, role, full_name, email')
          .eq('id', authUser.id)
          .single()

        if (dbError) {
          console.error('[AuthProvider] DB user fetch error:', dbError.message)
          setDbUser(null)
        } else {
          setDbUser(data)
        }
      } catch (err) {
        console.error('[AuthProvider] Unexpected error fetching DB user:', err)
        setDbUser(null)
      }
    },
    [supabase]
  )

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession()

        if (!mounted) return

        setSession(initialSession)
        setUser(initialSession?.user ?? null)
        await fetchDbUser(initialSession?.user ?? null)
      } catch (err) {
        if (mounted) {
          setError(err.message)
          console.error('[AuthProvider] Initialization error:', err)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initialize()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      setSession(newSession)
      setUser(newSession?.user ?? null)
      setLoading(true)

      await fetchDbUser(newSession?.user ?? null)

      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchDbUser])

  const signOut = useCallback(async () => {
    setLoading(true)
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      console.error('[AuthProvider] Sign out error:', signOutError.message)
    }
    setSession(null)
    setUser(null)
    setDbUser(null)
    setLoading(false)
  }, [supabase])

  const value = {
    supabase,
    session,
    user,
    dbUser,
    role: dbUser?.role ?? null,
    accountId: dbUser?.account_id ?? null,
    userId: dbUser?.id ?? null,
    loading,
    error,
    signOut,
    isAdmin: dbUser?.role === 'admin',
    isEditor: dbUser?.role === 'editor',
    isViewer: dbUser?.role === 'viewer',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * useAuth
 * Primary hook for consuming auth state throughout the app.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthProvider