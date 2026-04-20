import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase'
import { runAnalysis, getCriteriaForFolder, validateCriteriaWeights } from '@/agents/orchestrator'
import { logger } from '@/lib/logger'

const AnalyzeSchema = z.object({
  resume_ids: z.array(z.string().uuid()).optional(), // omit to run all
})

// POST /api/folders/[id]/analyze — trigger analysis run
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

  const body = await req.json().catch(() => ({}))
  const parsed = AnalyzeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Resolve resume IDs — default to all resumes in the folder
  let resumeIds = parsed.data.resume_ids
  if (!resumeIds || resumeIds.length === 0) {
    const { data: links } = await supabase
      .from('folder_resumes')
      .select('resume_id')
      .eq('folder_id', folderId)

    resumeIds = (links ?? []).map((l) => l.resume_id)
  }

  if (resumeIds.length === 0) {
    return NextResponse.json({ error: 'No resumes in this folder.' }, { status: 400 })
  }

  // Server-side guard: criteria must sum to exactly 100 before any work is dispatched
  const criteria = await getCriteriaForFolder(folderId)
  if (criteria.length === 0) {
    return NextResponse.json({ error: 'No criteria defined for this folder.' }, { status: 400 })
  }
  if (!validateCriteriaWeights(criteria.map((c) => c.weight))) {
    return NextResponse.json(
      { error: 'Criteria weights must sum to exactly 100% before running analysis.' },
      { status: 400 }
    )
  }

  // Fire-and-forget — analysis runs in background
  runAnalysis({ folder_id: folderId, resume_ids: resumeIds }).catch((err: unknown) => {
    logger.error('analyze: runAnalysis failed', {
      folderId,
      error: err instanceof Error ? err.message : String(err),
    })
  })

  return NextResponse.json({ message: 'Analysis started', resumeCount: resumeIds.length })
}
