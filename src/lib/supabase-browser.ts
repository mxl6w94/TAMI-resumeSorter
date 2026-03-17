import { createBrowserClient } from '@supabase/ssr'

// Use process.env directly — only NEXT_PUBLIC_* vars are safe in browser bundles
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
