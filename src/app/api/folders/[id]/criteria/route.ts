import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase'
import { CRITERIA_WEIGHT_TOTAL } from '@/lib/constants'

const CriteriaSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  is_ai_powered: z.boolean().default(true),
  weight: z.number().int().min(1).max(100),
  evaluation_type: z.enum(['keyword_match', 'semantic_match', 'manual']).default('semantic_match'),
  prompt: z.string().max(1000).optional(),
})

// GET /api/folders/[id]/criteria
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: folderId } = await params

  const { data, error } = await supabase
    .from('criteria_units')
    .select('*')
    .eq('folder_id', folderId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const weightTotal = (data ?? []).reduce((sum, c) => sum + c.weight, 0)
  return NextResponse.json({ criteria: data, weightTotal, isValid: weightTotal === CRITERIA_WEIGHT_TOTAL })
}

// POST /api/folders/[id]/criteria
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: folderId } = await params

  // Verify folder ownership
  const { data: folder } = await supabase
    .from('folders')
    .select('id')
    .eq('id', folderId)
    .eq('owner_id', user.id)
    .single()

  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })

  const body = await req.json()
  const parsed = CriteriaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Check adding this weight won't exceed 100
  const { data: existing } = await supabase
    .from('criteria_units')
    .select('weight')
    .eq('folder_id', folderId)

  const currentTotal = (existing ?? []).reduce((sum, c) => sum + c.weight, 0)
  if (currentTotal + parsed.data.weight > CRITERIA_WEIGHT_TOTAL) {
    return NextResponse.json(
      { error: `Adding this criterion would exceed 100% (current total: ${currentTotal}%)` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('criteria_units')
    .insert({ ...parsed.data, folder_id: folderId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
