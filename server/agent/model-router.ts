import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import { credentialManager } from '../api/credential-manager.js'
import type {
  ModelProfile,
  AIProviderName,
  ProviderHealth,
  ModelTelemetryRecord,
} from '../types.js'

export interface ModelCallOptions {
  profile?: ModelProfile
  systemInstruction?: string
  toolsConfig?: unknown[]
  temperature?: number
}

export interface ModelSelectionResult {
  provider: AIProviderName
  modelName: string
  fallbackChain: Array<{ provider: AIProviderName; modelName: string }>
}

export class ModelRouter {
  private geminiClient: GoogleGenAI | null = null
  private anthropicClient: Anthropic | null = null
  private health: Map<AIProviderName, ProviderHealth> = new Map()
  private telemetryLogs: ModelTelemetryRecord[] = []

  constructor() {
    this.initProviders()
  }

  public initProviders() {
    // 1. Google Gemini
    const geminiKey = process.env.GEMINI_API_KEY || credentialManager.getCredential('gemini-api')?.apiKey
    if (geminiKey) {
      try {
        this.geminiClient = new GoogleGenAI({ apiKey: geminiKey })
        this.health.set('gemini', {
          name: 'gemini',
          available: true,
          latencyMs: 120,
          recentErrors: 0,
          lastChecked: Date.now(),
        })
      } catch {}
    } else {
      this.health.set('gemini', {
        name: 'gemini',
        available: false,
        latencyMs: 0,
        recentErrors: 0,
        lastChecked: Date.now(),
      })
    }

    // 2. Anthropic Claude
    const anthropicKey = process.env.ANTHROPIC_API_KEY || credentialManager.getCredential('anthropic-api')?.apiKey
    if (anthropicKey) {
      try {
        this.anthropicClient = new Anthropic({ apiKey: anthropicKey })
        this.health.set('anthropic', {
          name: 'anthropic',
          available: true,
          latencyMs: 250,
          recentErrors: 0,
          lastChecked: Date.now(),
        })
      } catch {}
    } else {
      this.health.set('anthropic', {
        name: 'anthropic',
        available: false,
        latencyMs: 0,
        recentErrors: 0,
        lastChecked: Date.now(),
      })
    }

    // 3. OpenAI
    const openAiKey = process.env.OPENAI_API_KEY || credentialManager.getCredential('openai-api')?.apiKey
    this.health.set('openai', {
      name: 'openai',
      available: Boolean(openAiKey),
      latencyMs: openAiKey ? 200 : 0,
      recentErrors: 0,
      lastChecked: Date.now(),
    })

    // 4. Groq
    const groqKey = process.env.GROQ_API_KEY || credentialManager.getCredential('groq-api')?.apiKey
    this.health.set('groq', {
      name: 'groq',
      available: Boolean(groqKey),
      latencyMs: groqKey ? 80 : 0,
      recentErrors: 0,
      lastChecked: Date.now(),
    })

    // 5. Mistral
    const mistralKey = process.env.MISTRAL_API_KEY || credentialManager.getCredential('mistral-api')?.apiKey
    this.health.set('mistral', {
      name: 'mistral',
      available: Boolean(mistralKey),
      latencyMs: mistralKey ? 180 : 0,
      recentErrors: 0,
      lastChecked: Date.now(),
    })

    // 6. OpenRouter
    const openRouterKey = process.env.OPENROUTER_API_KEY || credentialManager.getCredential('openrouter-api')?.apiKey
    this.health.set('openrouter', {
      name: 'openrouter',
      available: Boolean(openRouterKey),
      latencyMs: openRouterKey ? 220 : 0,
      recentErrors: 0,
      lastChecked: Date.now(),
    })
  }

  public getHealthReport(): ProviderHealth[] {
    this.initProviders()
    return Array.from(this.health.values())
  }

