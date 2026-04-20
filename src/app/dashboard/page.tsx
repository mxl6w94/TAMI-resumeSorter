export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase'
import CreateFolderButton from '@/components/CreateFolderButton'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: folders } = await supabase
    .from('folders')
    .select('*, criteria_units(count), folder_resumes(count)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Folders</h1>
          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        </div>
        <CreateFolderButton />
      </div>

      {folders && folders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">No folders yet</p>
          <p className="text-sm mt-1">Create a folder to start screening resumes.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders?.map((folder) => {
            const criteriaCount = (folder.criteria_units as { count: number }[])[0]?.count ?? 0
            const resumeCount = (folder.folder_resumes as { count: number }[])[0]?.count ?? 0
            return (
              <Link
                key={folder.id}
                href={`/folders/${folder.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <h2 className="font-semibold text-gray-900 truncate">{folder.name}</h2>
                {folder.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{folder.description}</p>
                )}
                <div className="flex gap-4 mt-4 text-xs text-gray-400">
                  <span>{resumeCount} resume{resumeCount !== 1 ? 's' : ''}</span>
                  <span>{criteriaCount} criteria</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
