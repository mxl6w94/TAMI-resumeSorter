import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from './env'
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
  const prompt = `
You are a technical recruiter evaluating a resume against a specific criterion.

Criterion: "${criteriaName}"
Evaluation prompt: "${criteriaPrompt}"

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
  return JSON.parse(raw) as ScorerResult
}