  /**
   * Task-specific model routing based on workload profile and provider health.
   */
  public selectModel(profile: ModelProfile = 'GENERAL'): ModelSelectionResult {
    this.initProviders()
    const chain: Array<{ provider: AIProviderName; modelName: string }> = []

    const isAvailable = (name: AIProviderName) => this.health.get(name)?.available ?? false

    // Route based on specialized profile
    switch (profile) {
      case 'CODING':
        if (isAvailable('anthropic')) chain.push({ provider: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' })
        if (isAvailable('openai')) chain.push({ provider: 'openai', modelName: 'gpt-4o' })
        if (isAvailable('gemini')) chain.push({ provider: 'gemini', modelName: process.env.GEMINI_REASONING_MODEL || 'gemini-2.5-pro' })
        if (isAvailable('groq')) chain.push({ provider: 'groq', modelName: 'llama-3.3-70b-versatile' })
        break

      case 'BUSINESS_ANALYSIS':
      case 'REASONING':
        if (isAvailable('anthropic')) chain.push({ provider: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' })
        if (isAvailable('gemini')) chain.push({ provider: 'gemini', modelName: process.env.GEMINI_REASONING_MODEL || 'gemini-2.5-pro' })
        if (isAvailable('openai')) chain.push({ provider: 'openai', modelName: 'o1' })
        break

      case 'RESEARCH':
        if (isAvailable('gemini')) chain.push({ provider: 'gemini', modelName: process.env.GEMINI_REASONING_MODEL || 'gemini-2.5-pro' })
        if (isAvailable('anthropic')) chain.push({ provider: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' })
        if (isAvailable('openrouter')) chain.push({ provider: 'openrouter', modelName: 'perplexity/sonar-reasoning' })
        break

      case 'DOCUMENT':
      case 'VISION':
        if (isAvailable('gemini')) chain.push({ provider: 'gemini', modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash' })
        if (isAvailable('anthropic')) chain.push({ provider: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' })
        if (isAvailable('openai')) chain.push({ provider: 'openai', modelName: 'gpt-4o' })
        break

      case 'FAST':
      case 'LOW_COST':
        if (isAvailable('groq')) chain.push({ provider: 'groq', modelName: 'llama-3.1-8b-instant' })
        if (isAvailable('gemini')) chain.push({ provider: 'gemini', modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash' })
        if (isAvailable('anthropic')) chain.push({ provider: 'anthropic', modelName: 'claude-3-5-haiku-20241022' })
        if (isAvailable('openai')) chain.push({ provider: 'openai', modelName: 'gpt-4o-mini' })
        break

      case 'GENERAL':
      default:
        if (isAvailable('gemini')) chain.push({ provider: 'gemini', modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash' })
        if (isAvailable('anthropic')) chain.push({ provider: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' })
        if (isAvailable('openai')) chain.push({ provider: 'openai', modelName: 'gpt-4o' })
        if (isAvailable('groq')) chain.push({ provider: 'groq', modelName: 'llama-3.3-70b-versatile' })
        break
    }

    // Default fallback if no keys configured for preferred providers
    if (chain.length === 0) {
      chain.push({
        provider: 'gemini',
        modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      })
    }

    const primary = chain[0]
    const fallbackChain = chain.slice(1)

    return {
      provider: primary.provider,
      modelName: primary.modelName,
      fallbackChain,
    }
  }

  public getGeminiClient(): GoogleGenAI | null {
    return this.geminiClient
  }

  public getAnthropicClient(): Anthropic | null {
    return this.anthropicClient
  }

  public recordSuccess(provider: AIProviderName, latencyMs: number, tokens = 0, costUsd = 0, profile: ModelProfile = 'GENERAL') {
    const h = this.health.get(provider)
    if (h) {
      h.available = true
      h.latencyMs = latencyMs
      h.recentErrors = Math.max(0, h.recentErrors - 1)
      h.lastChecked = Date.now()
    }

    this.telemetryLogs.push({
      id: `tel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      provider,
      model: this.health.get(provider)?.name || provider,
      profile,
      latencyMs,
      estimatedTokens: tokens,
      estimatedCostUsd: costUsd,
      success: true,
      fallbackEvents: 0,
    })

    if (this.telemetryLogs.length > 500) {
      this.telemetryLogs = this.telemetryLogs.slice(-250)
    }
  }

  public recordFailure(provider: AIProviderName, errorMsg?: string) {
    const h = this.health.get(provider)
    if (h) {
      h.recentErrors += 1
      if (h.recentErrors >= 3) {
        h.available = false
      }
      h.lastChecked = Date.now()
    }

    this.telemetryLogs.push({
      id: `tel-fail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      provider,
      model: provider,
      profile: 'GENERAL',
      latencyMs: 0,
      estimatedTokens: 0,
      estimatedCostUsd: 0,
      success: false,
      fallbackEvents: 1,
      error: errorMsg,
    })
  }

  public getTelemetry(limit = 50): ModelTelemetryRecord[] {
    return this.telemetryLogs.slice(-limit).reverse()
  }

  public getUsageSummary() {
    let totalTokens = 0
    let totalCostUsd = 0
    let totalCalls = 0
    let totalFailures = 0

    for (const log of this.telemetryLogs) {
      totalCalls += 1
      totalTokens += log.estimatedTokens
      totalCostUsd += log.estimatedCostUsd
      if (!log.success) totalFailures += 1
    }

    return {
      totalCalls,
      totalTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      totalFailures,
      health: this.getHealthReport(),
    }
  }
}

export const modelRouter = new ModelRouter()
