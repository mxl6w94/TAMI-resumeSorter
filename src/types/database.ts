/**
 * TAMI v2 — Database TypeScript Interfaces
 * Maps 1-to-1 with the Supabase PostgreSQL schema.
 * Import from here — never define inline DB types elsewhere.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type EvaluationType = 'keyword_match' | 'semantic_match' | 'manual'

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed'

// ─── Core Tables ──────────────────────────────────────────────────────────────

/**
 * Unique resume records. A resume is stored once regardless of how many
 * folders it appears in (deduplication via folder_resumes).
 */
export interface Resume {
  id: string                    // uuid, PK
  file_hash: string             // sha256 of file bytes — uniqueness key
  file_name: string             // original upload filename
  file_url: string              // Supabase Storage public/signed URL
  file_size_bytes: number       // must be ≤ 5 MB
  page_count: number            // must be ≤ 50
  raw_text: string | null       // extracted plain text (null until parsed)
  uploaded_by: string           // uuid FK → auth.users
  created_at: string            // ISO 8601
}

/**
 * Recruiter-owned organizational units that group resumes
 * against a shared criteria set.
 */
export interface Folder {
  id: string                    // uuid, PK
  name: string
  description: string | null
  owner_id: string              // uuid FK → auth.users
  created_at: string
  updated_at: string
}

/**
 * Many-to-many join between folders and resumes.
 * Allows the same resume to appear in multiple folders without
 * duplicating stored files or text.
 */
export interface FolderResume {
  folder_id: string             // uuid FK → folders.id
  resume_id: string             // uuid FK → resumes.id
  added_at: string              // ISO 8601
}

/**
 * A single evaluation rule belonging to a folder's criteria set.
 * All criteria_units for a folder must have weights summing to exactly 100.
 */
export interface CriteriaUnit {
  id: string                    // uuid, PK
  folder_id: string             // uuid FK → folders.id
  name: string                  // e.g. "Python experience"
  description: string | null    // optional human-readable detail
  is_ai_powered: boolean        // true → RAG + LLM; false → manual rule
  weight: number                // integer 1-100; folder sum must equal 100
  evaluation_type: EvaluationType
  prompt: string | null         // refined prompt used by AI (ai-powered only)
  created_at: string
  updated_at: string
}

/**
 * AI-generated evaluation result for one (resume, criteria_unit) pair.
 * The exact_quote enables source highlighting in the UI.
 */
export interface Evaluation {
  id: string                    // uuid, PK
  folder_id: string             // uuid FK → folders.id
  resume_id: string             // uuid FK → resumes.id
  criteria_unit_id: string      // uuid FK → criteria_units.id
  score: number                 // 0-100 weighted contribution
  justification: string | null  // LLM explanation
  exact_quote: string | null    // verbatim text from resume (highlight source)
  status: AnalysisStatus
  error_message: string | null  // populated on failure
  created_at: string
  updated_at: string
}

/**
 * pgvector chunk — one semantic segment of a resume's text.
 * Used by the RAG Analyst for similarity retrieval.
 */
export interface ResumeChunk {
  id: string                    // uuid, PK
  resume_id: string             // uuid FK → resumes.id
  chunk_index: number           // order within the resume
  chunk_text: string            // 512-token segment of raw text
  embedding: number[]           // 1536-dim vector (text-embedding-3-small)
  created_at: string
}

// ─── Computed / Aggregate Types ───────────────────────────────────────────────

/**
 * Rolled-up score for a resume within a folder.
 * Computed by summing weighted evaluation scores across all criteria.
 */
export interface ResumeScore {
  resume_id: string
  folder_id: string
  total_score: number           // 0-100 (weighted sum of Evaluation.score values)
  evaluations: Evaluation[]
}

/**
 * Full folder view returned to the recruiter dashboard.
 */
export interface FolderWithCriteria extends Folder {
  criteria_units: CriteriaUnit[]
  resume_count: number
  criteria_weight_total: number // should always equal 100 for a valid folder
}

// ─── Request / Response Shapes ────────────────────────────────────────────────

/** Inference Scorer output schema (Gemini structured response). */
export interface ScorerResult {
  score: number                 // 0-100
  justification: string
  exact_quote: string | null
}

/** Payload sent to the Orchestrator to kick off an analysis run. */
export interface AnalysisRequest {
  folder_id: string
  resume_ids: string[]          // subset or all resumes in the folder
}
