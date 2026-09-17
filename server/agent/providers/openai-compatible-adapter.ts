/**
 * GACKS AI — Generic OpenAI-Compatible Adapter (Phase 7-8, 17-19)
 *
 * Supports any backend that exposes an OpenAI-compatible REST API:
 *   - llama.cpp server (default: http://localhost:8080)
 *   - LM Studio (default: http://localhost:1234)
 *   - vLLM
 *   - LocalAI
 *   - Any custom OpenAI-format server
 *
 * Normalizes streaming output and tool calling to the same interface
 * as OllamaAdapter so the orchestrator can treat them identically.
 */

import type { ModelDescriptor, NormalizedAIError, AIErrorCode, LocalProviderName } from '../../types.js'
import type { NormalizedStreamChunk } from './ollama-adapter.js'

export interface OpenAICompatibleMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}

export interface OpenAICompatibleTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface OpenAICompatibleConfig {
  baseUrl: string
  providerName: LocalProviderName
  apiKey?: string
  modelName?: string
}

export class OpenAICompatibleAdapter {
  private baseUrl: string
  private providerName: LocalProviderName
  private apiKey: string
  private isAvailable: boolean | null = null
  private lastCheck = 0
  private readonly CHECK_INTERVAL_MS = 30_000

  constructor(config: OpenAICompatibleConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.providerName = config.providerName
    this.apiKey = config.apiKey ?? 'local'
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  public async checkAvailability(): Promise<boolean> {
    const now = Date.now()
    if (this.isAvailable !== null && now - this.lastCheck < this.CHECK_INTERVAL_MS) {
      return this.isAvailable
    }
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      })
      this.isAvailable = res.ok
    } catch {
      this.isAvailable = false
    }
    this.lastCheck = now
    return this.isAvailable
  }

  public invalidateHealthCache(): void {
    this.isAvailable = null
    this.lastCheck = 0
  }

  // ---------------------------------------------------------------------------
  // Model Discovery
  // ---------------------------------------------------------------------------

  public async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return []
      const data = (await res.json()) as { data?: Array<{ id: string }> }
      return (data.data ?? []).map((m) => m.id)
    } catch {
      return []
    }
  }

  // ---------------------------------------------------------------------------
  // Streaming Inference
  // ---------------------------------------------------------------------------

  public async *streamChat(
    model: ModelDescriptor,
    messages: OpenAICompatibleMessage[],
    tools?: OpenAICompatibleTool[],
    signal?: AbortSignal,
  ): AsyncGenerator<NormalizedStreamChunk> {
    const body: Record<string, unknown> = {
      model: model.modelName,
      messages,
      stream: true,
      temperature: model.defaultTemperature,
      top_p: model.defaultTopP,
      max_tokens: model.defaultMaxTokens,
    }

    if (tools && tools.length > 0) {
      body.tools = tools
      body.tool_choice = 'auto'
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal,
      })
    } catch (err) {
      throw this.normalizeError(err, model)
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw this.normalizeError(new Error(`HTTP ${response.status}: ${text}`), model)
    }

    if (!response.body) {
      throw this.normalizeError(new Error('No response body'), model)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const pendingToolCalls: Map<number, { name: string; arguments: string }> = new Map()

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

          // Text delta
          if (choice.delta?.content) {
            yield { text: choice.delta.content, done: false }
          }

          // Tool call deltas (streamed incrementally)
          if (choice.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              const existing = pendingToolCalls.get(tc.index) ?? { name: '', arguments: '' }
              if (tc.function?.name) existing.name += tc.function.name
              if (tc.function?.arguments) existing.arguments += tc.function.arguments
              pendingToolCalls.set(tc.index, existing)
            }
          }

          // Flush tool calls on finish
          if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
            for (const [, tc] of pendingToolCalls) {
              let args: Record<string, unknown> = {}
              try { args = JSON.parse(tc.arguments) } catch { /* ok */ }
              yield { toolCall: { name: tc.name, args }, done: false }
            }
            pendingToolCalls.clear()
            yield { done: true }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // ---------------------------------------------------------------------------
  // Non-streaming completion
  // ---------------------------------------------------------------------------

  public async complete(
    model: ModelDescriptor,
    messages: OpenAICompatibleMessage[],
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: model.modelName,
        messages,
        stream: false,
        temperature: model.defaultTemperature,
        top_p: model.defaultTopP,
        max_tokens: model.defaultMaxTokens,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!response.ok) {
      throw this.normalizeError(new Error(`HTTP ${response.status}`), model)
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return data.choices?.[0]?.message?.content ?? ''
  }

  // ---------------------------------------------------------------------------
  // Error normalization
  // ---------------------------------------------------------------------------

  public normalizeError(err: unknown, model?: ModelDescriptor): NormalizedAIError {
    const raw = String((err as Error)?.message ?? err)
    let code: AIErrorCode = 'UNKNOWN'
    let retryable = false

    if (/econnrefused|connection refused/i.test(raw)) {
      code = 'PROVIDER_OFFLINE'; retryable = false
    } else if (/timeout|ETIMEDOUT/i.test(raw)) {
      code = 'TIMEOUT'; retryable = true
    } else if (/out of memory|oom/i.test(raw)) {
      code = 'OOM'; retryable = false
    } else if (/404|not found/i.test(raw)) {
      code = 'MODEL_NOT_FOUND'; retryable = false
    } else if (/401|unauthorized|api.?key/i.test(raw)) {
      code = 'AUTH_ERROR'; retryable = false
    } else if (/429|rate.?limit|quota/i.test(raw)) {
      code = 'QUOTA_EXCEEDED'; retryable = true
    } else if (/context.?length|too many tokens/i.test(raw)) {
      code = 'CONTEXT_TOO_LONG'; retryable = false
    }

    return {
      code,
      provider: this.providerName,
      model: model?.modelName ?? 'unknown',
      message: raw.slice(0, 300),
      retryable,
      raw,
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    }
  }
}

/** llama.cpp server adapter (default http://localhost:8080) */
export const llamaCppAdapter = new OpenAICompatibleAdapter({
  baseUrl: process.env.LLAMACPP_BASE_URL ?? 'http://localhost:8080',
  providerName: 'llamacpp',
})
