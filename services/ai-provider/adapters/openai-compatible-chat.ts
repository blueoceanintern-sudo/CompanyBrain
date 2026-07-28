import type OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { ChatProvider, ChatRequest, ChatResult, ChatUsage } from '../types'
import { AiProviderError, normalizeError } from '../errors'

// Covers both real OpenAI and any OpenAI-compatible runtime (Ollama, vLLM,
// LM Studio, llama.cpp server, ...) — the only difference is the client's
// baseURL, set by the factory. Prompt-cache boundaries are ignored here:
// OpenAI caches automatically server-side, and most local runtimes have no
// caching concept at all — silently degrading is the correct behavior.
export class OpenAiCompatibleChatProvider implements ChatProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly logPrompts: boolean
  ) {}

  async complete(req: ChatRequest): Promise<ChatResult> {
    try {
      const messages: ChatCompletionMessageParam[] = []
      if (req.system) messages.push({ role: 'system', content: req.system })
      for (const m of req.messages) messages.push({ role: m.role, content: m.content })

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: req.maxTokens,
        messages,
      })

      if (this.logPrompts) console.log('[ai-provider:openai-compatible] response', response)

      const text = response.choices[0]?.message?.content
      if (!text) {
        throw new AiProviderError('INVALID_RESPONSE', 'Chat response contained no content')
      }

      return { text, meta: { provider: 'openai-compatible', model: this.model, usage: buildUsage(response.usage) } }
    } catch (err) {
      throw normalizeError(err, 'openai-compatible chat')
    }
  }
}

function buildUsage(usage: { prompt_tokens: number; completion_tokens: number } | undefined): ChatUsage {
  if (!usage) return {}
  return { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens }
}
