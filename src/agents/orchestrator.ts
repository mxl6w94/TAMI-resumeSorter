/**
 * Orchestrator Agent
 * Manages folder state, validates criteria weight sums, and coordinates
 * the analysis pipeline across all resumes in a folder.
 */

import { createSupabaseServerClient } from '@/lib/supabase'
import { CRITERIA_WEIGHT_TOTAL } from '@/lib/constants'
import { logger } from '@/lib/logger'
import type { CriteriaUnit, AnalysisRequest } from '@/types/database'
import { runRAGAnalyst } from './ragAnalyst'

export function validateCriteriaWeights(weights: number[]): boolean {
  const total = weights.reduce((sum, w) => sum + w, 0)
  return total === CRITERIA_WEIGHT_TOTAL
}

export async function getCriteriaForFolder(
  folderId: string
): Promise<CriteriaUnit[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('criteria_units')
    .select('*')
    .eq('folder_id', folderId)
    .order('created_at')

  if (error) throw new Error(`Failed to fetch criteria: ${error.message}`)
  return data ?? []
}

export async function runAnalysis(request: AnalysisRequest): Promise<void> {
  const { folder_id, resume_ids } = request
  const supabase = await createSupabaseServerClient()

  // 1. Load and validate criteria
  const criteria = await getCriteriaForFolder(folder_id)
  if (criteria.length === 0) {
    throw new Error('No criteria defined for this folder.')
  }
  if (!validateCriteriaWeights(criteria.map((c) => c.weight))) {
    throw new Error('Criteria weights do not sum to 100. Analysis aborted.')
  }

  // 2. Seed pending evaluations for each (resume, criterion) pair
  const rows = resume_ids.flatMap((resume_id) =>
    criteria.map((c) => ({
      folder_id,
      resume_id,
      criteria_unit_id: c.id,
      status: 'pending' as const,
    }))
  )

  const { error: insertError } = await supabase
    .from('evaluations')
    .upsert(rows, { onConflict: 'folder_id,resume_id,criteria_unit_id' })

  if (insertError) {
    throw new Error(`Failed to seed evaluations: ${insertError.message}`)
  }

  // 3. Dispatch RAG Analyst for each resume × criterion
  // Promise.allSettled ensures one failure doesn't abort the remaining tasks;
  // each runRAGAnalyst writes its own failed status to the DB on error.
  const results = await Promise.allSettled(
    resume_ids.flatMap((resume_id) =>
      criteria.map((criterion) =>
        runRAGAnalyst({ folder_id, resume_id, criterion })
      )
    )
  )

  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length > 0) {
    logger.error('orchestrator: tasks rejected', { folderId: folder_id, failureCount: failures.length } as Record<string, unknown>)
  }
}
