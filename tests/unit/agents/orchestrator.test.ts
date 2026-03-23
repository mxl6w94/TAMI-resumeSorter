import { describe, it, expect } from 'vitest'
import { validateCriteriaWeights } from '@/agents/orchestrator'

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
