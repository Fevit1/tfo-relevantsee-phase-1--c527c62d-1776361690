/**
 * Convenience re-exports for Supabase clients.
 * Import from here or directly from @/lib/supabase/client, @/lib/supabase/server, @/lib/supabase/service.
 */

// Browser client — safe to use in 'use client' components
export { createClient as createBrowserClient } from '@/lib/supabase/client'

// Server client — use in Server Components and Route Handlers
export { createClient as createServerClient } from '@/lib/supabase/server'

// Service role client — server-side only, bypasses RLS
export { createServiceClient } from '@/lib/supabase/service'