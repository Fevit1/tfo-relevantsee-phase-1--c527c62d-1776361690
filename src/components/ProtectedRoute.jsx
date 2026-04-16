'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

/**
 * ProtectedRoute
 *
 * Client-side route guard component. Wraps page content that requires
 * authentication and/or a specific role.
 *
 * Note: Middleware handles the primary server-side redirect. This component
 * is a secondary client-side guard for dynamic role checks within authenticated
 * routes (e.g. admin-only sections within a page).
 *
 * Props:
 *   allowedRoles: string[] — e.g. ['admin'] or ['admin', 'editor']
 *                 If omitted, any authenticated user is allowed.
 *   redirectTo: string — path to redirect unauthorized users (default: '/dashboard')
 *   children: React node
 *   fallback: React node — shown while loading (optional)
 */
export function ProtectedRoute({
  allowedRoles,
  redirectTo = '/dashboard',
  children,
  fallback = null,
}) {
  const { user, dbUser, loading, role } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    // Not authenticated
    if (!user) {
      router.replace('/login')
      return
    }

    // DB user not yet loaded but auth user exists — wait
    if (!dbUser) return

    // Role check
    if (allowedRoles && !allowedRoles.includes(role)) {
      router.replace(redirectTo)
    }
  }, [user, dbUser, loading, role, allowedRoles, redirectTo, router])

  if (loading) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center bg-gray-950">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        </div>
      )
    )
  }

  if (!user) return null

  if (allowedRoles && !allowedRoles.includes(role)) return null

  return <>{children}</>
}

/**
 * AdminOnly
 * Convenience wrapper — renders children only for admin role.
 * Non-admins see nothing (or optional fallback).
 */
export function AdminOnly({ children, fallback = null }) {
  const { role, loading } = useAuth()

  if (loading) return null
  if (role !== 'admin') return fallback
  return <>{children}</>
}

/**
 * EditorOrAdmin
 * Convenience wrapper — renders children for admin or editor roles.
 */
export function EditorOrAdmin({ children, fallback = null }) {
  const { role, loading } = useAuth()

  if (loading) return null
  if (!['admin', 'editor'].includes(role)) return fallback
  return <>{children}</>
}

export default ProtectedRoute