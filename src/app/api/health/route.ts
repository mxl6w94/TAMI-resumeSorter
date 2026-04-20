import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    // Lightweight connectivity check — no data returned
    const { error } = await supabase.from('folders').select('id').limit(1)
    if (error) throw error
    return NextResponse.json({ status: 'ok', db: 'connected' })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', db: 'unreachable', message: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    )
  }
}
