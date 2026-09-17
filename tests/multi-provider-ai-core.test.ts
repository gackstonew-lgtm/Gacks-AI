try {
  process.loadEnvFile?.()
} catch {}

import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import {
  geminiProvider,
  anthropicProvider,
  openAIProvider,
  openRouterProvider,
  litellmProvider,
  getProvider,
} from '../server/agent/providers/index.js'
import { modelRegistry } from '../server/agent/model-registry.js'
import { modelRouter } from '../server/agent/model-router.js'
import { classifyTask } from '../server/agent/ai-orchestrator.js'

describe('Multi-Provider AI Core & Agent Infrastructure Tests', () => {
  before(() => {
    modelRouter.initProviders()
  })

  // 1. Provider Adapter Contracts & Config
  describe('Provider Abstraction & Health Contracts', () => {
    it('should have all cloud and gateway providers implemented and registered', () => {
      assert.ok(geminiProvider)
      assert.strictEqual(geminiProvider.name, 'gemini')

      assert.ok(anthropicProvider)
      assert.strictEqual(anthropicProvider.name, 'anthropic')

      assert.ok(openAIProvider)
      assert.strictEqual(openAIProvider.name, 'openai')

      assert.ok(openRouterProvider)
      assert.strictEqual(openRouterProvider.name, 'openrouter')

      assert.ok(litellmProvider)
      assert.strictEqual(litellmProvider.name, 'litellm')

      assert.strictEqual(getProvider('gemini'), geminiProvider)
      assert.strictEqual(getProvider('anthropic'), anthropicProvider)
      assert.strictEqual(getProvider('openai'), openAIProvider)
      assert.strictEqual(getProvider('openrouter'), openRouterProvider)
      assert.strictEqual(getProvider('litellm'), litellmProvider)
    })

    it('should detect configured provider status accurately from environment', () => {
      assert.strictEqual(typeof geminiProvider.isConfigured(), 'boolean')
      assert.strictEqual(typeof anthropicProvider.isConfigured(), 'boolean')
      assert.strictEqual(typeof openAIProvider.isConfigured(), 'boolean')
      assert.strictEqual(typeof openRouterProvider.isConfigured(), 'boolean')

      assert.ok(geminiProvider.isConfigured(), 'Expected Gemini to be configured')
      assert.ok(anthropicProvider.isConfigured(), 'Expected Anthropic to be configured')
      assert.ok(openAIProvider.isConfigured(), 'Expected OpenAI to be configured')
      assert.ok(openRouterProvider.isConfigured(), 'Expected OpenRouter to be configured')
    })

    it('should return health report with latency metrics and availability', async () => {
      const healthList = modelRouter.getHealthReport()
      assert.ok(Array.isArray(healthList))
      assert.ok(healthList.length >= 4)

      const geminiHealth = healthList.find((h) => h.name === 'gemini')
      assert.ok(geminiHealth)
      assert.strictEqual(geminiHealth.available, true)

      const anthropicHealth = healthList.find((h) => h.name === 'anthropic')
      assert.ok(anthropicHealth)
      assert.strictEqual(anthropicHealth.available, true)

      const openaiHealth = healthList.find((h) => h.name === 'openai')
      assert.ok(openaiHealth)
      assert.strictEqual(openaiHealth.available, true)

      const openrouterHealth = healthList.find((h) => h.name === 'openrouter')
      assert.ok(openrouterHealth)
      assert.strictEqual(openrouterHealth.available, true)
    })
  })

  // 2. Task Classification & Capability Matching
  describe('Task Classifier & Capability Matching', () => {
    it('should classify coding tasks to CODING profile', () => {
      assert.strictEqual(classifyTask('Write a TypeScript function to debounce an API call'), 'CODING')
      assert.strictEqual(classifyTask('Debug this SQL query performance issue'), 'CODING')
      assert.strictEqual(classifyTask('Refactor the authentication middleware algorithm'), 'CODING')
    })

    it('should classify reasoning and logic tasks to REASONING profile', () => {
      assert.strictEqual(classifyTask('Explain why this distributed consensus protocol is correct step by step'), 'REASONING')
      assert.strictEqual(classifyTask('Analyze the logical deduction in this proof'), 'REASONING')
    })

    it('should classify vision tasks to VISION profile', () => {
      assert.strictEqual(classifyTask('Look at this screenshot and identify the UI bug'), 'VISION')
      assert.strictEqual(classifyTask('What do you see in this photo?'), 'VISION')
    })

    it('should classify research and market tasks appropriately', () => {
      assert.strictEqual(classifyTask('Find the latest research papers on transformer architecture'), 'RESEARCH')
      assert.strictEqual(classifyTask('Analyze quarterly revenue KPI and profit forecast for business campaign'), 'BUSINESS_ANALYSIS')
      assert.strictEqual(classifyTask('Give me a quick TLDR summary'), 'FAST')
    })
  })

  // 3. Model Router & Fallback Chain Selection
  describe('Intelligent Model Routing & Failover Chains', () => {
    it('should build appropriate fallback chains for coding tasks', () => {
      const selection = modelRouter.selectModel('CODING')
      assert.ok(selection.provider)
      assert.ok(selection.modelName)
      assert.ok(Array.isArray(selection.fallbackChain))
      assert.ok(selection.fallbackChain.length > 0)

      // Fallback chain should include secondary providers and OpenRouter
      const providersInChain = [selection.provider, ...selection.fallbackChain.map((f) => f.provider)]
      assert.ok(providersInChain.includes('anthropic') || providersInChain.includes('openai') || providersInChain.includes('gemini'))
      assert.ok(providersInChain.includes('openrouter'))
    })

    it('should route research tasks with OpenRouter Perplexity support in chain', () => {
      const selection = modelRouter.selectModel('RESEARCH')
      assert.ok(selection.provider)
      const providersInChain = [selection.provider, ...selection.fallbackChain.map((f) => f.provider)]
      assert.ok(providersInChain.includes('openrouter') || providersInChain.includes('gemini'))
    })

    it('should route fast / low cost tasks to efficient models', () => {
      const selection = modelRouter.selectModel('FAST')
      assert.ok(selection.provider)
      assert.ok(selection.modelName.includes('flash') || selection.modelName.includes('haiku') || selection.modelName.includes('mini') || selection.modelName.includes('8b') || selection.modelName.includes('llama'))
    })
  })

  // 4. Circuit Breaker & Failover Recovery
  describe('Circuit Breaker Engine', () => {
    it('should record success and reset circuit state', () => {
      modelRouter.recordSuccess('openai', 150, 200, 0.001)
      assert.strictEqual(modelRouter.isProviderAvailable('openai'), true)
    })

    it('should trip circuit to OPEN when failure threshold is reached', () => {
      const testProvider = 'mistral'
      modelRouter.recordFailure(testProvider, 'Network timeout')
      modelRouter.recordFailure(testProvider, 'Network timeout')
      modelRouter.recordFailure(testProvider, 'Network timeout')

      // Circuit should now be OPEN and provider unavailable
      assert.strictEqual(modelRouter.isProviderAvailable(testProvider), false)
    })

    it('should bypass OPEN circuit providers when building routing chain', () => {
      const selection = modelRouter.selectModel('CODING')
      assert.notStrictEqual(selection.provider, 'mistral')
      assert.ok(!selection.fallbackChain.some((c) => c.provider === 'mistral'))
    })
  })

  // 5. Error Normalization Across Providers
  describe('Error Normalization', () => {
    it('should normalize OpenAI 429 quota errors', () => {
      const err = new Error('HTTP 429: Rate limit reached for requests')
      const normalized = openAIProvider.normalizeError(err)
      assert.strictEqual(normalized.provider, 'openai')
      assert.strictEqual(normalized.code, 'QUOTA_EXCEEDED')
      assert.strictEqual(normalized.retryable, true)
    })

    it('should normalize Anthropic 401 authentication errors', () => {
      const err = new Error('authentication_error: Invalid API key')
      const normalized = anthropicProvider.normalizeError(err)
      assert.strictEqual(normalized.provider, 'anthropic')
      assert.strictEqual(normalized.code, 'AUTH_ERROR')
      assert.strictEqual(normalized.retryable, false)
    })

    it('should normalize OpenRouter timeout errors', () => {
      const err = new Error('HTTP 504: Gateway Timeout')
      const normalized = openRouterProvider.normalizeError(err)
      assert.strictEqual(normalized.provider, 'openrouter')
      assert.strictEqual(normalized.code, 'TIMEOUT')
      assert.strictEqual(normalized.retryable, true)
    })

    it('should normalize Gemini resource exhausted errors', () => {
      const err = new Error('Resource exhausted: quota exceeded for quota group')
      const normalized = geminiProvider.normalizeError(err)
      assert.strictEqual(normalized.provider, 'gemini')
      assert.strictEqual(normalized.code, 'QUOTA_EXCEEDED')
      assert.strictEqual(normalized.retryable, true)
    })

    it('should normalize LiteLLM connection offline errors', () => {
      const err = new Error('fetch failed: ECONNREFUSED 127.0.0.1:4000')
      const normalized = litellmProvider.normalizeError(err)
      assert.strictEqual(normalized.provider, 'litellm')
      assert.strictEqual(normalized.code, 'PROVIDER_OFFLINE')
      assert.strictEqual(normalized.retryable, true)
    })
  })

  // 6. LiteLLM Proxy Gateway & Model Registry
  describe('LiteLLM Proxy Gateway & Registry', () => {
    it('should have LiteLLM gateway models registered in model catalog', () => {
      const litellmFlash = modelRegistry.get('litellm:gemini-2.5-flash')
      assert.ok(litellmFlash)
      assert.strictEqual(litellmFlash.provider, 'litellm')
      assert.strictEqual(litellmFlash.modelName, 'gemini-2.5-flash')

      const litellmClaude = modelRegistry.get('litellm:claude-3-5-sonnet')
      assert.ok(litellmClaude)
      assert.strictEqual(litellmClaude.provider, 'litellm')

      const litellmGPT = modelRegistry.get('litellm:gpt-4o')
      assert.ok(litellmGPT)
      assert.strictEqual(litellmGPT.provider, 'litellm')
    })
  })

  // 7. Security & Telemetry Protection
  describe('Security & Secrets Protection in Telemetry', () => {
    it('should record usage telemetry without storing raw API keys', () => {
      modelRouter.recordSuccess('openai', 180, 450, 0.002, 'CODING')
      modelRouter.recordSuccess('gemini', 120, 300, 0.0001, 'GENERAL')

      const summary = modelRouter.getUsageSummary()
      assert.ok(summary.totalCalls >= 2)
      assert.ok(summary.totalTokens >= 750)
      assert.ok(summary.totalCostUsd >= 0)

      const rawSummaryStr = JSON.stringify(summary)
      assert.ok(!rawSummaryStr.includes('sk-proj-'), 'Must never leak OpenAI secret')
      assert.ok(!rawSummaryStr.includes('sk-ant-'), 'Must never leak Anthropic secret')
      assert.ok(!rawSummaryStr.includes('sk-or-'), 'Must never leak OpenRouter secret')
    })
  })
})
