/**
 * GACKS AI — Providers Registry Index
 *
 * Centralized mapping of all configured cloud and local provider adapters.
 */

import { geminiProvider } from './gemini-provider.js'
import { anthropicProvider } from './anthropic-provider.js'
import { openAIProvider } from './openai-provider.js'
import { openRouterProvider } from './openrouter-provider.js'
import { litellmProvider } from './litellm-provider.js'
import { deepSeekProvider } from './deepseek-provider.js'
import type { AIProvider } from './provider-interface.js'
import type { AIProviderName } from '../../types.js'

export * from './provider-interface.js'
export * from './gemini-provider.js'
export * from './anthropic-provider.js'
export * from './openai-provider.js'
export * from './openrouter-provider.js'
export * from './litellm-provider.js'
export * from './deepseek-provider.js'
export * from './ollama-adapter.js'
export * from './openai-compatible-adapter.js'

const providersMap: Map<string, AIProvider> = new Map([
  ['gemini', geminiProvider],
  ['anthropic', anthropicProvider],
  ['openai', openAIProvider],
  ['deepseek', deepSeekProvider],
  ['openrouter', openRouterProvider],
  ['litellm', litellmProvider],
])

export function getProvider(name: AIProviderName | string): AIProvider | undefined {
  return providersMap.get(name.toLowerCase())
}

export function getAllCloudProviders(): AIProvider[] {
  return Array.from(providersMap.values())
}
