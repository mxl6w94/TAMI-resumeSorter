import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase'
import ResumeUpload from '@/components/ResumeUpload'
import CriteriaPanel from '@/components/CriteriaPanel'
import ResultsPanel from '@/components/ResultsPanel'
import AnalyzeButton from '@/components/AnalyzeButton'

export default async function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const { data: folder } = await supabase
    .from('folders')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!folder) notFound()

  const [{ data: resumes }, { data: criteria }, { data: evaluations }] =
    await Promise.all([
      supabase
        .from('folder_resumes')
        .select('added_at, resumes(id, file_name, file_url, page_count)')
        .eq('folder_id', id),
      supabase
        .from('criteria_units')
        .select('*')
        .eq('folder_id', id)
        .order('created_at'),
      supabase
        .from('evaluations')
        .select('resume_id, score, justification, exact_quote, status, criteria_unit_id')
        .eq('folder_id', id),
    ])

  const weightTotal = (criteria ?? []).reduce((s, c) => s + c.weight, 0)

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <a href="/dashboard" className="text-sm text-blue-600 hover:underline">← Folders</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{folder.name}</h1>
          {folder.description && (
            <p className="text-sm text-gray-500 mt-1">{folder.description}</p>
          )}
        </div>
        <AnalyzeButton
          folderId={id}
          disabled={weightTotal !== 100 || (resumes ?? []).length === 0}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left column */}
        <div className="space-y-8">
          <ResumeUpload folderId={id} resumes={resumes ?? []} />
          <CriteriaPanel
            folderId={id}
            criteria={criteria ?? []}
            weightTotal={weightTotal}
          />
        </div>

        {/* Right column */}
        <ResultsPanel
          resumes={resumes ?? []}
          evaluations={evaluations ?? []}
          criteria={criteria ?? []}
        />
      </div>
    </main>
  )
}
