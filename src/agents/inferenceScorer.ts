/**
 * Inference Scorer Agent
 * Consumes RAG chunks and calls Gemini 1.5 Flash to produce a structured
 * { score, justification, exact_quote } result, then persists it.
 */

import { createSupabaseServerClient } from '@/lib/supabase'
import { scoreWithGemini } from '@/lib/gemini'
import { logger } from '@/lib/logger'
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
  const supabase = await createSupabaseServerClient()

  let result
  try {
    result = await scoreWithGemini(
      criterion.name,
      criterion.prompt ?? criterion.name,
      chunks
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('inferenceScorer: scoreWithGemini failed', {
      folderId: folder_id,
      resumeId: resume_id,
      criteria_unit_id: criterion.id,
      error: message,
    })
    await supabase
      .from('evaluations')
      .update({ status: 'failed', error_message: `Scoring failed: ${message}` })
      .match({ folder_id, resume_id, criteria_unit_id: criterion.id })
    return
  }

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
