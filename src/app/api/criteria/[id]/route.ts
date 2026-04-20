import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

// DELETE /api/criteria/[id] — remove a criterion from a folder
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: criteriaId } = await params

  // Verify ownership via folder join
  const { data: criterion } = await supabase
    .from('criteria_units')
    .select('id, folders(owner_id)')
    .eq('id', criteriaId)
    .single()

  const folder = criterion?.folders as unknown as { owner_id: string } | null
  if (!criterion || folder?.owner_id !== user.id) {
    return NextResponse.json({ error: 'Criterion not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('criteria_units')
    .delete()
    .eq('id', criteriaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
