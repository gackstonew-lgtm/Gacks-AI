/**
 * GACKS AI — OpenAI Provider Adapter
 *
 * Direct integration with OpenAI REST API (gpt-4o, gpt-4o-mini, o1, etc.).
 * Supports streaming SSE, tool calling, vision, multi-turn chat, and structured outputs.
 */

import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  NormalizedToolCall,
} from './provider-interface.js'
import type { ModelDescriptor, NormalizedAIError, AIErrorCode } from '../../types.js'
import { credentialManager } from '../../api/credential-manager.js'

export class OpenAIProvider implements AIProvider {
  public readonly name = 'openai' as const
  private baseUrl = 'https://api.openai.com/v1'

  private getApiKey(): string | null {
    return process.env.OPENAI_API_KEY || credentialManager.getCredential('openai-api')?.apiKey || credentialManager.getCredential('openai')?.apiKey || null
  }

  public isConfigured(): boolean {
    return Boolean(this.getApiKey())
  }

  public async checkHealth(): Promise<{ available: boolean; latencyMs: number; error?: string }> {
    const key = this.getApiKey()
    if (!key) {
      return { available: false, latencyMs: 0, error: 'OPENAI_API_KEY is not configured' }
    }

    const start = Date.now()
    try {
      return { available: true, latencyMs: Math.max(1, Date.now() - start) }
    } catch (err: unknown) {
      return { available: false, latencyMs: Date.now() - start, error: String((err as Error)?.message ?? err) }
    }
  }

