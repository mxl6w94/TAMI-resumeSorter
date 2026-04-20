import { describe, it, expect } from 'vitest'
import { chunkText, validateFileSize } from '@/agents/ragAnalyst'
import { MAX_FILE_SIZE_BYTES } from '@/lib/constants'

describe('chunkText', () => {
  it('splits text into chunks of the given word size', () => {
    const words = Array.from({ length: 10 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(words, 3)
    expect(chunks).toHaveLength(4) // ceil(10/3)
    expect(chunks[0]).toBe('word0 word1 word2')
  })

  it('returns a single chunk when text is shorter than chunk size', () => {
    const chunks = chunkText('hello world', 512)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('hello world')
  })

  it('returns empty array for empty string', () => {
    expect(chunkText('')).toHaveLength(0)
  })
})

describe('validateFileSize', () => {
  it('does not throw for a file within the limit', () => {
    expect(() => validateFileSize(MAX_FILE_SIZE_BYTES)).not.toThrow()
  })

  it('throws for a file exceeding 5 MB', () => {
    expect(() => validateFileSize(MAX_FILE_SIZE_BYTES + 1)).toThrow(
      'exceeds the 5 MB limit'
    )
  })
})
