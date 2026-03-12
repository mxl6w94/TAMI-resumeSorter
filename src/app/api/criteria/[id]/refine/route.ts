import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase'
import { refinePrompt } from '@/agents/promptRefiner'

const RefineSchema = z.object({
  rawDescription: z.string().min(1),
  answers: z.record(z.string()).optional(),
})

// POST /api/criteria/[id]/refine — prompt refiner clarification layer
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: criteriaId } = await params

  // Load criterion and verify ownership via folder
  const { data: criterion } = await supabase
    .from('criteria_units')
    .select('name, folder_id, folders(owner_id)')
    .eq('id', criteriaId)
    .single()

  const folder = criterion?.folders as { owner_id: string } | null
  if (!criterion || folder?.owner_id !== user.id) {
    return NextResponse.json({ error: 'Criterion not found' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = RefineSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await refinePrompt({
    criteriaName: criterion.name,
    rawDescription: parsed.data.rawDescription,
    answers: parsed.data.answers,
  })

  // If a refined prompt was produced, persist it
  if (result.refinedPrompt) {
    await supabase
      .from('criteria_units')
      .update({ prompt: result.refinedPrompt })
      .eq('id', criteriaId)
  }

  return NextResponse.json(result)
}
