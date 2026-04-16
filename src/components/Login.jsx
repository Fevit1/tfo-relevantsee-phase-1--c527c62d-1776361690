'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
})

const resetSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
})

/**
 * Login
 *
 * Email/password sign-in only — no self-signup (invite-only platform).
 * Handles forgot password via Supabase reset email.
 *
 * Designed for use at /login route.
 * On success, redirects to ?redirectTo param or /dashboard.
 */
export function Login() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const [mode, setMode] = useState('login') // 'login' | 'reset'
  const [authError, setAuthError] = useState(null)
  const [resetSent, setResetSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const resetForm = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  })

  const handleSignIn = async (values) => {
    setIsSubmitting(true)
    setAuthError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })

      if (error) {
        // Map Supabase error messages to user-friendly copy
        if (
          error.message.includes('Invalid login credentials') ||
          error.message.includes('invalid_credentials')
        ) {
          setAuthError('Incorrect email or password. Please try again.')
        } else if (error.message.includes('Email not confirmed')) {
          setAuthError('Please verify your email address before signing in.')
        } else if (error.message.includes('Too many requests')) {
          setAuthError('Too many login attempts. Please wait a moment and try again.')
        } else {
          setAuthError(error.message || 'Sign in failed. Please try again.')
        }
        return
      }

      // Success — router.push triggers middleware which will validate session
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setAuthError('An unexpected error occurred. Please try again.')
      console.error('[Login] Sign in error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordReset = async (values) => {
    setIsSubmitting(true)
    setAuthError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })

      if (error) {
        setAuthError(error.message || 'Failed to send reset email. Please try again.')
        return
      }

      setResetSent(true)
    } catch (err) {
      setAuthError('An unexpected error occurred. Please try again.')
      console.error('[Login] Password reset error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            RelevantSee
          </h1>
          <p className="mt-1 text-sm text-gray-400">AI Marketing Campaign Copilot</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
          {mode === 'login' ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">Sign in</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Enter your credentials to access your account
                </p>
              </div>

              <form
                onSubmit={loginForm.handleSubmit(handleSignIn)}
                noValidate
                className="space-y-5"
              >
                {/* Global auth error */}
                {authError && (
                  <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3">
                    <p className="text-sm text-red-400">{authError}</p>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-300"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...loginForm.register('email')}
                    className={`w-full rounded-lg border bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      loginForm.formState.errors.email
                        ? 'border-red-700 focus:ring-red-500'
                        : 'border-gray-700 focus:border-indigo-500'
                    }`}
                    placeholder="you@company.com"
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-xs text-red-400">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-300"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset')
                        setAuthError(null)
                        loginForm.reset()
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    {...loginForm.register('password')}
                    className={`w-full rounded-lg border bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      loginForm.formState.errors.password
                        ? 'border-red-700 focus:ring-red-500'
                        : 'border-gray-700 focus:border-indigo-500'
                    }`}
                    placeholder="••••••••"
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-red-400">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Signing in…
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>

              {/* No self-signup notice */}
              <p className="mt-6 text-center text-xs text-gray-500">
                Don't have an account?{' '}
                <span className="text-gray-400">
                  Contact your account administrator for an invitation.
                </span>
              </p>
            </>
          ) : (
            <>
              {/* Password Reset Mode */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">Reset password</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Enter your email to receive a password reset link
                </p>
              </div>

              {resetSent ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-green-800 bg-green-950/50 px-4 py-3">
                    <p className="text-sm text-green-400">
                      If an account exists for that email, a reset link has been sent.
                      Please check your inbox.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setResetSent(false)
                      setAuthError(null)
                      resetForm.reset()
                    }}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={resetForm.handleSubmit(handlePasswordReset)}
                  noValidate
                  className="space-y-5"
                >
                  {authError && (
                    <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3">
                      <p className="text-sm text-red-400">{authError}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label
                      htmlFor="reset-email"
                      className="block text-sm font-medium text-gray-300"
                    >
                      Email address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      {...resetForm.register('email')}
                      className={`w-full rounded-lg border bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        resetForm.formState.errors.email
                          ? 'border-red-700 focus:ring-red-500'
                          : 'border-gray-700 focus:border-indigo-500'
                      }`}
                      placeholder="you@company.com"
                    />
                    {resetForm.formState.errors.email && (
                      <p className="text-xs text-red-400">
                        {resetForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Sending…
                      </span>
                    ) : (
                      'Send reset link'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setAuthError(null)
                      resetForm.reset()
                    }}
                    className="w-full rounded-lg border border-gray-700 bg-transparent px-4 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Back to sign in
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login