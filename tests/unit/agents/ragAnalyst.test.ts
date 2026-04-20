import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MAX_FILE_SIZE_BYTES } from '@/lib/constants'
import { makeChain, makeSupabaseMock } from '../helpers/supabaseMock'

vi.mock('@/lib/supabase', () => ({ createSupabaseServerClient: vi.fn() }))
vi.mock('@/lib/openai', () => ({ generateEmbedding: vi.fn() }))
vi.mock('@/agents/inferenceScorer', () => ({ runInferenceScorer: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

// Mock pdf-parse and mammoth for extractTextFromBuffer tests
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}))
vi.mock('mammoth', () => ({
  extractRawText: vi.fn(),
}))

import { createSupabaseServerClient } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/openai'
import { runInferenceScorer } from '@/agents/inferenceScorer'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runInferenceScorerMock = runInferenceScorer as any
import {
  chunkText,
  validateFileSize,
  extractTextFromBuffer,
  embedAndStoreChunks,
  retrieveSimilarChunks,
  runRAGAnalyst,
} from '@/agents/ragAnalyst'
import type { CriteriaUnit } from '@/types/database'

// ─── chunkText ────────────────────────────────────────────────────────────────
describe('chunkText', () => {
  it('splits text into chunks of the given word size', () => {
    const words = Array.from({ length: 10 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(words, 3)
    expect(chunks).toHaveLength(4)
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

  it('filters out empty tokens from whitespace-only strings', () => {
    expect(chunkText('   ')).toHaveLength(0)
  })
})

// ─── validateFileSize ─────────────────────────────────────────────────────────
describe('validateFileSize', () => {
  it('does not throw for a file within the limit', () => {
    expect(() => validateFileSize(MAX_FILE_SIZE_BYTES)).not.toThrow()
  })

  it('throws for a file exceeding 5 MB', () => {
    expect(() => validateFileSize(MAX_FILE_SIZE_BYTES + 1)).toThrow('exceeds the 5 MB limit')
  })
})

// ─── extractTextFromBuffer ────────────────────────────────────────────────────
describe('extractTextFromBuffer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('extracts text from a PDF buffer', async () => {
    const pdfParse = await import('pdf-parse')
    ;(pdfParse.default as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: 'resume content',
      numpages: 2,
    })

    const result = await extractTextFromBuffer(Buffer.from('fake'), 'application/pdf')
    expect(result.text).toBe('resume content')
    expect(result.pageCount).toBe(2)
  })

  it('throws when PDF exceeds page limit', async () => {
    const pdfParse = await import('pdf-parse')
    ;(pdfParse.default as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: 'long pdf',
      numpages: 51,
    })

    await expect(
      extractTextFromBuffer(Buffer.from('fake'), 'application/pdf')
    ).rejects.toThrow('50 page limit')
  })

  it('extracts text from a DOCX buffer', async () => {
    const mammoth = await import('mammoth')
    ;(mammoth.extractRawText as ReturnType<typeof vi.fn>).mockResolvedValue({ value: 'docx text' })

    const result = await extractTextFromBuffer(
      Buffer.from('fake'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    expect(result.text).toBe('docx text')
    expect(result.pageCount).toBe(1)
  })

  it('throws for unsupported MIME type', async () => {
    await expect(
      extractTextFromBuffer(Buffer.from('fake'), 'text/plain')
    ).rejects.toThrow('Unsupported file type')
  })
})

// ─── embedAndStoreChunks ──────────────────────────────────────────────────────
describe('embedAndStoreChunks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('generates embeddings and upserts rows to resume_chunks', async () => {
    const fakeEmbedding = Array(1536).fill(0.1)
    ;(generateEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue(fakeEmbedding)

    const chunksChain = makeChain({ error: null })
    const supabase = makeSupabaseMock({}, { resume_chunks: chunksChain })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    await embedAndStoreChunks('r1', ['chunk A', 'chunk B'])

    expect(generateEmbedding).toHaveBeenCalledTimes(2)
    expect(supabase.from).toHaveBeenCalledWith('resume_chunks')
  })

  it('throws when Supabase upsert returns an error', async () => {
    ;(generateEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue([0.1])
    const chunksChain = makeChain({ error: { message: 'upsert failed' } })
    const supabase = makeSupabaseMock({}, { resume_chunks: chunksChain })
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    await expect(embedAndStoreChunks('r1', ['chunk'])).rejects.toThrow('Failed to store chunks')
  })
})

