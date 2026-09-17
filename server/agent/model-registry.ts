/**
 * GACKS AI — Multi-Model Registry (Phase 3-5, 25-29, 33-34)
 *
 * Extensible catalog of AI models across cloud and local providers.
 * Models are never hardcoded in the orchestrator — all routing uses this registry.
 * New models can be registered at runtime via ModelDiscovery.
 */

import type {
  ModelDescriptor,
  AIProviderName,
  ModelRole,
  ModelCapability,
  PrivacyPolicy,
} from '../types.js'

export class ModelRegistry {
  private models: Map<string, ModelDescriptor> = new Map()

  constructor() {
    this.registerBuiltins()
  }

  // ---------------------------------------------------------------------------
  // Registration API
  // ---------------------------------------------------------------------------

  public register(descriptor: ModelDescriptor): void {
    if (descriptor.enabled === undefined) descriptor.enabled = true
    if (descriptor.priority === undefined) descriptor.priority = descriptor.roles.includes('REASONING') || descriptor.roles.includes('CODING') ? 9 : 5
    if (descriptor.fallbackOrder === undefined) descriptor.fallbackOrder = 1
    this.models.set(descriptor.id, descriptor)
  }

  public unregister(id: string): void {
    this.models.delete(id)
  }

  public update(id: string, updates: Partial<ModelDescriptor>): ModelDescriptor | undefined {
    const existing = this.models.get(id)
    if (!existing) return undefined
    const updated: ModelDescriptor = {
      ...existing,
      ...updates,
      id: existing.id, // preserve immutable ID
      parameters: {
        ...(existing.parameters || {}),
        ...(updates.parameters || {}),
      },
    }
    this.models.set(id, updated)
    return updated
  }

  public registerCustom(meta: Partial<ModelDescriptor> & { id: string; displayName: string; provider: AIProviderName; modelName: string }): ModelDescriptor {
    const descriptor: ModelDescriptor = {
      id: meta.id,
      displayName: meta.displayName,
      provider: meta.provider,
      modelName: meta.modelName,
      roles: meta.roles ?? ['GENERAL'],
      capabilities: meta.capabilities ?? ['text_generation', 'streaming', 'multi_turn', 'tool_calling'],
      contextWindow: meta.contextWindow ?? 128_000,
      maxOutputTokens: meta.maxOutputTokens ?? 4096,
      license: meta.license ?? 'proprietary',
      isLocal: meta.isLocal ?? false,
      requiresGpu: meta.requiresGpu ?? false,
      minVramGb: meta.minVramGb ?? 0,
      costPerMillionTokens: meta.costPerMillionTokens ?? 1.0,
      defaultTemperature: meta.defaultTemperature ?? 0.7,
      defaultTopP: meta.defaultTopP ?? 0.95,
      defaultMaxTokens: meta.defaultMaxTokens ?? 4096,
      tags: meta.tags ?? ['custom', meta.provider],
      description: meta.description ?? `Custom model ${meta.displayName} via ${meta.provider}`,
      enabled: meta.enabled ?? true,
      priority: meta.priority ?? 5,
      fallbackOrder: meta.fallbackOrder ?? 2,
      custom: true,
      parameters: meta.parameters,
    }
    this.models.set(descriptor.id, descriptor)
    return descriptor
  }

  public deleteCustom(id: string): boolean {
    const model = this.models.get(id)
    if (model && model.custom) {
      this.models.delete(id)
      return true
    }
    return false
  }