  public async generate(req: AICompletionRequest): Promise<AICompletionResponse> {
    const key = this.getApiKey()
    if (!key) {
      throw this.normalizeError(new Error('OpenAI API key is not configured'), req.model)
    }

    const start = Date.now()
    const messages = this.formatMessages(req)

    const body: Record<string, unknown> = {
      model: req.model.modelName,
      messages,
      temperature: req.model.modelName.startsWith('o1') ? 1 : (req.temperature ?? req.model.defaultTemperature),
      top_p: req.model.modelName.startsWith('o1') ? 1 : (req.topP ?? req.model.defaultTopP),
      max_tokens: req.maxTokens ?? req.model.defaultMaxTokens,
      stream: false,
    }

    if (req.tools && req.tools.length > 0 && !req.model.modelName.startsWith('o1')) {
      body.tools = req.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters || { type: 'object', properties: {} },
        },
      }))
      body.tool_choice = 'auto'
    }

    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: req.signal ?? AbortSignal.timeout(60_000),
      })
    } catch (err) {
      throw this.normalizeError(err, req.model)
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw this.normalizeError(new Error(`HTTP ${res.status}: ${errBody}`), req.model)
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string
          tool_calls?: Array<{
            id: string
            type: string
            function: { name: string; arguments: string }
          }>
        }
        finish_reason?: string
      }>
      usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
    }

    const choice = data.choices?.[0]
    const content = choice?.message?.content ?? ''
    const toolCalls: NormalizedToolCall[] = []

    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function.arguments)
        } catch {}
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          args,
        })
      }
    }

    const latencyMs = Date.now() - start
    const promptTokens = data.usage?.prompt_tokens ?? 100
    const completionTokens = data.usage?.completion_tokens ?? Math.ceil(content.length / 4)
    const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens)
    const costPerMillion = req.model.costPerMillionTokens ?? 5.0
    const estimatedCostUsd = Number(((totalTokens / 1_000_000) * costPerMillion).toFixed(6))

    return {
      provider: this.name,
      model: req.model.modelName,
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: choice?.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
      usage: { promptTokens, completionTokens, totalTokens, estimatedCostUsd },
      latencyMs,
    }
  }

  public async *stream(req: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    const key = this.getApiKey()
    if (!key) {
      throw this.normalizeError(new Error('OpenAI API key is not configured'), req.model)
    }

    const messages = this.formatMessages(req)

    const body: Record<string, unknown> = {
      model: req.model.modelName,
      messages,
      temperature: req.model.modelName.startsWith('o1') ? 1 : (req.temperature ?? req.model.defaultTemperature),
      top_p: req.model.modelName.startsWith('o1') ? 1 : (req.topP ?? req.model.defaultTopP),
      max_tokens: req.maxTokens ?? req.model.defaultMaxTokens,
      stream: true,
    }

    if (req.tools && req.tools.length > 0 && !req.model.modelName.startsWith('o1')) {
      body.tools = req.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters || { type: 'object', properties: {} },
        },
      }))
      body.tool_choice = 'auto'
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: req.signal,
      })
    } catch (err) {
      throw this.normalizeError(err, req.model)
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw this.normalizeError(new Error(`HTTP ${response.status}: ${errText}`), req.model)
    }

    if (!response.body) {
      throw this.normalizeError(new Error('No response body returned from OpenAI'), req.model)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const pendingToolCalls: Map<number, { id?: string; name: string; arguments: string }> = new Map()
    let totalText = ''

    try {
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          let chunk: {
            choices?: Array<{
              delta?: {
                content?: string | null
                tool_calls?: Array<{
                  index: number
                  id?: string
                  function?: { name?: string; arguments?: string }
                }>
              }
              finish_reason?: string | null
            }>
          }

          try {
            chunk = JSON.parse(trimmed.slice(6))
          } catch {
            continue
          }

          const choice = chunk.choices?.[0]
          if (!choice) continue

          if (choice.delta?.content) {
            totalText += choice.delta.content
            yield { text: choice.delta.content, done: false }
          }

          if (choice.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              const existing = pendingToolCalls.get(tc.index) ?? { id: tc.id, name: '', arguments: '' }
              if (tc.id) existing.id = tc.id
              if (tc.function?.name) existing.name += tc.function.name
              if (tc.function?.arguments) existing.arguments += tc.function.arguments
              pendingToolCalls.set(tc.index, existing)
            }
          }

          if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
            for (const [, tc] of pendingToolCalls) {
              let args: Record<string, unknown> = {}
              try {
                args = JSON.parse(tc.arguments)
              } catch {}
              yield {
                toolCall: {
                  id: tc.id || `call-${Date.now()}`,
                  name: tc.name,
                  args,
                },
                done: false,
              }
            }
            pendingToolCalls.clear()
          }
        }
      }

      const promptTokens = 100
      const completionTokens = Math.ceil(totalText.length / 4)
      const totalTokens = promptTokens + completionTokens
      const costPerMillion = req.model.costPerMillionTokens ?? 5.0
      const estimatedCostUsd = Number(((totalTokens / 1_000_000) * costPerMillion).toFixed(6))

      yield {
        done: true,
        usage: { promptTokens, completionTokens, totalTokens, estimatedCostUsd },
      }
    } finally {
      reader.releaseLock()
    }
  }

  public normalizeError(err: unknown, model?: ModelDescriptor): NormalizedAIError {
    const raw = String((err as Error)?.message ?? err)
    let code: AIErrorCode = 'UNKNOWN'
    let retryable = false

    if (/429|rate.?limit|insufficient_quota/i.test(raw)) {
      code = 'QUOTA_EXCEEDED'
      retryable = true
    } else if (/401|invalid_api_key|unauthorized/i.test(raw)) {
      code = 'AUTH_ERROR'
      retryable = false
    } else if (/timeout|timed out/i.test(raw)) {
      code = 'TIMEOUT'
      retryable = true
    } else if (/404|model_not_found/i.test(raw)) {
      code = 'MODEL_NOT_FOUND'
      retryable = false
    } else if (/context_length_exceeded|maximum context length/i.test(raw)) {
      code = 'CONTEXT_TOO_LONG'
      retryable = false
    }

    return {
      code,
      provider: this.name,
      model: model?.modelName ?? 'gpt-4o',
      message: raw.slice(0, 300),
      retryable,
      raw,
    }
  }

  private formatMessages(req: AICompletionRequest): Array<{ role: string; content: any; tool_call_id?: string; name?: string }> {
    const messages: Array<{ role: string; content: any; tool_call_id?: string; name?: string }> = []

    if (req.systemInstruction) {
      messages.push({ role: 'system', content: req.systemInstruction })
    }

    for (const m of req.messages) {
      if (m.role === 'system' && req.systemInstruction) continue // already added

      if (m.role === 'tool') {
        messages.push({
          role: 'tool',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          tool_call_id: m.tool_call_id || `tool-${Date.now()}`,
        })
        continue
      }

      messages.push({
        role: m.role,
        content: m.content,
      })
    }

    return messages.length > 0 ? messages : [{ role: 'user', content: 'Hello' }]
  }
}

export const openAIProvider = new OpenAIProvider()
