'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AnalyzeButton({
  folderId,
  disabled,
}: {
  folderId: string
  disabled: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleAnalyze() {
    setLoading(true)
    setMessage(null)

    const res = await fetch(`/api/folders/${folderId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    setLoading(false)
    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error ?? 'Analysis failed')
      return
    }

    setMessage(`Analysis started for ${data.resumeCount} resume(s). Refresh to see results.`)
    router.refresh()
  }

  return (
    <div className="text-right">
      <button
        onClick={handleAnalyze}
        disabled={disabled || loading}
        title={disabled ? 'Criteria must sum to 100% and at least one resume must be uploaded' : ''}
        className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Starting…' : 'Run Analysis'}
      </button>
      {message && (
        <p className="mt-1 text-xs text-gray-500">{message}</p>
      )}
    </div>
  )
}
