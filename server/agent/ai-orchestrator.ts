/**
 * GACKS AI — Central AI Orchestrator
 *
 * Provider-neutral AI dispatch layer. Handles:
 *   - Task classification → model role → capability matching
 *   - Unified Multi-Provider Execution (Gemini, Anthropic, OpenAI, OpenRouter, Ollama, llama.cpp)
 *   - Automatic fallback chain with circuit-breaker protection
 *   - Privacy-aware routing (LOCAL_ONLY / HYBRID / CLOUD_ALLOWED)
 *   - Offline mode (local-only when cloud unavailable)
 *   - Multi-model conversation context preservation
 *   - Safe tool calling, validation, and idempotency protection
 *   - Normalized streaming across all providers
 *   - Performance telemetry with cost awareness
 */

import { modelRegistry } from './model-registry.js'
import { modelRouter } from './model-router.js'
import { modelDiscovery } from './model-discovery.js'
import {
  getProvider,
  ollamaAdapter,
  llamaCppAdapter,
  type AIMessage,
  type NormalizedToolCall,
} from './providers/index.js'
import { toolRegistry } from '../tools/registry.js'
import { memoryStore } from '../memory/memory-store.js'
import type {
  ModelDescriptor,
  ModelProfile,
  RoutingMode,
  PrivacyPolicy,
  AIRoutingRequest,
  AIRoutingResult,
  ModelTelemetryRecord,
  NormalizedAIError,
} from '../types.js'
import type { ToolContext } from '../tools/registry.js'
import type { AskHandlers } from './orchestrator.js'

// ---------------------------------------------------------------------------
// User preferences (persisted per-session, can extend to DB)
// ---------------------------------------------------------------------------

export interface AIUserPreferences {
  preferredModelId?: string
  routingMode: RoutingMode
  privacyPolicy: PrivacyPolicy
  allowCloudFallback: boolean
  preferLocalWhenAvailable: boolean
}

const DEFAULT_PREFERENCES: AIUserPreferences = {
  routingMode: 'AUTO',
  privacyPolicy: 'CLOUD_ALLOWED',
  allowCloudFallback: true,
  preferLocalWhenAvailable: false,
}

// ---------------------------------------------------------------------------
// Task classifier — maps user prompt → model profile
// ---------------------------------------------------------------------------

export function classifyTask(prompt: string): ModelProfile {
  const p = prompt.toLowerCase()

  if (/\b(image|photo|picture|screenshot|visual|what.?do.?you.?see|look at|camera)\b/.test(p)) {
    return 'VISION'
  }
  if (/\b(business|revenue|kpi|forecast|profit|loss|market|campaign|crm|forex|trade)\b/.test(p)) {
    return 'BUSINESS_ANALYSIS'
  }
  if (/\b(code|function|class|bug|debug|typescript|javascript|python|sql|refactor|implement|algorithm)\b/.test(p)) {
    return 'CODING'
  }
  if (/\b(research|find|search|news|article|web|latest|current)\b/.test(p)) {
    return 'RESEARCH'
  }
  if (/\b(reason|think|step.?by.?step|proof|logic|deduce|infer|explain why|analyze)\b/.test(p)) {
    return 'REASONING'
  }
  if (/\b(quick|brief|short|one.?word|tldr|fast)\b/.test(p)) {
    return 'FAST'
  }
  if (/\b(document|pdf|file|read this|summarize this)\b/.test(p)) {
    return 'DOCUMENT'
  }

  return 'GENERAL'
}

// ---------------------------------------------------------------------------
// Main AIOrchestrator class
// ---------------------------------------------------------------------------

export class AIOrchestrator {
  /** Per-user conversation history, keyed by userId */
  private histories: Map<string, Array<{ role: 'user' | 'model'; parts: unknown[] }>> = new Map()
  private interrupted = false
  private telemetry: ModelTelemetryRecord[] = []
  private userPreferences: Map<string, AIUserPreferences> = new Map()
  private discoveryDone = false

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public interrupt(): void {
    this.interrupted = true
  }

  public reset(userId?: string): void {
    if (userId) {
      this.histories.delete(userId)
    } else {
      this.histories.clear()
    }
    this.interrupted = false
  }

  // ---------------------------------------------------------------------------
  // Preferences
  // ---------------------------------------------------------------------------

