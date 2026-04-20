import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeChain, makeSupabaseMock } from '../helpers/supabaseMock'

vi.mock('@/lib/supabase', () => ({ createSupabaseServerClient: vi.fn() }))
vi.mock('@/lib/gemini', () => ({ scoreWithGemini: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { createSupabaseServerClient } from '@/lib/supabase'
import { scoreWithGemini } from '@/lib/gemini'
import { runInferenceScorer } from '@/agents/inferenceScorer'
import type { CriteriaUnit } from '@/types/database'

const criterion: CriteriaUnit = {
  id: 'c1',
  folder_id: 'f1',
  name: 'Python',
  description: null,
  weight: 40,
  is_ai_powered: true,
  evaluation_type: 'semantic_match',
  prompt: 'Rate Python skills',
  created_at: new Date().toISOString(),
}

describe('runInferenceScorer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists weighted score and sets status completed on success', async () => {
    const updateChain = makeChain({ data: null, error: null })
    const supabase = makeSupabaseMock({}, { evaluations: updateChain })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
    ;(scoreWithGemini as ReturnType<typeof vi.fn>).mockResolvedValue({
      score: 80,
      justification: 'Strong Python background.',
      exact_quote: '5 years of Python',
    })

    await runInferenceScorer({ folder_id: 'f1', resume_id: 'r1', criterion, chunks: ['chunk1'] })

    expect(scoreWithGemini).toHaveBeenCalledWith('Python', 'Rate Python skills', ['chunk1'])
    expect(supabase.from).toHaveBeenCalledWith('evaluations')
    const updateCall = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.status).toBe('completed')
    // 80% of weight 40 = 32
    expect(updateCall.score).toBeCloseTo(32)
    expect(updateCall.justification).toBe('Strong Python background.')
  })

  it('uses criterion name as fallback prompt when prompt is null', async () => {
    const criterionNoPrompt = { ...criterion, prompt: null }
    const updateChain = makeChain()
    const supabase = makeSupabaseMock({}, { evaluations: updateChain })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
    ;(scoreWithGemini as ReturnType<typeof vi.fn>).mockResolvedValue({
      score: 50, justification: 'OK', exact_quote: null,
    })

    await runInferenceScorer({ folder_id: 'f1', resume_id: 'r1', criterion: criterionNoPrompt, chunks: ['c'] })
    expect(scoreWithGemini).toHaveBeenCalledWith('Python', 'Python', ['c'])
  })

  it('marks evaluation as failed when scoreWithGemini throws', async () => {
    const updateChain = makeChain({ data: null, error: null })
    const supabase = makeSupabaseMock({}, { evaluations: updateChain })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
    ;(scoreWithGemini as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Gemini timeout'))

    await runInferenceScorer({ folder_id: 'f1', resume_id: 'r1', criterion, chunks: ['c'] })

    const updateCall = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.status).toBe('failed')
    expect(String(updateCall.error_message)).toContain('Gemini timeout')
  })
})
