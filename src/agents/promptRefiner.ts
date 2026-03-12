/**
 * Prompt Refiner Agent — Clarification Layer
 * Analyses a raw criteria description and generates follow-up questions
 * to help the recruiter sharpen their AI-powered evaluation prompt.
 * Returns a refined prompt once the recruiter answers the questions.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '@/lib/env'

function getModel() {
  return new GoogleGenerativeAI(env.GEMINI_API_KEY).getGenerativeModel({
    model: 'gemini-1.5-flash',
  })
}

export interface ClarificationQuestion {
  id: string
  question: string
}

export interface RefinementInput {
  criteriaName: string
  rawDescription: string
  answers?: Record<string, string> // question id → answer
}

export interface RefinementOutput {
  questions?: ClarificationQuestion[]
  refinedPrompt?: string
}

/**
 * Phase 1: Generate clarifying questions for a vague criteria description.
 */
export async function generateClarifyingQuestions(
  criteriaName: string,
  rawDescription: string
): Promise<ClarificationQuestion[]> {
  const prompt = `
You are helping a recruiter refine a resume evaluation criterion into a precise AI prompt.

Criterion name: "${criteriaName}"
Raw description: "${rawDescription}"

Generate 2-4 short clarifying questions that would help make this criterion more precise and measurable.
Respond with a JSON array:
[{ "id": "q1", "question": "..." }, ...]
`
  const result = await getModel().generateContent(prompt)
  const raw = result.response.text()
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Failed to parse clarifying questions.')
  return JSON.parse(jsonMatch[0]) as ClarificationQuestion[]
}

/**
 * Phase 2: Build a refined evaluation prompt from the recruiter's answers.
 */
export async function buildRefinedPrompt(
  input: RefinementInput
): Promise<string> {
  const { criteriaName, rawDescription, answers = {} } = input

  const answersText = Object.entries(answers)
    .map(([id, ans]) => `${id}: ${ans}`)
    .join('\n')

  const prompt = `
You are writing a precise prompt for an AI resume evaluator.

Criterion: "${criteriaName}"
Original description: "${rawDescription}"
Recruiter answers:
${answersText || '(none provided)'}

Write a single, clear evaluation prompt (2-4 sentences) that an AI can use to score a resume
on this criterion from 0-100. Be specific about what evidence to look for.
Return only the prompt text, no extra commentary.
`
  const result = await getModel().generateContent(prompt)
  return result.response.text().trim()
}

/**
 * Combined entry point: returns questions on first call,
 * returns a refined prompt when answers are provided.
 */
export async function refinePrompt(
  input: RefinementInput
): Promise<RefinementOutput> {
  if (!input.answers || Object.keys(input.answers).length === 0) {
    const questions = await generateClarifyingQuestions(
      input.criteriaName,
      input.rawDescription
    )
    return { questions }
  }

  const refinedPrompt = await buildRefinedPrompt(input)
  return { refinedPrompt }
}