  public getPreferences(userId: string): AIUserPreferences {
    return this.userPreferences.get(userId) ?? { ...DEFAULT_PREFERENCES }
  }

  public setPreferences(userId: string, prefs: Partial<AIUserPreferences>): void {
    const current = this.getPreferences(userId)
    this.userPreferences.set(userId, { ...current, ...prefs })
  }

  public getCandidateModels(
    profile: ModelProfile,
    routingMode: RoutingMode = 'AUTO',
    privacyPolicy: PrivacyPolicy = 'CLOUD_ALLOWED',
  ): ModelDescriptor[] {
    return this.getCandidates(profile, routingMode, privacyPolicy, { profile })
  }

  // ---------------------------------------------------------------------------
  // Model Routing
  // ---------------------------------------------------------------------------

  public async route(req: AIRoutingRequest, userId?: string): Promise<AIRoutingResult> {
    // Run discovery once on first route call
    if (!this.discoveryDone) {
      this.discoveryDone = true
      modelDiscovery.discover().catch(() => { /* non-blocking */ })
    }

    const prefs = userId ? this.getPreferences(userId) : DEFAULT_PREFERENCES
    const routingMode = req.routingMode ?? prefs.routingMode
    const privacyPolicy = req.privacyPolicy ?? prefs.privacyPolicy

    // User has pinned a specific model
    if (req.preferredModelId ?? prefs.preferredModelId) {
      const pinned = modelRegistry.getById(req.preferredModelId ?? prefs.preferredModelId ?? '')
      if (pinned) {
        const rationale = `User-pinned model: ${pinned.displayName}`
        return {
          selectedModel: pinned,
          fallbackChain: this.buildFallbackChain(req.profile, routingMode, privacyPolicy, [pinned.id]),
          rationale,
          routingMode,
        }
      }
    }

    // Determine candidate pool based on routing mode + privacy
    const candidates = this.getCandidates(req.profile, routingMode, privacyPolicy, req)

    if (candidates.length === 0) {
      // Last resort fallback — pick first healthy configured model or any enabled model
      const fallback = modelRegistry.getAll().find((m) => m.enabled && !m.isLocal) ??
        modelRegistry.getAll().find((m) => m.enabled) ??
        modelRegistry.getAll()[0]
      return {
        selectedModel: fallback,
        fallbackChain: [],
        rationale: 'No candidates available — using configured provider model',
        routingMode,
      }
    }

    const selected = candidates[0]
    const fallbackChain = candidates.slice(1)

    return {
      selectedModel: selected,
      fallbackChain,
      rationale: `Selected ${selected.displayName} for profile=${req.profile}, mode=${routingMode}`,
      routingMode,
    }
  }

  // ---------------------------------------------------------------------------
  // Main ask() — provider-neutral, with automatic fallback chain
  // ---------------------------------------------------------------------------

