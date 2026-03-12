/**
 * Inference Scorer Agent
 * Consumes RAG chunks and calls Gemini 1.5 Flash to produce a structured
 * { score, justification, exact_quote } result, then persists it.
 */

import { createSupabaseServerClient } from '@/lib/supabase'
import { scoreWithGemini } from '@/lib/gemini'
import type { CriteriaUnit } from '@/types/database'

export interface InferenceScorerInput {
  folder_id: string
  resume_id: string
  criterion: CriteriaUnit
  chunks: string[]
}

export async function runInferenceScorer(
  input: InferenceScorerInput
): Promise<void> {
  const { folder_id, resume_id, criterion, chunks } = input
  const supabase = createSupabaseServerClient()

  const result = await scoreWithGemini(
    criterion.name,
    criterion.prompt ?? criterion.name,
    chunks
  )

  // Apply the criterion weight to produce a weighted contribution score
  const weightedScore = (result.score / 100) * criterion.weight

  await supabase
    .from('evaluations')
    .update({
      score: weightedScore,
      justification: result.justification,
      exact_quote: result.exact_quote ?? null,
      status: 'completed',
      error_message: null,
    })
    .match({ folder_id, resume_id, criteria_unit_id: criterion.id })
}
