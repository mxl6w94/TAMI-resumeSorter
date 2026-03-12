import OpenAI from 'openai'
import { env } from './env'
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from './constants'

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.replace(/\n/g, ' '),
    dimensions: EMBEDDING_DIMENSIONS,
  })
  return response.data[0].embedding
}