  public async ask(
    userPrompt: string,
    handlers: AskHandlers,
    context: ToolContext = {},
  ): Promise<{ text: string; costUsd: number; error?: boolean; modelUsed?: string; providerUsed?: string }> {
    this.interrupted = false
    const userId = context.userId ?? 'default'
    const onText = handlers.onText ?? (() => { })
    const startTime = Date.now()
    const cleanPrompt = userPrompt.trim()

    // 1. Natural Language Model Status & Information Commands
    if (/^(what|which)\s+model\s+(are\s+you\s+using|is\s+active)|^(show|check)\s+(active\s+model|model\s+status|current\s+model)$/i.test(cleanPrompt)) {
      const prefs = this.getPreferences(userId)
      const routing = await this.route({
        profile: 'GENERAL',
        routingMode: prefs.routingMode,
        privacyPolicy: prefs.privacyPolicy,
        preferredModelId: prefs.preferredModelId,
      }, userId)
      const resp = `Currently operating on ${routing.selectedModel.displayName} (${routing.selectedModel.provider.toUpperCase()}), sir.\n\n• Routing Mode: ${routing.routingMode}\n• Context Window: ${routing.selectedModel.contextWindow.toLocaleString()} tokens\n• Vision Support: ${routing.selectedModel.capabilities.includes('vision') ? 'Enabled' : 'Disabled'}\n• Tool Execution: ${routing.selectedModel.capabilities.includes('tool_calling') ? 'Active' : 'Disabled'}\n• Fallback Chain: ${routing.fallbackChain.map((m) => m.displayName).join(' → ') || 'None'}`
      onText(resp)
      return { text: resp, costUsd: 0, modelUsed: routing.selectedModel.displayName, providerUsed: routing.selectedModel.provider }
    }

    if (/^(show|list|which)\s+(available\s+models|configured\s+(ai\s+)?providers|models\s+are\s+available)/i.test(cleanPrompt)) {
      const allModels = modelRegistry.getAll().filter((m) => m.enabled)
      const health = modelRouter.getHealthReport()
      const healthMap = new Map(health.map((h) => [h.name, h.available]))

      const lines = [
        'Configured AI Reasoning Engines, sir:',
        '',
        ...allModels.slice(0, 10).map((m) => {
          const status = m.isLocal ? '● LOCAL' : healthMap.get(m.provider) ? '● ONLINE' : '○ NOT_CONFIGURED'
          return `• ${m.displayName} [${m.provider.toUpperCase()}] — ${status} (${m.contextWindow / 1000}k context)`
        }),
        '',
        'You can switch anytime by saying "Switch to Claude", "Switch to OpenAI", "Switch to Gemini", or "Use local model".',
      ]
      const resp = lines.join('\n')
      onText(resp)
      return { text: resp, costUsd: 0 }
    }

    // 2. Natural Language Model Switching Commands
    if (/\b(switch\s+to|change\s+model\s+to|use|set\s+model\s+to)\s+(claude|anthropic|claude-3\.?5|sonnet|opus|haiku)\b/i.test(cleanPrompt)) {
      const claude = modelRegistry.getById('claude-3-5-sonnet-20241022') ?? modelRegistry.getAll().find((m) => m.provider === 'anthropic')
      if (claude) {
        this.setPreferences(userId, { preferredModelId: claude.id, routingMode: 'MANUAL' })
        const resp = `Switched active reasoning core to ${claude.displayName} (${claude.provider.toUpperCase()}), sir. All subsequent agent workflows and tool executions will use Claude.`
        onText(resp)
        context.sendUi?.({ type: 'model_switched', modelId: claude.id, provider: claude.provider })
        return { text: resp, costUsd: 0, modelUsed: claude.displayName, providerUsed: claude.provider }
      }
    }

    if (/\b(switch\s+to|change\s+model\s+to|use|set\s+model\s+to)\s+(openai|gpt-?4o|gpt|chatgpt|o1|o3)\b/i.test(cleanPrompt)) {
      const gpt = modelRegistry.getById('gpt-4o') ?? modelRegistry.getAll().find((m) => m.provider === 'openai')
      if (gpt) {
        this.setPreferences(userId, { preferredModelId: gpt.id, routingMode: 'MANUAL' })
        const resp = `Switched active reasoning core to ${gpt.displayName} (${gpt.provider.toUpperCase()}), sir. All subsequent agent workflows and tool executions will use OpenAI.`
        onText(resp)
        context.sendUi?.({ type: 'model_switched', modelId: gpt.id, provider: gpt.provider })
        return { text: resp, costUsd: 0, modelUsed: gpt.displayName, providerUsed: gpt.provider }
      }
    }

    if (/\b(switch\s+to|change\s+model\s+to|use|set\s+model\s+to)\s+(gemini|google|gemini-flash|gemini-pro)\b/i.test(cleanPrompt)) {
      const gem = modelRegistry.getById('gemini-2.5-flash') ?? modelRegistry.getAll().find((m) => m.provider === 'gemini')
      if (gem) {
        this.setPreferences(userId, { preferredModelId: gem.id, routingMode: 'MANUAL' })
        const resp = `Switched active reasoning core to ${gem.displayName} (${gem.provider.toUpperCase()}), sir.`
        onText(resp)
        context.sendUi?.({ type: 'model_switched', modelId: gem.id, provider: gem.provider })
        return { text: resp, costUsd: 0, modelUsed: gem.displayName, providerUsed: gem.provider }
      }
    }

    if (/\b(switch\s+to|change\s+model\s+to|use|set\s+model\s+to)\s+(openrouter|perplexity|sonar)\b/i.test(cleanPrompt)) {
      const or = modelRegistry.getAll().find((m) => m.provider === 'openrouter')
      if (or) {
        this.setPreferences(userId, { preferredModelId: or.id, routingMode: 'MANUAL' })
        const resp = `Switched active reasoning core to ${or.displayName} (OpenRouter), sir.`
        onText(resp)
        context.sendUi?.({ type: 'model_switched', modelId: or.id, provider: or.provider })
        return { text: resp, costUsd: 0, modelUsed: or.displayName, providerUsed: or.provider }
      }
    }

    if (/\b(switch\s+to|change\s+model\s+to|use|set\s+model\s+to)\s+(local\s+model|local|ollama|llamacpp)\b/i.test(cleanPrompt)) {
      this.setPreferences(userId, { routingMode: 'LOCAL_ONLY', preferredModelId: undefined })
      const resp = `Switched to Local Offline AI mode, sir. All processing will execute on local hardware.`
      onText(resp)
      context.sendUi?.({ type: 'model_switched', routingMode: 'LOCAL_ONLY' })
      return { text: resp, costUsd: 0 }
    }

    if (/\b(switch\s+to|change\s+model\s+to|use|set\s+model\s+to)\s+(auto|dynamic|smart\s+routing|automatic)\b/i.test(cleanPrompt)) {
      this.setPreferences(userId, { routingMode: 'AUTO', preferredModelId: undefined })
      const resp = `Switched to Dynamic Multi-Model Auto-Routing mode, sir. The system will dynamically select the optimal model per task.`
      onText(resp)
      context.sendUi?.({ type: 'model_switched', routingMode: 'AUTO' })
      return { text: resp, costUsd: 0 }
    }

    // 3. Classify task → routing request
    const profile = classifyTask(userPrompt)
    const prefs = this.getPreferences(userId)

    const routingReq: AIRoutingRequest = {
      profile,
      routingMode: prefs.routingMode,
      privacyPolicy: prefs.privacyPolicy,
      preferredModelId: prefs.preferredModelId,
      requiresVision: /image|photo|screenshot/i.test(userPrompt),
      requiresToolCalling: true,
    }

    // 4. Route
    const routing = await this.route(routingReq, userId)
    const candidateChain = [routing.selectedModel, ...routing.fallbackChain]

    // 5. Try each model in fallback chain
    for (const model of candidateChain) {
      if (this.interrupted) break

      try {
        const result = await this.askModel(model, userPrompt, handlers, context, startTime)
        if (!result.error) {
          return {
            ...result,
            modelUsed: model.displayName,
            providerUsed: model.provider,
          }
        }

        // Retryable error or failure — try next in chain
        console.warn(`[AIOrchestrator] ${model.displayName} (${model.provider}) failed: ${result.text}. Trying next fallback candidate.`)
        continue
      } catch (err) {
        console.warn(`[AIOrchestrator] ${model.displayName} (${model.provider}) threw:`, err)
        continue
      }
    }

    // All candidates exhausted
    const errMsg = 'All configured AI providers failed to respond. Please check your API keys or network connection.'
    onText(errMsg)
    return { text: errMsg, costUsd: 0, error: true }
  }

