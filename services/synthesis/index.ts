import type { SynthesisParams, ServiceResult, Citation, ConversationTurn } from '@company-brain/shared'
import { CITATION_EXCERPT_LENGTH } from '@company-brain/shared'
import { getChatProvider, AiProviderError } from '@company-brain/ai-provider'
import type { ChatMessage } from '@company-brain/ai-provider'

function friendlyServiceError(err: unknown): string {
  if (err instanceof AiProviderError) {
    switch (err.code) {
      case 'AUTH':
        return 'The answer service is not configured. Please contact your administrator.'
      case 'RATE_LIMIT':
        return 'Too many requests. Please wait a moment and try again.'
      case 'TIMEOUT':
        return 'Answer generation timed out. Please try again.'
      default:
        return 'Answer generation is temporarily unavailable. Please try again.'
    }
  }
  const raw = err instanceof Error ? err.message : ''
  if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(raw)) return 'Answer generation timed out. Please try again.'
  return 'Answer generation is temporarily unavailable. Please try again.'
}

const SYSTEM_PROMPT = `You are a knowledge base assistant. When source documents are provided, answer using ONLY those documents.

Rules:
- If the question has a simple direct answer (yes/no, a name, a number, a single fact), answer in one sentence and cite the source. Nothing more.
- If the question requires explanation, use this format:
  Answer: A clear, direct sentence that directly addresses the question.
  Reasoning:
  - Bullet points supporting the answer (maximum 7, each under 30 words). Cite each point inline using [1], [2] etc.
  Summary: A 1-2 sentence TLDR.
- Answer only from the provided context. Never fabricate information.
- If the context does not contain enough information, say exactly what is missing.
- When the user asks follow-up questions (e.g. "reframe that", "summarise it differently"), apply the request to your previous answer in this conversation.`

export async function contextualizeQuery(
  query: string,
  history: ConversationTurn[]
): Promise<string> {
  if (!history.length) return query

  const historyText = history
    .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
    .join('\n')

  try {
    const result = await getChatProvider().complete({
      maxTokens: 150,
      messages: [
        {
          role: 'user',
          content: `Given this conversation:\n${historyText}\n\nRewrite this follow-up as a standalone search query that captures full context: "${query}"\n\nOutput only the rewritten query, nothing else.`,
        },
      ],
    })
    return result.text.trim()
  } catch {
    return query
  }
}

export async function synthesizeAnswer(
  params: SynthesisParams
): Promise<ServiceResult<{ answer: string; citations: Citation[]; missing: string[] }>> {
  const { query, chunks, history } = params
  const hasHistory = !!history && history.length > 0
  const hasChunks = chunks.length > 0

  if (!hasChunks && !hasHistory) {
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
    const messages: ChatMessage[] = []

    // Inject source documents as the opening turn so they can be cached independently
    // of the conversation history. Cache hits when the same docs are retrieved (same topic).
    if (hasChunks) {
      const context = chunks
        .map((c, i) => `[${i + 1}] Source: ${c.filename} (${c.compartmentId})\n${c.content}`)
        .join('\n\n---\n\n')

      messages.push(
        {
          role: 'user',
          content: `Source documents for this session:\n\n${context}`,
          cacheBoundary: true,
        },
        {
          role: 'assistant',
          content: 'Understood. I will answer only from these source documents.',
        }
      )
    }

    // Prior conversation turns. Mark the last assistant turn so the cache prefix
    // grows incrementally each round-trip — only new turns are billed.
    if (hasHistory) {
      for (let i = 0; i < history!.length; i++) {
        const turn = history![i]
        if (!turn) continue
        const isLastAssistant = turn.role === 'assistant' && i === history!.length - 1

        messages.push({
          role: turn.role,
          content: turn.content,
          ...(isLastAssistant ? { cacheBoundary: true } : {}),
        })
      }
    }

    messages.push({ role: 'user', content: query })

    const result = await getChatProvider().complete({
      system: SYSTEM_PROMPT,
      maxTokens: 1024,
      messages,
    })

    const answerText = result.text

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

    const missing: string[] = []
    if (
      answerText.toLowerCase().includes('not in the knowledge base') ||
      answerText.toLowerCase().includes("i don't know") ||
      answerText.toLowerCase().includes('not available in the provided')
    ) {
      missing.push(query)
    }

    return { success: true, data: { answer: answerText, citations, missing } }
  } catch (err) {
    console.error('[synthesis]', err)
    const message = friendlyServiceError(err)
    return { success: false, error: { code: 'SYNTHESIS_ERROR', message } }
  }
}
