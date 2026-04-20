import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeChain, makeSupabaseMock } from '../helpers/supabaseMock'

vi.mock('@/lib/supabase', () => ({ createSupabaseServerClient: vi.fn() }))
vi.mock('@/agents/ragAnalyst', () => ({ runRAGAnalyst: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { createSupabaseServerClient } from '@/lib/supabase'
import {
  validateCriteriaWeights,
  getCriteriaForFolder,
  runAnalysis,
} from '@/agents/orchestrator'
import { runRAGAnalyst } from '@/agents/ragAnalyst'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runRAGAnalystMock = runRAGAnalyst as any

const mockCriteria = [
  { id: 'c1', folder_id: 'f1', name: 'Python', weight: 60, is_ai_powered: true, prompt: 'Rate Python', created_at: '' },
  { id: 'c2', folder_id: 'f1', name: 'SQL',    weight: 40, is_ai_powered: true, prompt: 'Rate SQL',    created_at: '' },
]

describe('validateCriteriaWeights', () => {
  it('returns true when weights sum to exactly 100', () => {
    expect(validateCriteriaWeights([40, 35, 25])).toBe(true)
  })

  it('returns true for a single weight of 100', () => {
    expect(validateCriteriaWeights([100])).toBe(true)
  })

  it('returns false when weights sum to less than 100', () => {
    expect(validateCriteriaWeights([40, 35])).toBe(false)
  })

  it('returns false when weights sum to more than 100', () => {
    expect(validateCriteriaWeights([40, 35, 30])).toBe(false)
  })

  it('returns false for an empty array', () => {
    expect(validateCriteriaWeights([])).toBe(false)
  })
})

describe('getCriteriaForFolder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns criteria sorted by created_at', async () => {
    const supabase = makeSupabaseMock({ data: mockCriteria })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    const result = await getCriteriaForFolder('f1')
    expect(result).toEqual(mockCriteria)
  })

  it('returns empty array when no criteria exist', async () => {
    const supabase = makeSupabaseMock({ data: null })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    const result = await getCriteriaForFolder('f1')
    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    const supabase = makeSupabaseMock({ error: { message: 'DB error' } })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    await expect(getCriteriaForFolder('f1')).rejects.toThrow('Failed to fetch criteria: DB error')
  })
})

describe('runAnalysis', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dispatches runRAGAnalyst for every (resume, criterion) pair', async () => {
    const criteriaChain = makeChain({ data: mockCriteria })
    const evaluationsChain = makeChain({ data: null, error: null })
    const supabase = makeSupabaseMock({}, {
      criteria_units: criteriaChain,
      evaluations: evaluationsChain,
    })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
    runRAGAnalystMock.mockResolvedValue(undefined)

    await runAnalysis({ folder_id: 'f1', resume_ids: ['r1', 'r2'] })

    // 2 resumes × 2 criteria = 4 calls
    expect(runRAGAnalystMock).toHaveBeenCalledTimes(4)
  })

  it('throws when no criteria are defined', async () => {
    const criteriaChain = makeChain({ data: [] })
    const supabase = makeSupabaseMock({}, { criteria_units: criteriaChain })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    await expect(runAnalysis({ folder_id: 'f1', resume_ids: ['r1'] })).rejects.toThrow(
      'No criteria defined'
    )
  })

  it('throws when criteria weights do not sum to 100', async () => {
    const badCriteria = [{ ...mockCriteria[0], weight: 50 }]
    const criteriaChain = makeChain({ data: badCriteria })
    const supabase = makeSupabaseMock({}, { criteria_units: criteriaChain })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    await expect(runAnalysis({ folder_id: 'f1', resume_ids: ['r1'] })).rejects.toThrow(
      'weights do not sum to 100'
    )
  })

  it('continues processing remaining tasks when one runRAGAnalyst fails', async () => {
    const criteriaChain = makeChain({ data: mockCriteria })
    const evaluationsChain = makeChain({ data: null, error: null })
    const supabase = makeSupabaseMock({}, {
      criteria_units: criteriaChain,
      evaluations: evaluationsChain,
    })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    let callCount = 0
    runRAGAnalystMock.mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.reject(new Error('first task failed'))
      return Promise.resolve()
    })

    // Should not throw — Promise.allSettled absorbs rejections
    await expect(runAnalysis({ folder_id: 'f1', resume_ids: ['r1', 'r2'] })).resolves.toBeUndefined()
    expect(runRAGAnalystMock).toHaveBeenCalledTimes(4)
  })

  it('throws when seeding evaluations fails', async () => {
    const criteriaChain = makeChain({ data: mockCriteria })
    const evaluationsChain = makeChain({ error: { message: 'insert failed' } })
    const supabase = makeSupabaseMock({}, {
      criteria_units: criteriaChain,
      evaluations: evaluationsChain,
    })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    await expect(runAnalysis({ folder_id: 'f1', resume_ids: ['r1'] })).rejects.toThrow(
      'Failed to seed evaluations'
    )
  })
})
