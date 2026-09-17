/**
 * GACKS AI — Unified AI Provider Interface & Contract
 *
 * Defines the common abstraction for all cloud and local AI providers:
 *   - Google Gemini
 *   - Anthropic Claude
 *   - OpenAI
 *   - OpenRouter
 *   - Local (Ollama, llama.cpp)
 */

import type {
  ModelDescriptor,
  NormalizedAIError,
  AIProviderName,
} from '../../types.js'
import type { ToolDeclaration } from '../../tools/registry.js'

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: { url: string; detail?: string }
  }>
  name?: string
  tool_call_id?: string
  tool_calls?: NormalizedToolCall[]
}

export interface NormalizedToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface AICompletionRequest {
  model: ModelDescriptor
  messages: AIMessage[]
  tools?: ToolDeclaration[]
  systemInstruction?: string
  temperature?: number
  topP?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface NormalizedAIUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
}

export interface AICompletionResponse {
  provider: AIProviderName
  model: string
  content: string
  toolCalls?: NormalizedToolCall[]
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error'
  usage?: NormalizedAIUsage
  latencyMs: number
  error?: boolean
  errorMessage?: string
}

export interface AIStreamChunk {
  text?: string
  toolCall?: NormalizedToolCall
  done: boolean
  usage?: NormalizedAIUsage
}

export interface AIProvider {
  readonly name: AIProviderName
  isConfigured(): boolean
  checkHealth(): Promise<{ available: boolean; latencyMs: number; error?: string }>
  generate(request: AICompletionRequest): Promise<AICompletionResponse>
  stream(request: AICompletionRequest): AsyncGenerator<AIStreamChunk>
  normalizeError(err: unknown, model?: ModelDescriptor): NormalizedAIError
}
