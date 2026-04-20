// Server-only client (uses next/headers — do NOT import in 'use client' files)
export { createSupabaseServerClient } from './supabase-server'

// Browser client (safe to use in client components)
export { createSupabaseBrowserClient } from './supabase-browser'