  // ---------------------------------------------------------------------------
  // Per-model dispatch (normalizes cloud vs local)
  // ---------------------------------------------------------------------------

  private async askModel(
    model: ModelDescriptor,
    userPrompt: string,
    handlers: AskHandlers,
    context: ToolContext,
    startTime: number,
  ): Promise<{ text: string; costUsd: number; error?: boolean }> {
    const userId = context.userId ?? 'default'

    if (model.isLocal) {
      return this.askLocalModel(model, userPrompt, handlers, context, userId, startTime)
    } else {
      return this.askCloudModel(model, userPrompt, handlers, context, userId, startTime)
    }
  }

  // ---------------------------------------------------------------------------
  // Local model dispatch (Ollama / llama.cpp)
  // ---------------------------------------------------------------------------

  private async askLocalModel(
    model: ModelDescriptor,
    userPrompt: string,
    handlers: AskHandlers,
    context: ToolContext,
    userId: string,
    startTime: number,
  ): Promise<{ text: string; costUsd: number; error?: boolean }> {
    const onText = handlers.onText ?? (() => { })
    const onTool = handlers.onTool ?? (() => { })

    const adapter = model.provider === 'ollama' ? ollamaAdapter : llamaCppAdapter
    const available = await adapter.checkAvailability()
    if (!available) {
      return { text: `${model.provider} is not reachable`, costUsd: 0, error: true }
    }

    const history = this.getHistory(userId)
    const systemPrompt = this.buildSystemPrompt(context, userPrompt)

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((h) => ({
        role: h.role === 'user' ? 'user' as const : 'assistant' as const,
        content: String((h.parts as Array<{ text?: string }>)[0]?.text ?? ''),
      })),
      { role: 'user' as const, content: userPrompt },
    ]

