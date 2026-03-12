'use client'

import { useState } from 'react'
import type { CriteriaUnit } from '@/types/database'

interface ResumeRow {
  resumes: { id: string; file_name: string; file_url: string } | null
}

interface EvaluationRow {
  resume_id: string
  criteria_unit_id: string
  score: number
  justification: string | null
  exact_quote: string | null
  status: string
}

export default function ResultsPanel({
  resumes,
  evaluations,
  criteria,
}: {
  resumes: ResumeRow[]
  evaluations: EvaluationRow[]
  criteria: CriteriaUnit[]
}) {
  const [selected, setSelected] = useState<string | null>(null)

  // Roll up total score per resume
  const scored = resumes
    .map((row) => {
      const resume = row.resumes
      if (!resume) return null
      const evs = evaluations.filter(
        (e) => e.resume_id === resume.id && e.status === 'completed'
      )
      const total = evs.reduce((s, e) => s + Number(e.score), 0)
      return { resume, total, evs }
    })
    .filter(Boolean)
    .sort((a, b) => b!.total - a!.total) as {
      resume: { id: string; file_name: string; file_url: string }
      total: number
      evs: EvaluationRow[]
    }[]

  const selectedEntry = scored.find((s) => s.resume.id === selected)

  if (scored.length === 0) {
    return (
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Results</h2>
        <p className="text-sm text-gray-400">Run analysis to see scores here.</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-3">Results</h2>
      <ul className="space-y-2">
        {scored.map(({ resume, total, evs }) => {
          const hasResults = evs.length > 0
          return (
            <li key={resume.id}>
              <button
                onClick={() => setSelected(selected === resume.id ? null : resume.id)}
                className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-3 text-sm transition-colors"
              >
                <span className="font-medium text-gray-800 truncate">{resume.file_name}</span>
                {hasResults ? (
                  <span className={`ml-3 shrink-0 font-bold text-base ${
                    total >= 70 ? 'text-green-600' : total >= 40 ? 'text-orange-500' : 'text-red-500'
                  }`}>
                    {Math.round(total)}%
                  </span>
                ) : (
                  <span className="ml-3 text-gray-400 text-xs">pending</span>
                )}
              </button>

              {selected === resume.id && selectedEntry && (
                <div className="mt-2 ml-2 space-y-3 border-l-2 border-gray-200 pl-4">
                  {criteria.map((c) => {
                    const ev = evs.find((e) => e.criteria_unit_id === c.id)
                    return (
                      <div key={c.id} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">{c.name}</span>
                          {ev ? (
                            <span className="text-gray-500">{Math.round(Number(ev.score))}pts</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                        {ev?.justification && (
                          <p className="text-gray-500 mt-0.5">{ev.justification}</p>
                        )}
                        {ev?.exact_quote && (
                          <blockquote className="mt-1 bg-yellow-50 border-l-4 border-yellow-400 pl-2 py-1 text-xs text-gray-600 italic">
                            &ldquo;{ev.exact_quote}&rdquo;
                          </blockquote>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
