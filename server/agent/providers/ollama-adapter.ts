/**
 * GACKS AI — Ollama Provider Adapter (Phase 6, 17-19)
 *
 * Connects to a locally-running Ollama instance (default: http://localhost:11434).
 * Normalizes streaming and tool-calling format to match the orchestrator's
 * provider-neutral interface.
 *
 * Ollama uses the OpenAI-compatible /api/chat endpoint.
 * No data leaves the device when this adapter is active.
 */

import type { ModelDescriptor, NormalizedAIError, AIErrorCode } from '../../types.js'

export interface NormalizedStreamChunk {
  text?: string
  toolCall?: { name: string; args: Record<string, unknown> }
  done: boolean
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{
    function: { name: string; arguments: string }
  }>
}

export interface OllamaTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export class OllamaAdapter {
  private baseUrl: string
  private isAvailable: boolean | null = null
  private lastCheck = 0
  private readonly CHECK_INTERVAL_MS = 30_000

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '')
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
      const res = await fetch(`${this.baseUrl}/api/version`, { signal: AbortSignal.timeout(3000) })
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
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return []
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      return (data.models ?? []).map((m) => m.name)
    } catch {
      return []
    }
  }

  public async pullModel(modelName: string, onProgress?: (pct: number) => void): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
      })
      if (!res.ok || !res.body) return false

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as {
              status?: string
              completed?: number
              total?: number
            }
            if (parsed.completed !== undefined && parsed.total && parsed.total > 0 && onProgress) {
              onProgress(Math.round((parsed.completed / parsed.total) * 100))
            }
          } catch { /* ignore parse errors in stream */ }
        }
      }
      return true
    } catch {
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // Streaming Inference
  // ---------------------------------------------------------------------------

  public async *streamChat(
    model: ModelDescriptor,
    messages: OllamaMessage[],
    tools?: OllamaTool[],
    signal?: AbortSignal,
  ): AsyncGenerator<NormalizedStreamChunk> {
    const body: Record<string, unknown> = {
      model: model.modelName,
      messages,
      stream: true,
      options: {
        temperature: model.defaultTemperature,
        top_p: model.defaultTopP,
        num_predict: model.defaultMaxTokens,
      },
    }

    if (tools && tools.length > 0) {
      body.tools = tools
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean)
        for (const line of lines) {
          let parsed: {
            message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string | Record<string, unknown> } }> }
            done?: boolean
          }
          try {
            parsed = JSON.parse(line)
          } catch {
            continue
          }

          // Text delta
          if (parsed.message?.content) {
            yield { text: parsed.message.content, done: false }
          }

          // Tool calls
          if (parsed.message?.tool_calls && parsed.message.tool_calls.length > 0) {
            for (const tc of parsed.message.tool_calls) {
              let args: Record<string, unknown> = {}
              if (typeof tc.function.arguments === 'string') {
                try { args = JSON.parse(tc.function.arguments) } catch { /* ok */ }
              } else {
                args = tc.function.arguments as Record<string, unknown>
              }
              yield { toolCall: { name: tc.function.name, args }, done: false }
            }
          }

          if (parsed.done) {
            yield { done: true }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // ---------------------------------------------------------------------------
  // Non-streaming completion (for embeddings / simple completions)
  // ---------------------------------------------------------------------------

  public async complete(
    model: ModelDescriptor,
    messages: OllamaMessage[],
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.modelName,
        messages,
        stream: false,
        options: {
          temperature: model.defaultTemperature,
          top_p: model.defaultTopP,
          num_predict: model.defaultMaxTokens,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!response.ok) {
      throw this.normalizeError(new Error(`HTTP ${response.status}`), model)
    }

    const data = (await response.json()) as { message?: { content?: string } }
    return data.message?.content ?? ''
  }

  // ---------------------------------------------------------------------------
  // Embedding
  // ---------------------------------------------------------------------------

  public async embed(modelName: string, text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, input: text }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return []
    const data = (await response.json()) as { embeddings?: number[][] }
    return data.embeddings?.[0] ?? []
  }

  // ---------------------------------------------------------------------------
  // Error normalization
  // ---------------------------------------------------------------------------

  public normalizeError(err: unknown, model?: ModelDescriptor): NormalizedAIError {
    const raw = String((err as Error)?.message ?? err)
    let code: AIErrorCode = 'UNKNOWN'
    let retryable = false

    if (/econnrefused|ECONNREFUSED|connection refused/i.test(raw)) {
      code = 'PROVIDER_OFFLINE'; retryable = false
    } else if (/timeout|ETIMEDOUT/i.test(raw)) {
      code = 'TIMEOUT'; retryable = true
    } else if (/out of memory|oom|OOM/i.test(raw)) {
      code = 'OOM'; retryable = false
    } else if (/not found|404/i.test(raw)) {
      code = 'MODEL_NOT_FOUND'; retryable = false
    }

    return {
      code,
      provider: 'ollama',
      model: model?.modelName ?? 'unknown',
      message: raw.slice(0, 300),
      retryable,
      raw,
    }
  }
}

export const ollamaAdapter = new OllamaAdapter()
