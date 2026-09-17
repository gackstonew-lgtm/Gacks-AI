import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import { credentialManager } from '../api/credential-manager.js'
import { modelRegistry } from './model-registry.js'
import { getProvider } from './providers/index.js'
import type {
  ModelProfile,
  AIProviderName,
  ProviderHealth,
  ModelTelemetryRecord,
  ModelTestResult,
  BudgetConfig,
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

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerStatus {
  state: CircuitState
  consecutiveFailures: number
  lastFailureTime: number
  cooldownMs: number
}

export class ModelRouter {
  private geminiClient: GoogleGenAI | null = null
  private anthropicClient: Anthropic | null = null
  private health: Map<AIProviderName, ProviderHealth> = new Map()
  private circuits: Map<AIProviderName, CircuitBreakerStatus> = new Map()
  private telemetryLogs: ModelTelemetryRecord[] = []
  private budgetConfig: BudgetConfig = {
    dailyLimitUsd: 25.0,
    monthlyLimitUsd: 200.0,
    maxCostPerRequestUsd: 2.0,
    alertThresholdPercent: 80,
    enforceStrictLimits: false,
  }

  private readonly FAILURE_THRESHOLD = 3
  private readonly COOLDOWN_MS = 60_000 // 60s cooldown when circuit opens

  constructor() {
    this.initProviders()
  }

  public initProviders() {
    // 1. Google Gemini
    const geminiKey = process.env.GEMINI_API_KEY || credentialManager.getCredential('gemini-api')?.apiKey || credentialManager.getCredential('gemini')?.apiKey
    if (geminiKey) {
      try {
        this.geminiClient = new GoogleGenAI({ apiKey: geminiKey })
        this.updateHealth('gemini', true, 120)
      } catch {
        this.updateHealth('gemini', false, 0)
      }
    } else {
      this.updateHealth('gemini', false, 0)
    }

    // 2. Anthropic Claude
    const anthropicKey = process.env.ANTHROPIC_API_KEY || credentialManager.getCredential('anthropic-api')?.apiKey || credentialManager.getCredential('anthropic')?.apiKey
    if (anthropicKey) {
      try {
        this.anthropicClient = new Anthropic({ apiKey: anthropicKey })
        this.updateHealth('anthropic', true, 250)
      } catch {
        this.updateHealth('anthropic', false, 0)
      }
    } else {
      this.updateHealth('anthropic', false, 0)
    }

    // 3. OpenAI
    const openAiKey = process.env.OPENAI_API_KEY || credentialManager.getCredential('openai-api')?.apiKey || credentialManager.getCredential('openai')?.apiKey
    this.updateHealth('openai', Boolean(openAiKey), openAiKey ? 200 : 0)

    // 4. Groq
    const groqKey = process.env.GROQ_API_KEY || credentialManager.getCredential('groq-api')?.apiKey || credentialManager.getCredential('groq')?.apiKey
    this.updateHealth('groq', Boolean(groqKey), groqKey ? 80 : 0)

    // 5. Mistral
    const mistralKey = process.env.MISTRAL_API_KEY || credentialManager.getCredential('mistral-api')?.apiKey || credentialManager.getCredential('mistral')?.apiKey
    this.updateHealth('mistral', Boolean(mistralKey), mistralKey ? 180 : 0)

    // 6. OpenRouter
    const openRouterKey = process.env.OPENROUTER_API_KEY || credentialManager.getCredential('openrouter-api')?.apiKey || credentialManager.getCredential('openrouter')?.apiKey
    this.updateHealth('openrouter', Boolean(openRouterKey), openRouterKey ? 220 : 0)

    // 7. DeepSeek
    const deepseekKey = process.env.DEEPSEEK_API_KEY || credentialManager.getCredential('deepseek-api')?.apiKey || credentialManager.getCredential('deepseek')?.apiKey
    this.updateHealth('deepseek', Boolean(deepseekKey), deepseekKey ? 190 : 0)

    // 8. LiteLLM Proxy Gateway
    const litellmBase = process.env.LITELLM_BASE_URL || 'http://localhost:4000'
    this.updateHealth('litellm', Boolean(litellmBase), 50)
  }

  private updateHealth(name: AIProviderName, available: boolean, latencyMs: number) {
    const existing = this.health.get(name)
    const circuit = this.getCircuit(name)

    // If circuit is open and still in cooldown, provider is not available
    let effectiveAvailable = available
    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailureTime > circuit.cooldownMs) {
        circuit.state = 'HALF_OPEN'
      } else {
        effectiveAvailable = false
      }
    }

    this.health.set(name, {
      name,
      available: effectiveAvailable,
      latencyMs,
      recentErrors: existing?.recentErrors ?? 0,
      lastChecked: Date.now(),
    })
  }

  private getCircuit(provider: AIProviderName): CircuitBreakerStatus {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, {
        state: 'CLOSED',
        consecutiveFailures: 0,
        lastFailureTime: 0,
        cooldownMs: this.COOLDOWN_MS,
      })
    }
    return this.circuits.get(provider)!
  }

  public getHealthReport(): ProviderHealth[] {
    this.initProviders()
    return Array.from(this.health.values())
  }

  public isProviderAvailable(name: AIProviderName): boolean {
    const circuit = this.getCircuit(name)
    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailureTime > circuit.cooldownMs) {
        circuit.state = 'HALF_OPEN'
        return true
      }
      return false
    }
    return this.health.get(name)?.available ?? false
  }

  /**
   * Task-specific model routing based on workload profile, capability matching, and provider health.
   */
  public selectModel(profile: ModelProfile = 'GENERAL'): ModelSelectionResult {
    this.initProviders()
    const chain: Array<{ provider: AIProviderName; modelName: string }> = []

    const isAvailable = (name: AIProviderName) => this.isProviderAvailable(name)

    // Route based on specialized profile
    switch (profile) {
      case 'CODING':
        if (isAvailable('anthropic')) chain.push({ provider: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' })
        if (isAvailable('openai')) chain.push({ provider: 'openai', modelName: 'gpt-4o' })
        if (isAvailable('openrouter')) chain.push({ provider: 'openrouter', modelName: 'anthropic/claude-3.5-sonnet' })
        if (isAvailable('gemini')) chain.push({ provider: 'gemini', modelName: process.env.GEMINI_REASONING_MODEL || 'gemini-2.5-pro' })
        if (isAvailable('groq')) chain.push({ provider: 'groq', modelName: 'llama-3.3-70b-versatile' })
        break

      case 'BUSINESS_ANALYSIS':
      case 'REASONING':
        if (isAvailable('anthropic')) chain.push({ provider: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' })
        if (isAvailable('openai')) chain.push({ provider: 'openai', modelName: 'o1' })
        if (isAvailable('openrouter')) chain.push({ provider: 'openrouter', modelName: 'perplexity/sonar-reasoning' })
        if (isAvailable('gemini')) chain.push({ provider: 'gemini', modelName: process.env.GEMINI_REASONING_MODEL || 'gemini-2.5-pro' })
        break

      case 'RESEARCH':
        if (isAvailable('openrouter')) chain.push({ provider: 'openrouter', modelName: 'perplexity/sonar-reasoning' })
        if (isAvailable('anthropic')) chain.push({ provider: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' })
        if (isAvailable('openai')) chain.push({ provider: 'openai', modelName: 'gpt-4o' })
        if (isAvailable('gemini')) chain.push({ provider: 'gemini', modelName: process.env.GEMINI_REASONING_MODEL || 'gemini-2.5-pro' })
        break

      case 'DOCUMENT':
      case 'VISION':
        if (isAvailable('anthropic')) chain.push({ provider: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' })
        if (isAvailable('openai')) chain.push({ provider: 'openai', modelName: 'gpt-4o' })
        if (isAvailable('openrouter')) chain.push({ provider: 'openrouter', modelName: 'openai/gpt-4o' })
        if (isAvailable('gemini')) chain.push({ provider: 'gemini', modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash' })
        break

      case 'FAST':
      case 'LOW_COST':
        if (isAvailable('groq')) chain.push({ provider: 'groq', modelName: 'llama-3.1-8b-instant' })
        if (isAvailable('openai')) chain.push({ provider: 'openai', modelName: 'gpt-4o-mini' })
        if (isAvailable('anthropic')) chain.push({ provider: 'anthropic', modelName: 'claude-3-5-haiku-20241022' })
        if (isAvailable('openrouter')) chain.push({ provider: 'openrouter', modelName: 'meta-llama/llama-3.3-70b-instruct' })
        if (isAvailable('gemini')) chain.push({ provider: 'gemini', modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash' })
        break

      case 'GENERAL':
      default: {
        const customDefaultProvider = process.env.DEFAULT_AI_PROVIDER
        if (customDefaultProvider && customDefaultProvider !== 'auto' && isAvailable(customDefaultProvider as AIProviderName)) {
          const modelName = process.env.DEFAULT_AI_MODEL && process.env.DEFAULT_AI_MODEL !== 'auto'
            ? process.env.DEFAULT_AI_MODEL
            : customDefaultProvider === 'anthropic' ? 'claude-3-5-sonnet-20241022'
            : customDefaultProvider === 'openai' ? 'gpt-4o'
            : customDefaultProvider === 'openrouter' ? 'anthropic/claude-3.5-sonnet'
            : process.env.GEMINI_MODEL || 'gemini-2.5-flash'
          chain.push({ provider: customDefaultProvider as AIProviderName, modelName })
        }
        if (isAvailable('anthropic') && !chain.some((c) => c.provider === 'anthropic')) {
          chain.push({ provider: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' })
        }
        if (isAvailable('openai') && !chain.some((c) => c.provider === 'openai')) {
          chain.push({ provider: 'openai', modelName: 'gpt-4o' })
        }
        if (isAvailable('openrouter') && !chain.some((c) => c.provider === 'openrouter')) {
          chain.push({ provider: 'openrouter', modelName: 'anthropic/claude-3.5-sonnet' })
        }
        if (isAvailable('gemini') && !chain.some((c) => c.provider === 'gemini')) {
          chain.push({ provider: 'gemini', modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash' })
        }
        if (isAvailable('groq') && !chain.some((c) => c.provider === 'groq')) {
          chain.push({ provider: 'groq', modelName: 'llama-3.3-70b-versatile' })
        }
        break
      }
    }

    // Append OpenRouter fallback if configured and not already in chain
    if (isAvailable('openrouter') && !chain.some((c) => c.provider === 'openrouter')) {
      chain.push({ provider: 'openrouter', modelName: 'anthropic/claude-3.5-sonnet' })
    }

    // Default fallback: pick first available healthy provider, or default descriptor
    if (chain.length === 0) {
      const availableEntry = Array.from(this.health.entries()).find(([_, h]) => h.available)
      if (availableEntry) {
        const [pName] = availableEntry
        const mName = pName === 'anthropic' ? 'claude-3-5-sonnet-20241022'
          : pName === 'openai' ? 'gpt-4o'
          : pName === 'openrouter' ? 'anthropic/claude-3.5-sonnet'
          : pName === 'groq' ? 'llama-3.3-70b-versatile'
          : process.env.GEMINI_MODEL || 'gemini-2.5-flash'
        chain.push({ provider: pName, modelName: mName })
      } else {
        chain.push({
          provider: 'anthropic',
          modelName: 'claude-3-5-sonnet-20241022',
        })
      }
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

    // Reset circuit breaker
    const circuit = this.getCircuit(provider)
    circuit.state = 'CLOSED'
    circuit.consecutiveFailures = 0

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
      h.lastChecked = Date.now()
    }

    // Trip circuit breaker if failure threshold reached
    const circuit = this.getCircuit(provider)
    circuit.consecutiveFailures += 1
    circuit.lastFailureTime = Date.now()

    if (circuit.consecutiveFailures >= this.FAILURE_THRESHOLD) {
      circuit.state = 'OPEN'
      if (h) h.available = false
      console.warn(`[ModelRouter CircuitBreaker] Circuit OPEN for provider ${provider}. Cooldown: ${circuit.cooldownMs}ms`)
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
      error: errorMsg ? String(errorMsg).slice(0, 200) : undefined,
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
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      totalFailures,
      successRate: totalCalls > 0 ? ((totalCalls - totalFailures) / totalCalls) * 100 : 100,
    }
  }

  public getBudgetConfig(): BudgetConfig {
    return { ...this.budgetConfig }
  }

  public setBudgetConfig(updates: Partial<BudgetConfig>): BudgetConfig {
    this.budgetConfig = { ...this.budgetConfig, ...updates }
    return this.budgetConfig
  }

  public checkBudget(estimatedCostUsd: number): { allowed: boolean; reason?: string } {
    if (!this.budgetConfig.enforceStrictLimits) return { allowed: true }

    const summary = this.getUsageSummary()
    if (this.budgetConfig.dailyLimitUsd && (summary.totalCostUsd + estimatedCostUsd) > this.budgetConfig.dailyLimitUsd) {
      return { allowed: false, reason: `Daily spending budget exceeded ($${this.budgetConfig.dailyLimitUsd})` }
    }
    if (this.budgetConfig.monthlyLimitUsd && (summary.totalCostUsd + estimatedCostUsd) > this.budgetConfig.monthlyLimitUsd) {
      return { allowed: false, reason: `Monthly spending budget exceeded ($${this.budgetConfig.monthlyLimitUsd})` }
    }
    if (this.budgetConfig.maxCostPerRequestUsd && estimatedCostUsd > this.budgetConfig.maxCostPerRequestUsd) {
      return { allowed: false, reason: `Single request cost limit exceeded ($${this.budgetConfig.maxCostPerRequestUsd})` }
    }

    return { allowed: true }
  }

  public async testModel(modelId: string): Promise<ModelTestResult> {
    const start = Date.now()
    const model = modelRegistry.getById(modelId)

    if (!model) {
      return {
        modelId,
        provider: 'unknown',
        status: 'ERROR',
        latencyMs: 0,
        error: 'Model not found in registry',
        testedAt: Date.now(),
      }
    }

    if (model.isLocal) {
      const adapterModule = model.provider === 'ollama'
        ? await import('./providers/ollama-adapter.js')
        : await import('./providers/openai-compatible-adapter.js')
      const adapter = model.provider === 'ollama'
        ? adapterModule.ollamaAdapter
        : adapterModule.llamaCppAdapter
      const up = await adapter.checkAvailability()
      const latency = Math.max(1, Date.now() - start)
      return {
        modelId,
        provider: model.provider,
        status: up ? 'CONNECTED' : 'NOT_CONFIGURED',
        latencyMs: latency,
        sampleResponse: up ? `Local instance active (${model.displayName})` : undefined,
        error: up ? undefined : `${model.provider} server is offline or unreachable`,
        testedAt: Date.now(),
      }
    }

    const provider = getProvider(model.provider)
    if (!provider || !provider.isConfigured()) {
      return {
        modelId,
        provider: model.provider,
        status: 'NOT_CONFIGURED',
        latencyMs: 0,
        error: `API key or credentials not configured for ${model.provider}`,
        testedAt: Date.now(),
      }
    }

    try {
      const healthCheck = await provider.checkHealth()
      if (!healthCheck.available) {
        return {
          modelId,
          provider: model.provider,
          status: 'DEGRADED',
          latencyMs: healthCheck.latencyMs,
          error: healthCheck.error || 'Provider health check failed',
          testedAt: Date.now(),
        }
      }

      // Safe non-destructive verification ping
      const ping = await provider.generate({
        model,
        messages: [{ role: 'user', content: 'Say OK' }],
        maxTokens: 10,
        temperature: 0.1,
      })

      const latency = Date.now() - start
      this.recordSuccess(model.provider, latency, ping.usage?.totalTokens || 10, ping.usage?.estimatedCostUsd || 0)

      return {
        modelId,
        provider: model.provider,
        status: 'CONNECTED',
        latencyMs: latency,
        sampleResponse: ping.content.slice(0, 50).trim() || 'OK',
        testedAt: Date.now(),
      }
    } catch (err: unknown) {
      const latency = Date.now() - start
      this.recordFailure(model.provider, String(err))
      const safeErrorMsg = String((err as Error)?.message ?? err)
        .replace(/sk-[a-zA-Z0-9_-]{10,}/g, 'sk-***')
        .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer ***')
        .slice(0, 180)

      return {
        modelId,
        provider: model.provider,
        status: 'ERROR',
        latencyMs: latency,
        error: safeErrorMsg,
        testedAt: Date.now(),
      }
    }
  }
}

export const modelRouter = new ModelRouter()
