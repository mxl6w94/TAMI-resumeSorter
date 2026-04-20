import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: class {
    embeddings = { create: mockCreate }
  },
}))

vi.mock('@/lib/env', () => ({ env: { OPENAI_API_KEY: 'test-key' } }))

import { generateEmbedding } from '@/lib/openai'

describe('generateEmbedding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the embedding vector from the API response', async () => {
    const fakeEmbedding = Array.from({ length: 1536 }, (_, i) => i * 0.001)
    mockCreate.mockResolvedValue({ data: [{ embedding: fakeEmbedding }] })

    const result = await generateEmbedding('hello world')
    expect(result).toEqual(fakeEmbedding)
    expect(result).toHaveLength(1536)
  })

  it('replaces newlines in input before sending to API', async () => {
    mockCreate.mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] })

    await generateEmbedding('line one\nline two\nline three')
    const params = mockCreate.mock.calls[0][0] as { input: string }
    expect(params.input).toBe('line one line two line three')
    expect(params.input).not.toContain('\n')
  })

  it('propagates API errors', async () => {
    mockCreate.mockRejectedValue(new Error('OpenAI rate limit'))
    await expect(generateEmbedding('text')).rejects.toThrow('OpenAI rate limit')
  })
})
