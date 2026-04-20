'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface ResumeRow {
  added_at: string
  resumes: { id: string; file_name: string; file_url: string; page_count: number } | null
}

export default function ResumeUpload({
  folderId,
  resumes,
}: {
  folderId: string
  resumes: ResumeRow[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)

    const form = new FormData()
    form.append('file', file)

    const res = await fetch(`/api/folders/${folderId}/resumes`, {
      method: 'POST',
      body: form,
    })

    setUploading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Upload failed')
      return
    }
    router.refresh()
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-3">
        Resumes <span className="text-gray-400 font-normal">({resumes.length})</span>
      </h2>

      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : '+ Upload PDF or DOCX (max 5 MB / 50 pages)'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {resumes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {resumes.map((row) => {
            const resume = row.resumes
            if (!resume) return null
            return (
              <li
                key={resume.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
              >
                <span className="truncate text-gray-700">{resume.file_name}</span>
                <span className="text-gray-400 ml-2 shrink-0">{resume.page_count}p</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
