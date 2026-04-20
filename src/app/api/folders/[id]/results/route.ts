import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

// GET /api/folders/[id]/results — scored resume list with evaluations
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

  // Verify folder ownership
  const { data: folder } = await supabase
    .from('folders')
    .select('id')
    .eq('id', folderId)
    .eq('owner_id', user.id)
    .single()

  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })

  // Fetch all evaluations for this folder with resume details
  const { data: evaluations, error } = await supabase
    .from('evaluations')
    .select(`
      id, score, justification, exact_quote, status,
      criteria_unit_id,
      criteria_units(name, weight),
      resumes(id, file_name, file_url)
    `)
    .eq('folder_id', folderId)
    .order('score', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Roll up per-resume total score
  const resumeMap = new Map<string, {
    resume: { id: string; file_name: string; file_url: string }
    totalScore: number
    evaluations: typeof evaluations
  }>()

  for (const ev of evaluations ?? []) {
    const resume = ev.resumes as unknown as { id: string; file_name: string; file_url: string }
    if (!resumeMap.has(resume.id)) {
      resumeMap.set(resume.id, { resume, totalScore: 0, evaluations: [] })
    }
    const entry = resumeMap.get(resume.id)!
    if (ev.status === 'completed') entry.totalScore += Number(ev.score)
    entry.evaluations.push(ev)
  }

  const results = Array.from(resumeMap.values()).sort(
    (a, b) => b.totalScore - a.totalScore
  )

  return NextResponse.json(results)
}