    const maxChars = model.contextWindow * 3.5
    const truncated = this.truncateMessages(messages, maxChars)

    const declarations = toolRegistry.getDeclarations()
    const localTools = declarations.map((d) => ({
      type: 'function' as const,
      function: {
        name: d.name,
        description: d.description,
        parameters: d.parameters as Record<string, unknown>,
      },
    }))

    let fullAnswer = ''
    const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = []

    try {
      for await (const chunk of adapter.streamChat(model, truncated, model.capabilities.includes('tool_calling') ? localTools : [], undefined)) {
        if (this.interrupted) break

        if (chunk.text) {
          fullAnswer += chunk.text
          onText(chunk.text)
        }

        if (chunk.toolCall) {
          functionCalls.push(chunk.toolCall)
        }
      }

      // Execute tool calls if any
      for (const call of functionCalls) {
        if (this.interrupted) break
        onTool(call.name)

        try {
          const execResult = await toolRegistry.executeTool(call.name, call.args, context)
          if (execResult.success) {
            const resultText = `\n[Tool ${call.name} result: ${JSON.stringify(execResult.data).slice(0, 500)}]\n`
            fullAnswer += resultText
            onText(resultText)
          }
        } catch {
          /* tool error — continue */
        }
      }

      this.appendHistory(userId, userPrompt, fullAnswer)
      this.recordTelemetry(model, startTime, true)

      return { text: fullAnswer.trim(), costUsd: 0 }
    } catch (err) {
      this.recordTelemetry(model, startTime, false, String(err))
      const normalizedErr = adapter.normalizeError(err, model) as NormalizedAIError
      return { text: normalizedErr.message, costUsd: 0, error: true }
    }
  }

  // ---------------------------------------------------------------------------
  // Cloud model dispatch (Gemini, Anthropic, OpenAI, OpenRouter)
  // ---------------------------------------------------------------------------

  private async askCloudModel(
    model: ModelDescriptor,
    userPrompt: string,
    handlers: AskHandlers,
    context: ToolContext,
    userId: string,
    startTime: number,
  ): Promise<{ text: string; costUsd: number; error?: boolean }> {
    const onText = handlers.onText ?? (() => { })
    const onTool = handlers.onTool ?? (() => { })

    const provider = getProvider(model.provider)
    if (!provider || !provider.isConfigured()) {
      return {
        text: `Provider ${model.provider} is not configured with an API key.`,
        costUsd: 0,
        error: true,
      }
    }

    const history = this.getHistory(userId)
    const systemInstruction = this.buildSystemPrompt(context, userPrompt)

    // Append user turn to history
    history.push({ role: 'user', parts: [{ text: userPrompt }] })

    // Build normalized AIMessages
    const messages: AIMessage[] = []
    for (const h of history) {
      const text = (h.parts as Array<{ text?: string }>)[0]?.text ?? ''
      messages.push({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: text,
      })
    }

    const budgetCheck = modelRouter.checkBudget(0.001)
    if (!budgetCheck.allowed) {
      return {
        text: `[Budget Control] ${budgetCheck.reason}`,
        costUsd: 0,
        error: true,
      }
    }

    const declarations = toolRegistry.getDeclarations()
    let fullAnswer = ''
    let totalCost = 0
    let iterations = 0

    try {
      while (iterations++ < 8) {
        if (this.interrupted) break

        const req = {
          model,
          messages,
          tools: declarations.length > 0 ? declarations : undefined,
          systemInstruction,
          temperature: model.parameters?.temperature ?? model.defaultTemperature,
          topP: model.parameters?.topP ?? model.defaultTopP,
          maxTokens: model.parameters?.maxTokens ?? model.defaultMaxTokens,
        }

        let currentTurnText = ''
        const functionCalls: NormalizedToolCall[] = []

        for await (const chunk of provider.stream(req)) {
          if (this.interrupted) break

          if (chunk.text) {
            currentTurnText += chunk.text
            fullAnswer += chunk.text
            onText(chunk.text)
          }

          if (chunk.toolCall) {
            functionCalls.push(chunk.toolCall)
          }

          if (chunk.usage) {
            totalCost += chunk.usage.estimatedCostUsd
          }
        }

        if (functionCalls.length === 0) {
          if (currentTurnText) {
            this.setHistory(userId, history)
          }
          break
        }

        // Execute tool calls
        for (const call of functionCalls) {
          if (this.interrupted) break
          onTool(call.name)

          try {
            const execResult = await toolRegistry.executeTool(call.name, call.args, context)
            const data = execResult.data || { status: 'success' }
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: call.name,
              content: JSON.stringify(data),
            })
          } catch (toolErr) {
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: call.name,
              content: JSON.stringify({ error: String(toolErr) }),
            })
          }
        }
      }

      this.appendHistory(userId, userPrompt, fullAnswer)
      modelRouter.recordSuccess(model.provider, Date.now() - startTime, 0, totalCost)
      this.recordTelemetry(model, startTime, true)

      // Save useful insights to episodic memory
      if (fullAnswer.length > 30 && !fullAnswer.includes('error')) {
        memoryStore.recordMemory({
          userId,
          category: 'episodic',
          content: `Q: ${userPrompt.slice(0, 100)} | A: ${fullAnswer.slice(0, 200)}`,
          importance: 2,
        })
      }

      return { text: fullAnswer.trim(), costUsd: totalCost }
    } catch (err) {
      modelRouter.recordFailure(model.provider, String(err))
      this.recordTelemetry(model, startTime, false, String(err))
      return { text: this.formatError(err), costUsd: 0, error: true }
    }
  }

  // ---------------------------------------------------------------------------
  // Telemetry
  // ---------------------------------------------------------------------------

  private recordTelemetry(model: ModelDescriptor, startTime: number, success: boolean, error?: string): void {
    const record: ModelTelemetryRecord = {
      id: `orch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      provider: model.provider,
      model: model.modelName,
      profile: 'GENERAL',
      latencyMs: Date.now() - startTime,
      estimatedTokens: 0,
      estimatedCostUsd: 0,
      success,
      fallbackEvents: 0,
      error,
      isLocal: model.isLocal,
      routingMode: 'AUTO',
    }
    this.telemetry.push(record)
    if (this.telemetry.length > 500) this.telemetry = this.telemetry.slice(-250)
  }

  public getTelemetry(limit = 50): ModelTelemetryRecord[] {
    return this.telemetry.slice(-limit).reverse()
  }

  // ---------------------------------------------------------------------------
  // Conversation history management
  // ---------------------------------------------------------------------------

  private getHistory(userId: string): Array<{ role: 'user' | 'model'; parts: unknown[] }> {
    if (!this.histories.has(userId)) {
      this.histories.set(userId, [])
    }
    return this.histories.get(userId)!
  }

  private setHistory(userId: string, history: Array<{ role: 'user' | 'model'; parts: unknown[] }>): void {
    this.histories.set(userId, history)
  }

  private appendHistory(userId: string, userText: string, modelText: string): void {
    const history = this.getHistory(userId)
    history.push({ role: 'user', parts: [{ text: userText }] })
    history.push({ role: 'model', parts: [{ text: modelText }] })
    if (history.length > 24) {
      history.splice(0, history.length - 24)
    }
  }

  // ---------------------------------------------------------------------------
  // Model candidate selection
  // ---------------------------------------------------------------------------

  private getCandidates(
    profile: ModelProfile,
    routingMode: RoutingMode,
    privacyPolicy: PrivacyPolicy,
    req: AIRoutingRequest,
  ): ModelDescriptor[] {
    let pool = modelRegistry.getForPrivacyPolicy(privacyPolicy)

    // Filter out disabled models
    pool = pool.filter((m) => m.enabled !== false)

    // Apply routing mode filter
    if (routingMode === 'LOCAL_ONLY' || routingMode === 'OFFLINE') {
      pool = pool.filter((m) => m.isLocal)
    } else if (routingMode === 'CLOUD_ONLY') {
      pool = pool.filter((m) => !m.isLocal)
    }

    // Filter by capabilities if needed
    if (req.requiresVision) {
      pool = pool.filter((m) => m.capabilities.includes('vision'))
    }

    if (req.estimatedTokens && req.estimatedTokens > 0) {
      pool = pool.filter((m) => m.contextWindow >= req.estimatedTokens!)
    }

    // Check which providers are actually available (and circuit breaker is not OPEN)
    const providerHealth = modelRouter.getHealthReport()
    const healthMap = new Map(providerHealth.map((h) => [h.name, h.available]))

    pool = pool.filter((m) => {
      if (m.isLocal) return true
      return healthMap.get(m.provider) ?? false
    })

    return this.sortByProfile(pool, profile)
  }

  private sortByProfile(models: ModelDescriptor[], profile: ModelProfile): ModelDescriptor[] {
    const roleMap: Record<ModelProfile, string[]> = {
      GENERAL: ['GENERAL', 'FAST', 'LOCAL'],
      FAST: ['FAST', 'GENERAL', 'LOCAL'],
      REASONING: ['REASONING', 'CODING', 'GENERAL'],
      CODING: ['CODING', 'REASONING', 'AGENT', 'GENERAL'],
      VISION: ['VISION', 'GENERAL'],
      LONG_CONTEXT: ['GENERAL', 'REASONING'],
      BUSINESS_ANALYSIS: ['REASONING', 'GENERAL', 'CODING'],
      RESEARCH: ['RESEARCH', 'REASONING', 'GENERAL'],
      DOCUMENT: ['VISION', 'GENERAL'],
      LOW_COST: ['FAST', 'LOCAL', 'GENERAL'],
    }

    const preferredRoles = roleMap[profile] ?? ['GENERAL']

    return [...models].sort((a, b) => {
      const aPri = a.priority ?? 5
      const bPri = b.priority ?? 5
      const aScore = this.roleScore(a, preferredRoles) + aPri * 2
      const bScore = this.roleScore(b, preferredRoles) + bPri * 2
      return bScore - aScore
    })
  }

  private roleScore(model: ModelDescriptor, preferredRoles: string[]): number {
    let score = 0
    for (let i = 0; i < preferredRoles.length; i++) {
      if (model.roles.includes(preferredRoles[i] as never)) {
        score += preferredRoles.length - i
      }
    }
    if (model.capabilities.includes('tool_calling')) score += 2
    if (model.contextWindow >= 128_000) score += 1
    return score
  }

  private buildFallbackChain(
    profile: ModelProfile,
    routingMode: RoutingMode,
    privacyPolicy: PrivacyPolicy,
    excludeIds: string[],
  ): ModelDescriptor[] {
    const candidates = this.getCandidates(profile, routingMode, privacyPolicy, { profile })
    return candidates.filter((m) => !excludeIds.includes(m.id))
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildSystemPrompt(context: ToolContext, _userPrompt: string): string {
    return [
      'You are GACKS, an advanced AI personal assistant and operating system.',
      'You are precise, helpful, and security-conscious.',
      'Always use available tools to query live system data and perform verified operations.',
      'Format responses clearly. Be concise. Prioritize accuracy.',
      context.userId ? `User ID: ${context.userId}` : '',
    ].filter(Boolean).join('\n')
  }

  private truncateMessages<T extends { role: string; content: string }>(
    messages: T[],
    maxChars: number,
  ): T[] {
    let totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
    if (totalChars <= maxChars) return messages

    const result = [...messages]
    while (totalChars > maxChars && result.length > 2) {
      const removeIdx = result.findIndex((m) => m.role !== 'system')
      if (removeIdx === -1) break
      totalChars -= result[removeIdx].content.length
      result.splice(removeIdx, 1)
    }
    return result
  }

  private formatError(err: unknown): string {
    const raw = String((err as Error)?.message ?? err)
    console.error('[AIOrchestrator] Error:', raw)

    if (/resource_exhausted|429|quota|rate.?limit/i.test(raw)) return 'AI provider rate limit reached. Retrying or switching fallback...'
    if (/unauthorized|401|api.?key/i.test(raw)) return 'AI provider API key is invalid or missing.'
    if (/network|fetch failed|econnrefused/i.test(raw)) return 'Network connection to AI provider timed out.'
    if (/context.?length|too many tokens/i.test(raw)) return 'Request context length exceeded limit.'
    return `Reasoning error: ${raw.slice(0, 120)}`
  }
}

export const aiOrchestrator = new AIOrchestrator()
