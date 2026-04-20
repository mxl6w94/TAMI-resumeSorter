import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateContent = vi.fn()

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent }
    }
  },
}))

vi.mock('@/lib/env', () => ({ env: { GEMINI_API_KEY: 'test-key' } }))

import {
  generateClarifyingQuestions,
  buildRefinedPrompt,
  refinePrompt,
} from '@/agents/promptRefiner'

describe('generateClarifyingQuestions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns parsed questions from model JSON response', async () => {
    const questions = [
      { id: 'q1', question: 'How many years?' },
      { id: 'q2', question: 'Which frameworks?' },
    ]
    mockGenerateContent.mockResolvedValue({ response: { text: () => JSON.stringify(questions) } })

    const result = await generateClarifyingQuestions('Python', 'Python experience needed')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('q1')
    expect(result[1].question).toBe('Which frameworks?')
  })

  it('throws when model returns unparseable JSON', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'not json at all' } })
    await expect(generateClarifyingQuestions('Python', 'desc')).rejects.toThrow(
      /failed to parse clarifying questions/i
    )
  })
})

describe('buildRefinedPrompt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns trimmed prompt text from model response', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '  Score Python experience on a scale of 0-100.  ' },
    })

    const result = await buildRefinedPrompt({
      criteriaName: 'Python',
      rawDescription: 'needs python',
      answers: { q1: '3+ years', q2: 'Django' },
    })
    expect(result).toBe('Score Python experience on a scale of 0-100.')
  })
})

describe('refinePrompt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns questions when no answers are provided', async () => {
    const questions = [{ id: 'q1', question: 'Years of Python?' }]
    mockGenerateContent.mockResolvedValue({ response: { text: () => JSON.stringify(questions) } })

    const result = await refinePrompt({ criteriaName: 'Python', rawDescription: 'python skills' })
    expect(result.questions).toBeDefined()
    expect(result.refinedPrompt).toBeUndefined()
  })

  it('returns refined prompt when answers are provided', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'Evaluate Python skill depth from 0-100.' },
    })

    const result = await refinePrompt({
      criteriaName: 'Python',
      rawDescription: 'python skills',
      answers: { q1: '5 years' },
    })
    expect(result.refinedPrompt).toBe('Evaluate Python skill depth from 0-100.')
    expect(result.questions).toBeUndefined()
  })

  it('returns questions when answers is an empty object', async () => {
    const questions = [{ id: 'q1', question: 'Any question?' }]
    mockGenerateContent.mockResolvedValue({ response: { text: () => JSON.stringify(questions) } })

    const result = await refinePrompt({ criteriaName: 'Python', rawDescription: 'python', answers: {} })
    expect(result.questions).toBeDefined()
  })
})
