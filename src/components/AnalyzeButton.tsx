'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [polling, setPolling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [timedOut, setTimedOut] = useState(false)

  // Auto-refresh every 3s while polling; stop after 5 min (100 ticks)
  useEffect(() => {
    if (!polling) return
    let ticks = 0
    pollRef.current = setInterval(() => {
      ticks++
      router.refresh()
      if (ticks >= 100) {
        setPolling(false)
        clearInterval(pollRef.current!)
        setTimedOut(true)
        setMessage('Analysis is taking longer than expected.')
      }
    }, 3000)
    return () => clearInterval(pollRef.current!)
  }, [polling, router])

  function stopPolling(msg: string) {
    setPolling(false)
    clearInterval(pollRef.current!)
    setMessage(msg)
  }

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

    setMessage(`Scoring ${data.resumeCount} resume(s)…`)
    setPolling(true)
  }

  return (
    <div className="text-right">
      <button
        onClick={handleAnalyze}
        disabled={disabled || loading || polling}
        title={disabled ? 'Criteria must sum to 100% and at least one resume must be uploaded' : ''}
        className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Starting…' : polling ? 'Running…' : 'Run Analysis'}
      </button>
      {message && (
        <p className="mt-1 text-xs text-gray-500">{message}</p>
      )}
      {timedOut && (
        <button
          onClick={() => { setTimedOut(false); setMessage(null); router.refresh() }}
          className="mt-1 text-xs text-blue-600 hover:underline"
        >
          Refresh results
        </button>
      )}
    </div>
  )
}