  /** Register/update a locally-discovered model from Ollama or llama.cpp */
  public registerDiscovered(
    provider: 'ollama' | 'llamacpp',
    modelName: string,
    meta: Partial<ModelDescriptor> = {},
  ): ModelDescriptor {
    const id = `${provider}:${modelName}`
    const existing = this.models.get(id)
    if (existing) return existing

    const descriptor: ModelDescriptor = {
      id,
      displayName: meta.displayName ?? modelName,
      provider,
      modelName,
      roles: meta.roles ?? ['GENERAL', 'LOCAL'],
      capabilities: meta.capabilities ?? ['text_generation', 'streaming', 'multi_turn'],
      contextWindow: meta.contextWindow ?? 4096,
      maxOutputTokens: meta.maxOutputTokens ?? 2048,
      license: meta.license ?? 'other',
      isLocal: true,
      requiresGpu: meta.requiresGpu ?? false,
      minVramGb: meta.minVramGb ?? 0,
      quantization: meta.quantization,
      sizeGb: meta.sizeGb,
      defaultTemperature: meta.defaultTemperature ?? 0.7,
      defaultTopP: meta.defaultTopP ?? 0.9,
      defaultMaxTokens: meta.defaultMaxTokens ?? 2048,
      tags: meta.tags ?? ['local', provider],
      description: meta.description ?? `Local model ${modelName} running via ${provider}`,
      version: meta.version,
      enabled: true,
      priority: 3,
      fallbackOrder: 3,
    }

    this.models.set(id, descriptor)
    return descriptor
  }

  // ---------------------------------------------------------------------------
  // Query API
  // ---------------------------------------------------------------------------

  public getById(id: string): ModelDescriptor | undefined {
    if (!id) return undefined
    return this.models.get(id) ?? this.getAll().find((m) => m.id === id || m.modelName === id || m.id.endsWith(id) || m.modelName.includes(id))
  }

  public get(id: string): ModelDescriptor | undefined {
    return this.getById(id)
  }

  public getAll(): ModelDescriptor[] {
    return Array.from(this.models.values()).filter((m) => !m.deprecated)
  }

  public getEnabled(): ModelDescriptor[] {
    return this.getAll().filter((m) => m.enabled !== false)
  }

  public getFallbackChain(primaryModelId?: string): ModelDescriptor[] {
    return this.getEnabled()
      .filter((m) => !primaryModelId || m.id !== primaryModelId)
      .sort((a, b) => (a.fallbackOrder ?? 99) - (b.fallbackOrder ?? 99) || (b.priority ?? 0) - (a.priority ?? 0))
  }

  public getByProvider(provider: AIProviderName): ModelDescriptor[] {
    return this.getAll().filter((m) => m.provider === provider)
  }

  public getByRole(role: ModelRole): ModelDescriptor[] {
    return this.getAll().filter((m) => m.roles.includes(role))
  }

  public getByCapability(cap: ModelCapability): ModelDescriptor[] {
    return this.getAll().filter((m) => m.capabilities.includes(cap))
  }

  public getLocalModels(): ModelDescriptor[] {
    return this.getAll().filter((m) => m.isLocal)
  }

  public getCloudModels(): ModelDescriptor[] {
    return this.getAll().filter((m) => !m.isLocal)
  }

  /** Return models compatible with the given privacy policy */
  public getForPrivacyPolicy(policy: PrivacyPolicy): ModelDescriptor[] {
    if (policy === 'LOCAL_ONLY') return this.getLocalModels()
    return this.getAll()
  }

  /** Return models that fit within the given VRAM budget (local only) */
  public getByVramBudget(availableGb: number): ModelDescriptor[] {
    return this.getAll().filter((m) => m.minVramGb <= availableGb)
  }

  public count(): number {
    return this.models.size
  }

  // ---------------------------------------------------------------------------
  // Built-in catalog (extensible — never exhaustive)
  // ---------------------------------------------------------------------------

