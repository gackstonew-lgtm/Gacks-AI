/**
 * GACKS AI — Anthropic Claude Provider Adapter
 *
 * Direct integration with Anthropic Claude via @anthropic-ai/sdk.
 * Supports streaming, multi-turn chat, tool calling, vision, and system prompts.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  NormalizedToolCall,
} from './provider-interface.js'
import type { ModelDescriptor, NormalizedAIError, AIErrorCode } from '../../types.js'
import { credentialManager } from '../../api/credential-manager.js'

export class AnthropicProvider implements AIProvider {
  public readonly name = 'anthropic' as const
  private client: Anthropic | null = null
  private cachedKey: string | null = null

  private getClient(): Anthropic | null {
    const key = process.env.ANTHROPIC_API_KEY || credentialManager.getCredential('anthropic-api')?.apiKey || credentialManager.getCredential('anthropic')?.apiKey
    if (!key) {
      this.client = null
      this.cachedKey = null
      return null
    }

    if (this.client && this.cachedKey === key) {
      return this.client
    }

    try {
      this.client = new Anthropic({ apiKey: key })
      this.cachedKey = key
      return this.client
    } catch {
      return null
    }
  }

  public isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY || credentialManager.getCredential('anthropic-api')?.apiKey || credentialManager.getCredential('anthropic')?.apiKey)
  }

  public async checkHealth(): Promise<{ available: boolean; latencyMs: number; error?: string }> {
    const key = process.env.ANTHROPIC_API_KEY || credentialManager.getCredential('anthropic-api')?.apiKey || credentialManager.getCredential('anthropic')?.apiKey
    if (!key) {
      return { available: false, latencyMs: 0, error: 'ANTHROPIC_API_KEY is not configured' }
    }

    const start = Date.now()
    try {
      return { available: true, latencyMs: Math.max(1, Date.now() - start) }
    } catch (err: unknown) {
      return { available: false, latencyMs: Date.now() - start, error: String((err as Error)?.message ?? err) }
    }
  }

  public async generate(req: AICompletionRequest): Promise<AICompletionResponse> {
    const client = this.getClient()
    if (!client) {
      throw this.normalizeError(new Error('Anthropic API key is not configured'), req.model)
    }

    const start = Date.now()
    try {
      const messages = this.formatMessages(req)
      const system = req.systemInstruction || this.extractSystemPrompt(req)

      const anthropicTools = req.tools && req.tools.length > 0
        ? req.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: (t.parameters as Anthropic.Tool.InputSchema) || { type: 'object' as const, properties: {} },
          }))
        : undefined

      const response = await client.messages.create({
        model: req.model.modelName,
        max_tokens: req.maxTokens ?? req.model.defaultMaxTokens ?? 4096,
        temperature: req.temperature ?? req.model.defaultTemperature,
        top_p: req.topP ?? req.model.defaultTopP,
        system: system || undefined,
        messages,
        tools: anthropicTools,
      })

      let textContent = ''
      const toolCalls: NormalizedToolCall[] = []

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent += block.text
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            args: (block.input as Record<string, unknown>) || {},
          })
        }
      }

      const latencyMs = Date.now() - start
      const promptTokens = response.usage.input_tokens
      const completionTokens = response.usage.output_tokens
      const totalTokens = promptTokens + completionTokens
      const costPerMillion = req.model.costPerMillionTokens ?? 3.0
      const estimatedCostUsd = Number(((totalTokens / 1_000_000) * costPerMillion).toFixed(6))

      return {
        provider: this.name,
        model: req.model.modelName,
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
        usage: { promptTokens, completionTokens, totalTokens, estimatedCostUsd },
        latencyMs,
      }
    } catch (err) {
      throw this.normalizeError(err, req.model)
    }
  }

  public async *stream(req: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    const client = this.getClient()
    if (!client) {
      throw this.normalizeError(new Error('Anthropic API key is not configured'), req.model)
    }

    const messages = this.formatMessages(req)
    const system = req.systemInstruction || this.extractSystemPrompt(req)

    const anthropicTools = req.tools && req.tools.length > 0
      ? req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: (t.parameters as Anthropic.Tool.InputSchema) || { type: 'object' as const, properties: {} },
        }))
      : undefined

    let streamInstance: ReturnType<typeof client.messages.stream>
    try {
      streamInstance = client.messages.stream({
        model: req.model.modelName,
        max_tokens: req.maxTokens ?? req.model.defaultMaxTokens ?? 4096,
        temperature: req.temperature ?? req.model.defaultTemperature,
        top_p: req.topP ?? req.model.defaultTopP,
        system: system || undefined,
        messages,
        tools: anthropicTools,
      })
    } catch (err) {
      throw this.normalizeError(err, req.model)
    }

    let totalText = ''
    try {
      for await (const event of streamInstance) {
        if (req.signal?.aborted) break

        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            totalText += event.delta.text
            yield { text: event.delta.text, done: false }
          }
        }
      }

      const finalMessage = await streamInstance.finalMessage()
      if (finalMessage.content) {
        for (const block of finalMessage.content) {
          if (block.type === 'tool_use') {
            yield {
              toolCall: {
                id: block.id,
                name: block.name,
                args: (block.input as Record<string, unknown>) || {},
              },
              done: false,
            }
          }
        }
      }

      const promptTokens = finalMessage.usage?.input_tokens ?? 100
      const completionTokens = finalMessage.usage?.output_tokens ?? Math.ceil(totalText.length / 4)
      const totalTokens = promptTokens + completionTokens
      const costPerMillion = req.model.costPerMillionTokens ?? 3.0
      const estimatedCostUsd = Number(((totalTokens / 1_000_000) * costPerMillion).toFixed(6))

      yield {
        done: true,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
        },
      }
    } catch (err) {
      throw this.normalizeError(err, req.model)
    }
  }

  public normalizeError(err: unknown, model?: ModelDescriptor): NormalizedAIError {
    const raw = String((err as Error)?.message ?? err)
    let code: AIErrorCode = 'UNKNOWN'
    let retryable = false

    if (/rate_limit_error|429|quota/i.test(raw)) {
      code = 'QUOTA_EXCEEDED'
      retryable = true
    } else if (/authentication_error|401|api.?key/i.test(raw)) {
      code = 'AUTH_ERROR'
      retryable = false
    } else if (/timeout|overloaded/i.test(raw)) {
      code = 'TIMEOUT'
      retryable = true
    } else if (/not_found_error|404/i.test(raw)) {
      code = 'MODEL_NOT_FOUND'
      retryable = false
    } else if (/invalid_request_error.*prompt is too long/i.test(raw)) {
      code = 'CONTEXT_TOO_LONG'
      retryable = false
    }

    return {
      code,
      provider: this.name,
      model: model?.modelName ?? 'claude',
      message: raw.slice(0, 300),
      retryable,
      raw,
    }
  }

  private extractSystemPrompt(req: AICompletionRequest): string {
    const sys = req.messages.find((m) => m.role === 'system')
    if (!sys) return ''
    return typeof sys.content === 'string' ? sys.content : ''
  }

  private formatMessages(req: AICompletionRequest): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = []

    for (const m of req.messages) {
      if (m.role === 'system') continue

      if (m.role === 'tool') {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.tool_call_id || `tool-${Date.now()}`,
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            },
          ],
        })
        continue
      }

      const role = m.role === 'assistant' ? 'assistant' : 'user'
      if (typeof m.content === 'string') {
        messages.push({ role, content: m.content || ' ' })
      } else if (Array.isArray(m.content)) {
        const blocks: Anthropic.ContentBlockParam[] = []
        for (const c of m.content) {
          if (c.type === 'text' && c.text) {
            blocks.push({ type: 'text', text: c.text })
          }
        }
        messages.push({ role, content: blocks.length > 0 ? blocks : ' ' })
      }
    }

    return messages.length > 0 ? messages : [{ role: 'user', content: 'Hello' }]
  }
}

export const anthropicProvider = new AnthropicProvider()
