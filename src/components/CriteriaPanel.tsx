'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CriteriaUnit } from '@/types/database'

export default function CriteriaPanel({
  folderId,
  criteria,
  weightTotal,
}: {
  folderId: string
  criteria: CriteriaUnit[]
  weightTotal: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [weight, setWeight] = useState('')
  const [isAi, setIsAi] = useState(true)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = 100 - weightTotal
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/criteria/${id}`, { method: 'DELETE' })
    setDeleting(null)
    router.refresh()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch(`/api/folders/${folderId}/criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        is_ai_powered: isAi,
        weight: parseInt(weight, 10),
        evaluation_type: isAi ? 'semantic_match' : 'manual',
      }),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to add criterion')
      return
    }

    setOpen(false)
    setName('')
    setWeight('')
    setDescription('')
    router.refresh()
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">
          Criteria{' '}
          <span className={`text-sm font-normal ${weightTotal === 100 ? 'text-green-600' : 'text-orange-500'}`}>
            {weightTotal}/100%
          </span>
        </h2>
        {remaining > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            + Add
          </button>
        )}
      </div>

      {criteria.length === 0 ? (
        <p className="text-sm text-gray-400">No criteria yet. Add criteria that sum to 100%.</p>
      ) : (
        <ul className="space-y-2">
          {criteria.map((c) => (
            <li key={c.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <span className="font-medium text-gray-700 flex-1 truncate">{c.name}</span>
              <span className="text-gray-400 shrink-0">{c.weight}%</span>
              {c.is_ai_powered && (
                <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">AI</span>
              )}
              <button
                onClick={() => handleDelete(c.id)}
                disabled={deleting === c.id}
                className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50 ml-1"
                aria-label="Delete criterion"
              >
                {deleting === c.id ? '…' : '×'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Criterion</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Python experience"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (remaining: {remaining}%)
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  max={remaining}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`1–${remaining}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ai-powered"
                  checked={isAi}
                  onChange={(e) => setIsAi(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="ai-powered" className="text-sm text-gray-700">AI-powered (RAG + LLM)</label>
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
