import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from './env'
import { logger } from './logger'
import type { ScorerResult } from '@/types/database'

function getModel() {
  return new GoogleGenerativeAI(env.GEMINI_API_KEY).getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })
}

export async function scoreWithGemini(
  criteriaName: string,
  criteriaPrompt: string,
  resumeChunks: string[]
): Promise<ScorerResult> {
  const context = resumeChunks.join('\n\n---\n\n')
  // JSON.stringify prevents prompt injection via crafted criterion names/prompts
  const prompt = `
You are a technical recruiter evaluating a resume against a specific criterion.

Criterion: ${JSON.stringify(criteriaName)}
Evaluation prompt: ${JSON.stringify(criteriaPrompt)}

Resume excerpts:
${context}

Respond with a JSON object matching this schema exactly:
{
  "score": <integer 0-100>,
  "justification": "<one or two sentences explaining the score>",
  "exact_quote": "<verbatim text from the resume supporting the score, or null if none>"
}
`
  const result = await getModel().generateContent(prompt)
  const raw = result.response.text()
  try {
    return JSON.parse(raw) as ScorerResult
  } catch {
    logger.error('gemini: failed to parse JSON response', { raw: raw.slice(0, 200) } as Record<string, unknown>)
    return {
      score: 0,
      justification: 'Scoring model returned an unreadable response.',
      exact_quote: null,
    }
  }
}
