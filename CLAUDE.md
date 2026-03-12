# TAMI v2 — Claude Code Configuration

## Project Overview
**TAMI v2** (Technical Applicant Match Intelligence) is a RAG-based resume screening app for employers/recruiters. Applicants have **no system access**.

## Architecture
- **Framework**: Next.js 15, App Router, TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL) + `pgvector` extension for semantic search
- **Auth**: Supabase Auth (recruiter accounts only)
- **Storage**: Supabase Storage — 5 MB / 50 pages max per file
- **AI — Embeddings**: OpenAI `text-embedding-3-small` (1536-dim vectors)
- **AI — Inference**: Google Gemini 1.5 Flash (structured JSON output)

## Multi-Agent Logic
| Agent | Responsibility |
|---|---|
| **Orchestrator** | Folder state management, weight validation (must sum to 100%) |
| **RAG Analyst** | PDF/DOCX parsing, pgvector similarity retrieval. If similarity < threshold → score = 0, skip LLM |
| **Inference Scorer** | Consumes RAG chunks → returns `{ score, justification, exact_quote }` |
| **Prompt Refiner** | Clarification layer; asks follow-up Qs to sharpen AI-powered criteria prompts |

## Database Tables (summary)
- `resumes` — unique file storage + raw text + embedding chunks
- `folders` — recruiter-owned org units
- `folder_resumes` — many-to-many join (deduplication)
- `criteria_units` — evaluation rules with `name`, `is_ai_powered`, `weight`, `evaluation_type`
- `evaluations` — AI results: `score (0-100)`, `justification`, `exact_quote`

## Coding Conventions
1. **File length**: ≤ 150 lines per file; split larger modules.
2. **Types**: Define all DB types in `src/types/database.ts`; import, never inline.
3. **Server vs. Client**: Use Server Components by default; add `'use client'` only when required.
4. **API routes**: Live in `src/app/api/`; validate inputs with Zod before any DB call.
5. **Supabase client**: Use `createServerClient` in server components/routes; `createBrowserClient` in client components.
6. **Error handling**: Never swallow errors silently; surface structured `{ error, code }` responses.
7. **Environment variables**: Access only via `src/lib/env.ts` — never call `process.env` directly elsewhere.
8. **No magic numbers**: Define constants in `src/lib/constants.ts`.
9. **Plan-Test-Code loop**: Write a failing test in `tests/` before implementing any feature or fix.
10. **Commits**: Conventional Commits format (`feat:`, `fix:`, `test:`, `chore:`).

## Key Constants (defined in `src/lib/constants.ts`)
```ts
MAX_FILE_SIZE_MB = 5
MAX_FILE_PAGES = 50
EMBEDDING_MODEL = 'text-embedding-3-small'
EMBEDDING_DIMENSIONS = 1536
SIMILARITY_THRESHOLD = 0.75   // below this → score = 0, skip LLM
CRITERIA_WEIGHT_TOTAL = 100
```

## Directory Structure
```
src/
  app/          # Next.js App Router pages & API routes
  components/   # React components
  lib/          # Utilities: supabase.ts, openai.ts, gemini.ts, env.ts, constants.ts
  types/        # database.ts and shared interfaces
  agents/       # orchestrator.ts, ragAnalyst.ts, inferenceScorer.ts, promptRefiner.ts
tests/
  unit/
  integration/
  e2e/          # Playwright tests
docs/
  testing-rules.md
```
