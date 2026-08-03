import type Anthropic from '@anthropic-ai/sdk'
import type { MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/beta/prompt-caching/messages'
import type { ChatProvider, ChatRequest, ChatResult, ChatUsage } from '../types'
import { AiProviderError, normalizeError } from '../errors'

type BetaMessageParam = MessageCreateParamsBase['messages'][number]
type BetaTextBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
type UsageWithCache = { cache_read_input_tokens: number | null; cache_creation_input_tokens: number | null }

export class AnthropicChatProvider implements ChatProvider {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
    private readonly logPrompts: boolean
  ) {}

  async complete(req: ChatRequest): Promise<ChatResult> {
    try {
      const messages: BetaMessageParam[] = req.messages.map((m) => ({
        role: m.role,
        content: m.cacheBoundary
          ? ([{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }] as BetaTextBlock[])
          : m.content,
      }))

      const response = await this.client.beta.promptCaching.messages.create({
        model: this.model,
        max_tokens: req.maxTokens,
        messages,
        ...(req.system
          ? { system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } } as BetaTextBlock] }
          : {}),
      })

      if (this.logPrompts) console.log('[ai-provider:anthropic] response', response)

      const block = response.content[0]
      if (block?.type !== 'text') {
        throw new AiProviderError('INVALID_RESPONSE', 'Anthropic response contained no text block')
      }

      return { text: block.text, meta: { provider: 'anthropic', model: this.model, usage: buildUsage(response.usage) } }
    } catch (err) {
      throw normalizeError(err, 'anthropic')
    }
  }
}

function buildUsage(usage: { input_tokens: number; output_tokens: number } & UsageWithCache): ChatUsage {
  const result: ChatUsage = {
    promptTokens: usage.input_tokens,
    completionTokens: usage.output_tokens,
  }
  if (usage.cache_read_input_tokens !== null) result.cacheReadTokens = usage.cache_read_input_tokens
  if (usage.cache_creation_input_tokens !== null) result.cacheWriteTokens = usage.cache_creation_input_tokens
  return result
}
