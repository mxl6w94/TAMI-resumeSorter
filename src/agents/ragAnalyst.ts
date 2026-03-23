/**
 * RAG Analyst Agent
 * Handles PDF/DOCX text extraction, chunking, embedding storage,
 * and similarity retrieval. If similarity < threshold, scores 0 without
 * calling the LLM (cost/latency guard).
 */

import { createSupabaseServerClient } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/openai'
import {
  SIMILARITY_THRESHOLD,
  CHUNK_SIZE_TOKENS,
  MATCH_COUNT,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_PAGES,
} from '@/lib/constants'
import type { CriteriaUnit } from '@/types/database'
import { runInferenceScorer } from './inferenceScorer'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RAGAnalystInput {
  folder_id: string
  resume_id: string
  criterion: CriteriaUnit
}

export interface ParsedResume {
  text: string
  pageCount: number
}

// ─── Text extraction ──────────────────────────────────────────────────────────

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<ParsedResume> {
  if (mimeType === 'application/pdf') {
    const pdfModule = await import('pdf-parse')
    const pdfParse = pdfModule.default ?? pdfModule
    const result = await pdfParse(buffer)
    if (result.numpages > MAX_FILE_PAGES) {
      throw new Error(`PDF exceeds ${MAX_FILE_PAGES} page limit.`)
    }
    return { text: result.text, pageCount: result.numpages }
  }

  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return { text: result.value, pageCount: 1 }
  }

  throw new Error(`Unsupported file type: ${mimeType}`)
}

export function validateFileSize(sizeBytes: number): void {
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds the 5 MB limit.`)
  }
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

export function chunkText(text: string, chunkSize = CHUNK_SIZE_TOKENS): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '))
  }
  return chunks
}

// ─── Embedding storage ────────────────────────────────────────────────────────

export async function embedAndStoreChunks(
  resumeId: string,
  chunks: string[]
): Promise<void> {
  const supabase = await createSupabaseServerClient()

  const rows = await Promise.all(
    chunks.map(async (chunk, index) => ({
      resume_id: resumeId,
      chunk_index: index,
      chunk_text: chunk,
      embedding: await generateEmbedding(chunk),
    }))
  )

  const { error } = await supabase
    .from('resume_chunks')
    .upsert(rows, { onConflict: 'resume_id,chunk_index' })

  if (error) throw new Error(`Failed to store chunks: ${error.message}`)
}

// ─── Similarity retrieval ─────────────────────────────────────────────────────

export async function retrieveSimilarChunks(
  resumeId: string,
  queryEmbedding: number[]
): Promise<{ chunk_text: string; similarity: number }[]> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.rpc('match_resume_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: MATCH_COUNT,
    p_resume_id: resumeId,
  })

  if (error) throw new Error(`Similarity search failed: ${error.message}`)
  return data ?? []
}

// ─── Main RAG flow ────────────────────────────────────────────────────────────

export async function runRAGAnalyst(input: RAGAnalystInput): Promise<void> {
  const { folder_id, resume_id, criterion } = input
  const supabase = await createSupabaseServerClient()

  // Mark evaluation as processing
  await supabase
    .from('evaluations')
    .update({ status: 'processing' })
    .match({ folder_id, resume_id, criteria_unit_id: criterion.id })

  try {
    // Ensure chunks exist; embed on-demand if not yet stored
    const { count } = await supabase
      .from('resume_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('resume_id', resume_id)

    if ((count ?? 0) === 0) {
      // Fetch raw text from resumes table and embed it
      const { data: resume, error } = await supabase
        .from('resumes')
        .select('raw_text')
        .eq('id', resume_id)
        .single()

      if (error || !resume?.raw_text) {
        throw new Error('Resume raw text not available for embedding.')
      }

      const chunks = chunkText(resume.raw_text)
      await embedAndStoreChunks(resume_id, chunks)
    }

    // Build query embedding from criterion prompt or name
    const queryText = criterion.prompt ?? criterion.name
    const queryEmbedding = await generateEmbedding(queryText)

    // Retrieve similar chunks
    const matches = await retrieveSimilarChunks(resume_id, queryEmbedding)

    // Fallback: low similarity → score 0, skip LLM
    if (matches.length === 0) {
      await supabase
        .from('evaluations')
        .update({
          score: 0,
          justification: 'No relevant content found in resume.',
          exact_quote: null,
          status: 'completed',
        })
        .match({ folder_id, resume_id, criteria_unit_id: criterion.id })
      return
    }

    // Hand off to Inference Scorer
    await runInferenceScorer({
      folder_id,
      resume_id,
      criterion,
      chunks: matches.map((m) => m.chunk_text),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('evaluations')
      .update({ status: 'failed', error_message: message })
      .match({ folder_id, resume_id, criteria_unit_id: criterion.id })
  }
}
