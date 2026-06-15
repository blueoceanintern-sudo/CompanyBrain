import Anthropic from '@anthropic-ai/sdk'
import type { SynthesisParams, ServiceResult, Citation } from '@company-brain/shared'
import { SYNTHESIS_MODEL, CITATION_EXCERPT_LENGTH } from '@company-brain/shared'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function friendlyServiceError(raw: string): string {
  if (raw.includes('401') || /api.?key|authentication|unauthorized/i.test(raw))
    return 'The answer service is not configured. Please contact your administrator.'
  if (raw.includes('429') || /rate.?limit/i.test(raw))
    return 'Too many requests. Please wait a moment and try again.'
  if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(raw))
    return 'Answer generation timed out. Please try again.'
  return 'Answer generation is temporarily unavailable. Please try again.'
}

function buildPrompt(query: string, chunks: SynthesisParams['chunks']): string {
  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] Source: ${c.filename} (${c.compartmentId})\n${c.content}`
    )
    .join('\n\n---\n\n')

  return `You are a knowledge base assistant. Answer the user's question using ONLY the provided source chunks.

Rules:
- Answer only from the provided context. Do not add information not present in the sources.
- Cite every claim using [1], [2] etc. corresponding to the numbered sources above.
- If the context does not contain enough information to answer fully, say exactly what is missing.
- Never fabricate information. If you cannot answer from the context, say so clearly.

Context:
${context}

Question: ${query}

Answer:`
}

export async function synthesizeAnswer(
  params: SynthesisParams
): Promise<ServiceResult<{ answer: string; citations: Citation[]; missing: string[] }>> {
  const { query, chunks } = params

  if (chunks.length === 0) {
    return {
      success: true,
      data: {
        answer: "I don't know — this question is not in the knowledge base.",
        citations: [],
        missing: [query],
      },
    }
  }

  try {
    const prompt = buildPrompt(query, chunks)

    const message = await anthropic.messages.create({
      model: SYNTHESIS_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const answerBlock = message.content[0]
    const answerText =
      answerBlock?.type === 'text' ? answerBlock.text : "I couldn't generate a response."

    // Build citations from chunks referenced in the answer
    const citations: Citation[] = []
    for (let i = 0; i < chunks.length; i++) {
      const marker = `[${i + 1}]`
      if (answerText.includes(marker)) {
        const chunk = chunks[i]
        if (chunk) {
          citations.push({
            index: i + 1,
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            filename: chunk.filename,
            compartment: chunk.compartmentId,
            excerpt: chunk.content.slice(0, CITATION_EXCERPT_LENGTH),
          })
        }
      }
    }

    // Extract missing from answer if mentioned
    const missing: string[] = []
    if (answerText.toLowerCase().includes('not in the knowledge base') ||
        answerText.toLowerCase().includes("i don't know") ||
        answerText.toLowerCase().includes('not available in the provided')) {
      missing.push(query)
    }

    return { success: true, data: { answer: answerText, citations, missing } }
  } catch (err) {
    console.error('[synthesis]', err)
    const raw = err instanceof Error ? err.message : ''
    const message = friendlyServiceError(raw)
    return { success: false, error: { code: 'SYNTHESIS_ERROR', message } }
  }
}
