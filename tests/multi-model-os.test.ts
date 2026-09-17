import { describe, it } from 'node:test'
import assert from 'node:assert'
import { modelRegistry, ModelRegistry } from '../server/agent/model-registry.js'
import { modelDiscovery } from '../server/agent/model-discovery.js'
import { hardwareAdvisor } from '../server/agent/hardware-advisor.js'
import { aiOrchestrator } from '../server/agent/ai-orchestrator.js'
import { ollamaAdapter } from '../server/agent/providers/ollama-adapter.js'
import { llamaCppAdapter, OpenAICompatibleAdapter } from '../server/agent/providers/openai-compatible-adapter.js'

describe('Multi-Model AI Operating System Tests', () => {
  // 1. Model Registry
  describe('Model Registry & Metadata Catalog', () => {
    it('should initialize with built-in cloud and local model catalog', () => {
      const all = modelRegistry.getAll()
      assert.ok(all.length >= 10, 'Expected at least 10 built-in models')

      // Check key cloud models
      const geminiFlash = modelRegistry.getById('gemini-2.5-flash')
      assert.ok(geminiFlash)
      assert.strictEqual(geminiFlash.provider, 'gemini')
      assert.ok(geminiFlash.capabilities.includes('vision'))
      assert.ok(geminiFlash.capabilities.includes('tool_calling'))

      const claudeSonnet = modelRegistry.getById('claude-3-5-sonnet')
      assert.ok(claudeSonnet)
      assert.strictEqual(claudeSonnet.provider, 'anthropic')

      const gpt4o = modelRegistry.getById('gpt-4o')
      assert.ok(gpt4o)
      assert.strictEqual(gpt4o.provider, 'openai')
    })

    it('should query models by role, capability, and provider', () => {
      const codingModels = modelRegistry.getByRole('CODING')
      assert.ok(codingModels.length > 0)
      assert.ok(codingModels.some((m) => m.id === 'claude-3-5-sonnet'))

      const visionModels = modelRegistry.getByCapability('vision')
      assert.ok(visionModels.length > 0)
      assert.ok(visionModels.some((m) => m.id === 'gemini-2.5-flash'))

      const groqModels = modelRegistry.getByProvider('groq')
      assert.ok(groqModels.length > 0)
      assert.ok(groqModels.every((m) => m.provider === 'groq'))
    })

    it('should enforce privacy policy boundaries', () => {
      const localOnly = modelRegistry.getForPrivacyPolicy('LOCAL_ONLY')
      assert.ok(localOnly.every((m) => m.isLocal === true))
      assert.ok(localOnly.length > 0)

      const cloudAllowed = modelRegistry.getForPrivacyPolicy('CLOUD_ALLOWED')
      assert.ok(cloudAllowed.some((m) => !m.isLocal))
      assert.ok(cloudAllowed.some((m) => m.isLocal))
    })

    it('should filter models by VRAM / RAM budget', () => {
      const budgetFit = modelRegistry.getByVramBudget(0) // CPU-only
      assert.ok(budgetFit.length > 0)
      assert.ok(budgetFit.every((m) => m.minVramGb === 0))
    })

    it('should support dynamic registration of newly discovered models', () => {
      const tempRegistry = new ModelRegistry()
      const registered = tempRegistry.registerDiscovered('ollama', 'qwen2.5:7b', {
        displayName: 'Qwen 2.5 7B',
        roles: ['CODING', 'REASONING'],
        contextWindow: 32768,
      })

      assert.strictEqual(registered.id, 'ollama:qwen2.5:7b')
      assert.strictEqual(registered.isLocal, true)
      assert.ok(tempRegistry.getById('ollama:qwen2.5:7b'))
    })
  })

  // 2. Hardware Advisor
  describe('Hardware Advisor & Compatibility Engine', () => {
    it('should return a valid hardware profile', async () => {
      const profile = await hardwareAdvisor.getProfile()
      assert.ok(profile.totalRamGb > 0)
      assert.ok(profile.availableRamGb >= 0)
      assert.ok(profile.cpuCores > 0)
      assert.strictEqual(typeof profile.canRunLocal, 'boolean')
      assert.strictEqual(typeof profile.hasGpu, 'boolean')
    })

    it('should generate compatibility report with model recommendations', async () => {
      const report = await hardwareAdvisor.getCompatibilityReport()
      assert.ok(report.profile)
      assert.ok(Array.isArray(report.recommendations))
      assert.ok(report.recommendations.length > 0)

      for (const rec of report.recommendations) {
        assert.ok(rec.model)
        assert.ok(typeof rec.fitScore === 'number')
        assert.ok(rec.fitScore >= 0 && rec.fitScore <= 100)
        assert.ok(typeof rec.canRun === 'boolean')
        assert.ok(typeof rec.reason === 'string')
      }
    })
  })

  // 3. AI Orchestrator Routing & Fallback
  describe('AI Orchestrator Task Routing & Fallback Chain', () => {
    it('should route coding queries to coding-optimized models', async () => {
      const result = await aiOrchestrator.route({
        profile: 'CODING',
        routingMode: 'AUTO',
        privacyPolicy: 'CLOUD_ALLOWED',
      })

      assert.ok(result.selectedModel)
      assert.ok(result.selectedModel.roles.includes('CODING') || result.selectedModel.roles.includes('GENERAL'))
      assert.ok(Array.isArray(result.fallbackChain))
    })

    it('should strictly route to local models when LOCAL_ONLY mode is active', async () => {
      const result = await aiOrchestrator.route({
        profile: 'GENERAL',
        routingMode: 'LOCAL_ONLY',
        privacyPolicy: 'LOCAL_ONLY',
      })

      assert.ok(result.selectedModel)
      assert.strictEqual(result.selectedModel.isLocal, true)
      assert.ok(result.fallbackChain.every((m) => m.isLocal === true))
    })

    it('should honor user pinned model preference', async () => {
      const testUserId = 'test-user-pin'
      aiOrchestrator.setPreferences(testUserId, {
        preferredModelId: 'gemini-2.5-flash',
        routingMode: 'AUTO',
        privacyPolicy: 'CLOUD_ALLOWED',
      })

      const result = await aiOrchestrator.route({ profile: 'CODING' }, testUserId)
      assert.strictEqual(result.selectedModel.id, 'gemini-2.5-flash')
    })

    it('should maintain per-user preferences isolated from defaults', () => {
      const userA = 'user-alpha'
      const userB = 'user-beta'

      aiOrchestrator.setPreferences(userA, { routingMode: 'LOCAL_ONLY' })
      aiOrchestrator.setPreferences(userB, { routingMode: 'CLOUD_ONLY' })

      assert.strictEqual(aiOrchestrator.getPreferences(userA).routingMode, 'LOCAL_ONLY')
      assert.strictEqual(aiOrchestrator.getPreferences(userB).routingMode, 'CLOUD_ONLY')
    })
  })

  // 4. Provider Error Normalization
  describe('Provider Adapters & Normalized Error Handling', () => {
    it('should correctly normalize Ollama offline error', () => {
      const err = new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:11434')
      const normalized = ollamaAdapter.normalizeError(err)
      assert.strictEqual(normalized.provider, 'ollama')
      assert.strictEqual(normalized.code, 'PROVIDER_OFFLINE')
      assert.strictEqual(normalized.retryable, false)
    })

    it('should correctly normalize llama.cpp timeout error', () => {
      const adapter = new OpenAICompatibleAdapter({ baseUrl: 'http://localhost:8080', providerName: 'llamacpp' })
      const err = new Error('request ETIMEDOUT')
      const normalized = adapter.normalizeError(err)
      assert.strictEqual(normalized.provider, 'llamacpp')
      assert.strictEqual(normalized.code, 'TIMEOUT')
      assert.strictEqual(normalized.retryable, true)
    })

    it('should correctly normalize quota exceeded error', () => {
      const err = new Error('HTTP 429: Resource exhausted: rate limit exceeded')
      const normalized = llamaCppAdapter.normalizeError(err)
      assert.strictEqual(normalized.code, 'QUOTA_EXCEEDED')
      assert.strictEqual(normalized.retryable, true)
    })
  })

  // 5. Model Discovery Engine
  describe('Model Discovery Engine', () => {
    it('should run discovery without throwing and return structured report', async () => {
      const result = await modelDiscovery.discover()
      assert.ok(result)
      assert.ok(typeof result.totalDiscovered === 'number')
      assert.ok(result.discoveredAt > 0)
      assert.strictEqual(typeof result.ollama.reachable, 'boolean')
      assert.strictEqual(typeof result.llamacpp.reachable, 'boolean')
      assert.ok(Array.isArray(result.ollama.models))
      assert.ok(Array.isArray(result.llamacpp.models))

      // Cached result check
      const last = modelDiscovery.getLastResult()
      assert.ok(last)
      assert.ok(last.discoveredAt > 0)
    })
  })
})


