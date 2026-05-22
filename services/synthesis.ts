import Anthropic from "@anthropic-ai/sdk"
import type { ServiceResult, QueryAnswer, Citation } from "../shared/types"
import { ok, err, IDK_ANSWER } from "../shared/types"

const client = new Anthropic()

export interface ChunkInput {
  id:          string
  content:     string
  org_id:      string
  document_id: string
  source_type: string
  access_tier: string
  chunk_index: number
}

export interface SynthesizeInput {
  query:  string
  chunks: ChunkInput[]
}

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildPrompt(query: string, chunks: ChunkInput[]): string {
  const sources = chunks
    .map((c, i) =>
      `[${i + 1}] (chunk_id: ${c.id}, document_id: ${c.document_id}, source_type: ${c.source_type})\n${c.content}`
    )
    .join("\n\n")

  return `You are a knowledge base assistant. Answer the user's question using ONLY the provided source documents.

Rules:
- Cite every claim using [N] superscript markers matching the source number above.
- If the answer cannot be found in the sources, respond with exactly: "I don't know, not in the knowledge base."
- Do not use knowledge outside the provided documents.
- Do not use phrases like "I think", "in general", "typically", or "my knowledge".

Source documents:
${sources}

Question: ${query}`
}

// ─── Citation parsing ──────────────────────────────────────────────────────────

function parseCitations(answer: string, chunks: ChunkInput[]): Citation[] {
  const citationPattern = /\[(\d+)\]/g
  const referenced = new Set<number>()
  let match: RegExpExecArray | null

  while ((match = citationPattern.exec(answer)) !== null) {
    const idx = parseInt(match[1], 10) - 1
    if (idx >= 0 && idx < chunks.length) {
      referenced.add(idx)
    }
  }

  return Array.from(referenced).map(idx => ({
    chunk_id:    chunks[idx].id,
    document_id: chunks[idx].document_id,
    source_type: chunks[idx].source_type,
  }))
}

// ─── Confidence from citations ─────────────────────────────────────────────────

function computeConfidence(answer: string, citations: Citation[]): number {
  if (citations.length === 0) return 0
  const baseConfidence = Math.min(0.5 + citations.length * 0.1, 0.95)
  return Math.round(baseConfidence * 100) / 100
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function synthesize(input: SynthesizeInput): Promise<ServiceResult<QueryAnswer>> {
  const { query, chunks } = input

  if (chunks.length === 0) {
    return ok(IDK_ANSWER)
  }

  try {
    const response = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [
        { role: "user", content: buildPrompt(query, chunks) },
      ],
    })

    const textBlock = response.content.find(b => b.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return err("SYNTHESIS_EMPTY", "Claude returned no text content.")
    }

    const answer = textBlock.text.trim()

    if (answer.toLowerCase().includes("i don't know") || answer.toLowerCase().includes("not in the knowledge base")) {
      return ok({ answer, citations: [], confidence: 0, missing: [] })
    }

    const citations = parseCitations(answer, chunks)

    // Unsourced answer: no citation markers found
    if (citations.length === 0) {
      return ok({
        answer:     IDK_ANSWER.answer,
        citations:  [],
        confidence: 0,
        missing:    [query],
      })
    }

    const confidence = computeConfidence(answer, citations)

    return ok({ answer, citations, confidence, missing: [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown synthesis error"
    return err("SYNTHESIS_ERROR", message)
  }
}
