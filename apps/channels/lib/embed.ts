import { callGuardianTool, isGuardianConfigured } from '@/lib/guardian'

const MODEL = 'nomic-embed-text'
const MAX_PROMPT_BYTES = 30 * 1024 // stay under Guardian's 32KB cap

export async function embedText(text: string): Promise<number[] | null> {
  if (!isGuardianConfigured()) return null

  // Truncate to cap — rough byte estimate; nomic context is 8K tokens
  const prompt = text.length > MAX_PROMPT_BYTES
    ? text.slice(0, MAX_PROMPT_BYTES)
    : text

  try {
    const result = await callGuardianTool('embed-text', { model: MODEL, prompt }) as {
      embedding: number[]; dimensions: number
    }
    if (!Array.isArray(result.embedding) || result.embedding.length !== 768) {
      console.error('[embed] unexpected embedding shape:', result.dimensions)
      return null
    }
    return result.embedding
  } catch (err) {
    console.error('[embed] embed-text failed:', err)
    return null
  }
}

// Format a float[] as the postgres vector literal "[0.1,0.2,...]"
export function pgVector(v: number[]): string {
  return '[' + v.join(',') + ']'
}