// ─── retrieveSimilarChunks ────────────────────────────────────────────────────
describe('retrieveSimilarChunks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls match_resume_chunks RPC and returns results', async () => {
    const matches = [
      { chunk_text: 'Python experience', similarity: 0.9 },
    ]
    const rpcChain = makeChain({ data: matches })
    const supabase = {
      ...makeSupabaseMock(),
      rpc: vi.fn(() => rpcChain),
    }
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    const result = await retrieveSimilarChunks('r1', [0.1, 0.2])
    expect(supabase.rpc).toHaveBeenCalledWith('match_resume_chunks', expect.objectContaining({ p_resume_id: 'r1' }))
    expect(result).toEqual(matches)
  })

  it('throws when RPC returns an error', async () => {
    const rpcChain = makeChain({ error: { message: 'rpc error' } })
    const supabase = { ...makeSupabaseMock(), rpc: vi.fn(() => rpcChain) }
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    await expect(retrieveSimilarChunks('r1', [0.1])).rejects.toThrow('Similarity search failed')
  })

  it('returns empty array when no matches found', async () => {
    const rpcChain = makeChain({ data: null })
    const supabase = { ...makeSupabaseMock(), rpc: vi.fn(() => rpcChain) }
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    const result = await retrieveSimilarChunks('r1', [0.1])
    expect(result).toEqual([])
  })
})

// ─── runRAGAnalyst ────────────────────────────────────────────────────────────
const criterion: CriteriaUnit = {
  id: 'c1', folder_id: 'f1', name: 'Python', description: null,
  weight: 40, is_ai_powered: true, evaluation_type: 'semantic_match',
  prompt: 'Rate Python', created_at: '',
}

describe('runRAGAnalyst', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeFullSupabase(
    chunkCount: number,
    rawText: string | null,
    rpcData: unknown[] | null = [{ chunk_text: 'Python expert', similarity: 0.9 }]
  ) {
    const evaluationsChain = makeChain({ data: null, error: null })
    const resumeChunksChain = makeChain({ count: chunkCount, data: null, error: null })
    const resumesChain = makeChain({ data: rawText ? { raw_text: rawText } : null, error: rawText ? null : { message: 'not found' } })
    const rpcChain = makeChain({ data: rpcData })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'evaluations') return evaluationsChain
        if (table === 'resume_chunks') return resumeChunksChain
        if (table === 'resumes') return resumesChain
        return makeChain()
      }),
      rpc: vi.fn(() => rpcChain),
      storage: { from: vi.fn() },
      auth: { getUser: vi.fn() },
    }
    return { supabase, evaluationsChain }
  }

  it('calls inferenceScorer when similar chunks are found', async () => {
    const { supabase } = makeFullSupabase(3, 'raw text')
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
    ;(generateEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue([0.1])
    runInferenceScorerMock.mockResolvedValue(undefined)

    await runRAGAnalyst({ folder_id: 'f1', resume_id: 'r1', criterion })
    expect(runInferenceScorerMock).toHaveBeenCalledWith(expect.objectContaining({ resume_id: 'r1' }))
  })

  it('scores 0 and skips inferenceScorer when no similar chunks found', async () => {
    const { supabase, evaluationsChain } = makeFullSupabase(3, 'raw text', [])
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
    ;(generateEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue([0.1])

    await runRAGAnalyst({ folder_id: 'f1', resume_id: 'r1', criterion })

    expect(runInferenceScorerMock).not.toHaveBeenCalled()
    const updateArg = (evaluationsChain.update as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(updateArg?.score).toBe(0)
    expect(updateArg?.status).toBe('completed')
  })

  it('embeds raw text on-demand when no chunks exist yet', async () => {
    const { supabase } = makeFullSupabase(0, 'resume text here')
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)
    ;(generateEmbedding as ReturnType<typeof vi.fn>).mockResolvedValue([0.1])
    runInferenceScorerMock.mockResolvedValue(undefined)

    await runRAGAnalyst({ folder_id: 'f1', resume_id: 'r1', criterion })
    // generateEmbedding called for chunks + query
    expect(generateEmbedding).toHaveBeenCalled()
  })

  it('marks evaluation as failed when raw text is missing and no chunks exist', async () => {
    const { supabase, evaluationsChain } = makeFullSupabase(0, null)
    ;(createSupabaseServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabase)

    await runRAGAnalyst({ folder_id: 'f1', resume_id: 'r1', criterion })

    const updateArg = (evaluationsChain.update as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(updateArg?.status).toBe('failed')
    expect(String(updateArg?.error_message)).toContain('raw text not available')
  })
})