  private registerBuiltins(): void {
    // --- Google Gemini (Cloud) ------------------------------------------------
    this.register({
      id: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      provider: 'gemini',
      modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      roles: ['GENERAL', 'FAST', 'VISION'],
      capabilities: ['text_generation', 'tool_calling', 'vision', 'streaming', 'long_context', 'multi_turn', 'json_mode'],
      contextWindow: 1_000_000,
      maxOutputTokens: 8192,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.075,
      defaultTemperature: 0.7,
      defaultTopP: 0.95,
      defaultMaxTokens: 4096,
      tags: ['google', 'multimodal', 'fast', 'cloud'],
      description: 'Google Gemini 2.5 Flash — fast, multimodal cloud model with 1M context window',
    })

    this.register({
      id: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      provider: 'gemini',
      modelName: process.env.GEMINI_REASONING_MODEL || 'gemini-2.5-pro',
      roles: ['REASONING', 'CODING', 'RESEARCH'],
      capabilities: ['text_generation', 'tool_calling', 'vision', 'streaming', 'long_context', 'reasoning', 'multi_turn', 'json_mode'],
      contextWindow: 2_000_000,
      maxOutputTokens: 16384,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 1.25,
      defaultTemperature: 0.5,
      defaultTopP: 0.95,
      defaultMaxTokens: 8192,
      tags: ['google', 'reasoning', 'coding', 'cloud', 'frontier'],
      description: 'Google Gemini 2.5 Pro — frontier reasoning and coding with 2M context window',
    })

    // --- Anthropic Claude (Cloud) --------------------------------------------
    this.register({
      id: 'claude-3-5-sonnet',
      displayName: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      modelName: 'claude-3-5-sonnet-20241022',
      roles: ['GENERAL', 'CODING', 'REASONING', 'AGENT'],
      capabilities: ['text_generation', 'tool_calling', 'vision', 'streaming', 'multi_turn', 'json_mode', 'code_completion'],
      contextWindow: 200_000,
      maxOutputTokens: 8192,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 3.0,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 4096,
      tags: ['anthropic', 'coding', 'agent', 'cloud'],
      description: 'Anthropic Claude 3.5 Sonnet — excellent coding and reasoning model',
    })

    this.register({
      id: 'claude-3-5-haiku',
      displayName: 'Claude 3.5 Haiku',
      provider: 'anthropic',
      modelName: 'claude-3-5-haiku-20241022',
      roles: ['FAST', 'GENERAL'],
      capabilities: ['text_generation', 'tool_calling', 'streaming', 'multi_turn', 'json_mode'],
      contextWindow: 200_000,
      maxOutputTokens: 8192,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.8,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 2048,
      tags: ['anthropic', 'fast', 'cloud', 'low-cost'],
      description: 'Anthropic Claude 3.5 Haiku — fast and affordable Claude model',
    })

    // --- OpenAI (Cloud) ------------------------------------------------------
    this.register({
      id: 'gpt-4o',
      displayName: 'GPT-4o',
      provider: 'openai',
      modelName: 'gpt-4o',
      roles: ['GENERAL', 'VISION', 'CODING'],
      capabilities: ['text_generation', 'tool_calling', 'vision', 'streaming', 'multi_turn', 'json_mode', 'code_completion'],
      contextWindow: 128_000,
      maxOutputTokens: 16384,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 5.0,
      defaultTemperature: 0.7,
      defaultTopP: 0.95,
      defaultMaxTokens: 4096,
      tags: ['openai', 'multimodal', 'cloud', 'frontier'],
      description: 'OpenAI GPT-4o — flagship multimodal model',
    })

    this.register({
      id: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      roles: ['FAST', 'GENERAL'],
      capabilities: ['text_generation', 'tool_calling', 'streaming', 'multi_turn', 'json_mode'],
      contextWindow: 128_000,
      maxOutputTokens: 16384,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.15,
      defaultTemperature: 0.7,
      defaultTopP: 0.95,
      defaultMaxTokens: 2048,
      tags: ['openai', 'fast', 'cloud', 'low-cost'],
      description: 'OpenAI GPT-4o Mini — fast, affordable GPT-4 level model',
    })

    this.register({
      id: 'o1',
      displayName: 'OpenAI o1',
      provider: 'openai',
      modelName: 'o1',
      roles: ['REASONING'],
      capabilities: ['text_generation', 'reasoning', 'multi_turn', 'json_mode'],
      contextWindow: 200_000,
      maxOutputTokens: 100_000,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 15.0,
      defaultTemperature: 1.0,
      defaultTopP: 1.0,
      defaultMaxTokens: 8192,
      tags: ['openai', 'reasoning', 'chain-of-thought', 'cloud'],
      description: 'OpenAI o1 — advanced reasoning model with chain-of-thought',
    })

    // --- Groq (Cloud ultra-fast inference) -----------------------------------
    this.register({
      id: 'groq-llama-3.3-70b',
      displayName: 'Llama 3.3 70B (Groq)',
      provider: 'groq',
      modelName: 'llama-3.3-70b-versatile',
      roles: ['GENERAL', 'FAST', 'CODING'],
      capabilities: ['text_generation', 'tool_calling', 'streaming', 'multi_turn', 'json_mode', 'code_completion'],
      contextWindow: 128_000,
      maxOutputTokens: 32768,
      license: 'llama-community',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.59,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 4096,
      tags: ['groq', 'llama', 'fast', 'cloud'],
      description: 'Meta Llama 3.3 70B running on Groq ultra-fast inference hardware',
    })

    this.register({
      id: 'groq-llama-3.1-8b',
      displayName: 'Llama 3.1 8B (Groq)',
      provider: 'groq',
      modelName: 'llama-3.1-8b-instant',
      roles: ['FAST'],
      capabilities: ['text_generation', 'streaming', 'multi_turn'],
      contextWindow: 128_000,
      maxOutputTokens: 8192,
      license: 'llama-community',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.05,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 2048,
      tags: ['groq', 'llama', 'ultra-fast', 'low-cost', 'cloud'],
      description: 'Meta Llama 3.1 8B on Groq — extremely fast and very low cost',
    })

    // --- Mistral (Cloud) -----------------------------------------------------
    this.register({
      id: 'mistral-large',
      displayName: 'Mistral Large',
      provider: 'mistral',
      modelName: 'mistral-large-latest',
      roles: ['GENERAL', 'CODING', 'REASONING'],
      capabilities: ['text_generation', 'tool_calling', 'streaming', 'multi_turn', 'json_mode', 'code_completion'],
      contextWindow: 128_000,
      maxOutputTokens: 8192,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 2.0,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 4096,
      tags: ['mistral', 'coding', 'cloud'],
      description: 'Mistral Large — flagship Mistral model for complex tasks',
    })

    // --- OpenRouter ----------------------------------------------------------
    this.register({
      id: 'openrouter-perplexity-sonar',
      displayName: 'Perplexity Sonar (OpenRouter)',
      provider: 'openrouter',
      modelName: 'perplexity/sonar-reasoning',
      roles: ['RESEARCH', 'REASONING'],
      capabilities: ['text_generation', 'streaming', 'multi_turn'],
      contextWindow: 127_000,
      maxOutputTokens: 8192,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 1.0,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 4096,
      tags: ['openrouter', 'perplexity', 'research', 'cloud'],
      description: 'Perplexity Sonar Reasoning via OpenRouter — web-grounded research model',
    })

    this.register({
      id: 'openrouter-claude-3.5-sonnet',
      displayName: 'Claude 3.5 Sonnet (OpenRouter)',
      provider: 'openrouter',
      modelName: 'anthropic/claude-3.5-sonnet',
      roles: ['CODING', 'REASONING', 'AGENT', 'GENERAL'],
      capabilities: ['text_generation', 'tool_calling', 'vision', 'streaming', 'multi_turn'],
      contextWindow: 200_000,
      maxOutputTokens: 8192,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 3.0,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 4096,
      tags: ['openrouter', 'anthropic', 'claude', 'cloud'],
      description: 'Anthropic Claude 3.5 Sonnet accessed via OpenRouter gateway',
    })

    this.register({
      id: 'openrouter-llama-3.3-70b',
      displayName: 'Llama 3.3 70B (OpenRouter)',
      provider: 'openrouter',
      modelName: 'meta-llama/llama-3.3-70b-instruct',
      roles: ['GENERAL', 'CODING', 'REASONING', 'FAST'],
      capabilities: ['text_generation', 'tool_calling', 'streaming', 'multi_turn'],
      contextWindow: 131_072,
      maxOutputTokens: 8192,
      license: 'llama-community',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.4,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 4096,
      tags: ['openrouter', 'llama', 'meta', 'cloud'],
      description: 'Meta Llama 3.3 70B Instruct via OpenRouter — fast and capable open model',
    })

    this.register({
      id: 'openrouter-gpt-4o',
      displayName: 'GPT-4o (OpenRouter)',
      provider: 'openrouter',
      modelName: 'openai/gpt-4o',
      roles: ['GENERAL', 'VISION', 'CODING'],
      capabilities: ['text_generation', 'tool_calling', 'vision', 'streaming', 'multi_turn'],
      contextWindow: 128_000,
      maxOutputTokens: 16384,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 5.0,
      defaultTemperature: 0.7,
      defaultTopP: 0.95,
      defaultMaxTokens: 4096,
      tags: ['openrouter', 'openai', 'gpt-4o', 'cloud'],
      description: 'OpenAI GPT-4o via OpenRouter gateway',
    })

    // --- LiteLLM Proxy Gateway (Unified Multimodal Routing) -------------------
    this.register({
      id: 'litellm:gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash (LiteLLM)',
      provider: 'litellm',
      modelName: 'gemini-2.5-flash',
      roles: ['GENERAL', 'FAST', 'AGENT', 'CODING'],
      capabilities: ['text_generation', 'tool_calling', 'vision', 'streaming', 'multi_turn', 'json_mode'],
      contextWindow: 1_000_000,
      maxOutputTokens: 8192,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.075,
      defaultTemperature: 0.7,
      defaultTopP: 0.95,
      defaultMaxTokens: 4096,
      tags: ['litellm', 'google', 'gemini', 'gateway'],
      description: 'Google Gemini 2.5 Flash routed through LiteLLM unified gateway',
    })

    this.register({
      id: 'litellm:claude-3-5-sonnet',
      displayName: 'Claude 3.5 Sonnet (LiteLLM)',
      provider: 'litellm',
      modelName: 'claude-3-5-sonnet',
      roles: ['GENERAL', 'CODING', 'REASONING', 'AGENT'],
      capabilities: ['text_generation', 'tool_calling', 'vision', 'streaming', 'multi_turn', 'json_mode'],
      contextWindow: 200_000,
      maxOutputTokens: 8192,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 3.0,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 4096,
      tags: ['litellm', 'anthropic', 'claude', 'gateway'],
      description: 'Anthropic Claude 3.5 Sonnet routed through LiteLLM unified gateway',
    })

    this.register({
      id: 'litellm:gpt-4o',
      displayName: 'GPT-4o (LiteLLM)',
      provider: 'litellm',
      modelName: 'gpt-4o',
      roles: ['GENERAL', 'VISION', 'CODING', 'REASONING'],
      capabilities: ['text_generation', 'tool_calling', 'vision', 'streaming', 'multi_turn', 'json_mode'],
      contextWindow: 128_000,
      maxOutputTokens: 16384,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 5.0,
      defaultTemperature: 0.7,
      defaultTopP: 0.95,
      defaultMaxTokens: 4096,
      tags: ['litellm', 'openai', 'gpt-4o', 'gateway'],
      description: 'OpenAI GPT-4o routed through LiteLLM unified gateway',
    })

    this.register({
      id: 'litellm:gpt-4o-mini',
      displayName: 'GPT-4o Mini (LiteLLM)',
      provider: 'litellm',
      modelName: 'gpt-4o-mini',
      roles: ['FAST', 'GENERAL'],
      capabilities: ['text_generation', 'tool_calling', 'streaming', 'multi_turn', 'json_mode'],
      contextWindow: 128_000,
      maxOutputTokens: 16384,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.15,
      defaultTemperature: 0.7,
      defaultTopP: 0.95,
      defaultMaxTokens: 2048,
      tags: ['litellm', 'openai', 'fast', 'gateway'],
      description: 'OpenAI GPT-4o Mini routed through LiteLLM unified gateway',
    })

    this.register({
      id: 'litellm:claude-3-5-haiku',
      displayName: 'Claude 3.5 Haiku (LiteLLM)',
      provider: 'litellm',
      modelName: 'claude-3-5-haiku',
      roles: ['FAST', 'GENERAL'],
      capabilities: ['text_generation', 'tool_calling', 'streaming', 'multi_turn', 'json_mode'],
      contextWindow: 200_000,
      maxOutputTokens: 8192,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.8,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 2048,
      tags: ['litellm', 'anthropic', 'haiku', 'gateway'],
      description: 'Anthropic Claude 3.5 Haiku routed through LiteLLM unified gateway',
    })

    this.register({
      id: 'litellm:deepseek-r1',
      displayName: 'DeepSeek R1 (LiteLLM)',
      provider: 'litellm',
      modelName: 'openrouter-deepseek-r1',
      roles: ['REASONING', 'CODING', 'RESEARCH'],
      capabilities: ['text_generation', 'reasoning', 'streaming', 'multi_turn', 'code_completion'],
      contextWindow: 65_536,
      maxOutputTokens: 8192,
      license: 'mit',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.55,
      defaultTemperature: 0.6,
      defaultTopP: 0.9,
      defaultMaxTokens: 4096,
      tags: ['litellm', 'deepseek', 'reasoning', 'gateway'],
      description: 'DeepSeek R1 reasoning model routed through LiteLLM unified gateway',
    })

    this.register({
      id: 'litellm:sonar-reasoning',
      displayName: 'Perplexity Sonar (LiteLLM)',
      provider: 'litellm',
      modelName: 'openrouter-sonar',
      roles: ['RESEARCH', 'REASONING'],
      capabilities: ['text_generation', 'streaming', 'multi_turn'],
      contextWindow: 127_000,
      maxOutputTokens: 8192,
      license: 'proprietary',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 1.0,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 4096,
      tags: ['litellm', 'perplexity', 'research', 'gateway'],
      description: 'Perplexity Sonar web-grounded research model via LiteLLM gateway',
    })

    // --- DeepSeek Direct API --------------------------------------------------
    this.register({
      id: 'deepseek-chat',
      displayName: 'DeepSeek V3 Chat',
      provider: 'deepseek',
      modelName: 'deepseek-chat',
      roles: ['GENERAL', 'CODING', 'FAST'],
      capabilities: ['text_generation', 'tool_calling', 'streaming', 'multi_turn', 'json_mode', 'code_completion'],
      contextWindow: 64_000,
      maxOutputTokens: 8192,
      license: 'mit',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.27,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 4096,
      tags: ['deepseek', 'v3', 'coding', 'cloud'],
      description: 'DeepSeek V3 Chat — powerful, highly cost-effective general & coding model',
    })

    this.register({
      id: 'deepseek-reasoner',
      displayName: 'DeepSeek R1 Reasoner',
      provider: 'deepseek',
      modelName: 'deepseek-reasoner',
      roles: ['REASONING', 'CODING', 'RESEARCH'],
      capabilities: ['text_generation', 'reasoning', 'streaming', 'multi_turn', 'code_completion'],
      contextWindow: 64_000,
      maxOutputTokens: 8192,
      license: 'mit',
      isLocal: false,
      requiresGpu: false,
      minVramGb: 0,
      costPerMillionTokens: 0.55,
      defaultTemperature: 0.6,
      defaultTopP: 0.9,
      defaultMaxTokens: 4096,
      tags: ['deepseek', 'r1', 'reasoning', 'cloud'],
      description: 'DeepSeek R1 frontier reasoning model with chain-of-thought logic',
    })

    // --- Ollama Local (baseline catalog, augmented by ModelDiscovery) --------
    this.register({
      id: 'ollama:llama3.2',
      displayName: 'Llama 3.2 (Local)',
      provider: 'ollama',
      modelName: 'llama3.2',
      roles: ['GENERAL', 'LOCAL'],
      capabilities: ['text_generation', 'streaming', 'multi_turn'],
      contextWindow: 131_072,
      maxOutputTokens: 4096,
      license: 'llama-community',
      isLocal: true,
      requiresGpu: false,
      minVramGb: 0,
      sizeGb: 2.0,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 2048,
      tags: ['ollama', 'local', 'llama', 'cpu-friendly'],
      description: 'Meta Llama 3.2 running locally via Ollama — no data leaves your device',
    })

    this.register({
      id: 'ollama:llama3.1:8b',
      displayName: 'Llama 3.1 8B (Local)',
      provider: 'ollama',
      modelName: 'llama3.1:8b',
      roles: ['GENERAL', 'LOCAL', 'FAST'],
      capabilities: ['text_generation', 'tool_calling', 'streaming', 'multi_turn'],
      contextWindow: 131_072,
      maxOutputTokens: 4096,
      license: 'llama-community',
      isLocal: true,
      requiresGpu: false,
      minVramGb: 0,
      sizeGb: 4.7,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 2048,
      tags: ['ollama', 'local', 'llama', 'tool-calling'],
      description: 'Meta Llama 3.1 8B locally via Ollama — supports tool calling',
    })

    this.register({
      id: 'ollama:deepseek-r1:7b',
      displayName: 'DeepSeek R1 7B (Local)',
      provider: 'ollama',
      modelName: 'deepseek-r1:7b',
      roles: ['REASONING', 'CODING', 'LOCAL'],
      capabilities: ['text_generation', 'reasoning', 'streaming', 'multi_turn', 'code_completion'],
      contextWindow: 65_536,
      maxOutputTokens: 4096,
      license: 'mit',
      isLocal: true,
      requiresGpu: false,
      minVramGb: 0,
      sizeGb: 4.7,
      defaultTemperature: 0.6,
      defaultTopP: 0.9,
      defaultMaxTokens: 2048,
      tags: ['ollama', 'local', 'deepseek', 'reasoning', 'coding'],
      description: 'DeepSeek R1 7B locally — strong reasoning and coding, private',
    })

    this.register({
      id: 'ollama:codellama',
      displayName: 'Code Llama (Local)',
      provider: 'ollama',
      modelName: 'codellama',
      roles: ['CODING', 'LOCAL'],
      capabilities: ['text_generation', 'code_completion', 'streaming', 'multi_turn'],
      contextWindow: 16_384,
      maxOutputTokens: 4096,
      license: 'llama-community',
      isLocal: true,
      requiresGpu: false,
      minVramGb: 0,
      sizeGb: 3.8,
      defaultTemperature: 0.3,
      defaultTopP: 0.9,
      defaultMaxTokens: 2048,
      tags: ['ollama', 'local', 'coding', 'llama'],
      description: 'Meta Code Llama locally — specialized local coding assistant',
    })

    this.register({
      id: 'ollama:mistral',
      displayName: 'Mistral 7B (Local)',
      provider: 'ollama',
      modelName: 'mistral',
      roles: ['GENERAL', 'LOCAL'],
      capabilities: ['text_generation', 'streaming', 'multi_turn'],
      contextWindow: 32_768,
      maxOutputTokens: 4096,
      license: 'apache-2.0',
      isLocal: true,
      requiresGpu: false,
      minVramGb: 0,
      sizeGb: 4.1,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 2048,
      tags: ['ollama', 'local', 'mistral', 'general'],
      description: 'Mistral 7B locally via Ollama — Apache 2.0 licensed',
    })

    this.register({
      id: 'ollama:phi3',
      displayName: 'Phi-3 Mini (Local)',
      provider: 'ollama',
      modelName: 'phi3',
      roles: ['FAST', 'LOCAL', 'CODING'],
      capabilities: ['text_generation', 'streaming', 'multi_turn', 'code_completion'],
      contextWindow: 128_000,
      maxOutputTokens: 4096,
      license: 'mit',
      isLocal: true,
      requiresGpu: false,
      minVramGb: 0,
      sizeGb: 2.2,
      defaultTemperature: 0.7,
      defaultTopP: 0.9,
      defaultMaxTokens: 2048,
      tags: ['ollama', 'local', 'microsoft', 'phi', 'small', 'fast'],
      description: 'Microsoft Phi-3 Mini locally — very small, fast, 128K context, MIT license',
    })
  }
}

export const modelRegistry = new ModelRegistry()
