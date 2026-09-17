try {
  process.loadEnvFile?.()
} catch {}

import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import {
  litellmProvider,
  deepSeekProvider,
  getProvider,
} from '../server/agent/providers/index.js'
import { modelRegistry } from '../server/agent/model-registry.js'
import { modelRouter } from '../server/agent/model-router.js'
import { aiOrchestrator } from '../server/agent/ai-orchestrator.js'

describe('LiteLLM Gateway & Dynamic Model Hub Comprehensive Suite', () => {
  before(() => {
    modelRouter.initProviders()
  })

  // 1. LiteLLM & DeepSeek Provider Adapters
  describe('Provider Adapter Ecosystem (LiteLLM, DeepSeek & Multimodal)', () => {
    it('should register DeepSeek and LiteLLM providers correctly', () => {
      assert.ok(deepSeekProvider)
      assert.strictEqual(deepSeekProvider.name, 'deepseek')
      assert.strictEqual(getProvider('deepseek'), deepSeekProvider)

      assert.ok(litellmProvider)
      assert.strictEqual(litellmProvider.name, 'litellm')
      assert.strictEqual(getProvider('litellm'), litellmProvider)
    })

    it('should normalize DeepSeek error formats correctly', () => {
      const authErr = new Error('HTTP 401: Authentication Fails (Invalid DeepSeek API key)')
      const normAuth = deepSeekProvider.normalizeError(authErr)
      assert.strictEqual(normAuth.provider, 'deepseek')
      assert.strictEqual(normAuth.code, 'AUTH_ERROR')
      assert.strictEqual(normAuth.retryable, false)

      const quotaErr = new Error('HTTP 402: Insufficient balance')
      const normQuota = deepSeekProvider.normalizeError(quotaErr)
      assert.strictEqual(normQuota.provider, 'deepseek')
      assert.strictEqual(normQuota.code, 'QUOTA_EXCEEDED')
      assert.strictEqual(normQuota.retryable, false)

      const rateErr = new Error('HTTP 429: Rate limit reached')
      const normRate = deepSeekProvider.normalizeError(rateErr)
      assert.strictEqual(normRate.code, 'QUOTA_EXCEEDED')
      assert.strictEqual(normRate.retryable, true)
    })

    it('should register built-in DeepSeek & LiteLLM catalog models with capabilities', () => {
      const dsChat = modelRegistry.get('deepseek-chat')
      assert.ok(dsChat)
      assert.strictEqual(dsChat.provider, 'deepseek')
      assert.ok(dsChat.capabilities.includes('tool_calling'))
      assert.ok(dsChat.capabilities.includes('streaming'))

      const dsReasoner = modelRegistry.get('deepseek-reasoner')
      assert.ok(dsReasoner)
      assert.strictEqual(dsReasoner.provider, 'deepseek')
      assert.ok(dsReasoner.capabilities.includes('reasoning'))

      const litellmR1 = modelRegistry.get('litellm:deepseek-r1')
      assert.ok(litellmR1)
      assert.strictEqual(litellmR1.provider, 'litellm')
      assert.ok(litellmR1.capabilities.includes('reasoning'))

      const litellmSonar = modelRegistry.get('litellm:sonar-reasoning')
      assert.ok(litellmSonar)
      assert.strictEqual(litellmSonar.provider, 'litellm')
    })
  })

  // 2. Dynamic Model Registration, Updates & Persistence
  describe('Dynamic Model Hub Registry & Custom Models', () => {
    const customTestId = 'custom-llama3-local'

    it('should register a new custom model dynamically', () => {
      const customModel = modelRegistry.registerCustom({
        id: customTestId,
        provider: 'litellm',
        modelName: 'ollama/llama3:8b',
        displayName: 'Local Llama 3 8B (via LiteLLM)',
        description: 'Self-hosted LLaMA 3 running through LiteLLM unified gateway',
        capabilities: ['text_generation', 'streaming', 'multi_turn', 'tool_calling'],
        contextWindow: 8192,
        maxOutputTokens: 2048,
        costPerMillionTokens: 0,
        priority: 10,
        fallbackOrder: 1,
        enabled: true,
        parameters: {
          temperature: 0.5,
          maxTokens: 2048,
        },
      })

      assert.ok(customModel)
      assert.strictEqual(customModel.id, customTestId)
      assert.strictEqual(customModel.custom, true)
      assert.strictEqual(customModel.enabled, true)
      assert.strictEqual(customModel.parameters?.temperature, 0.5)

      const fetched = modelRegistry.get(customTestId)
      assert.ok(fetched)
      assert.strictEqual(fetched.displayName, 'Local Llama 3 8B (via LiteLLM)')
    })

    it('should update parameters and status of an existing model', () => {
      const updated = modelRegistry.update(customTestId, {
        enabled: false,
        priority: 99,
        parameters: {
          temperature: 0.8,
          maxTokens: 4096,
          topP: 0.95,
        },
      })

      assert.ok(updated)
      assert.strictEqual(updated.enabled, false)
      assert.strictEqual(updated.priority, 99)
      assert.strictEqual(updated.parameters?.temperature, 0.8)
      assert.strictEqual(updated.parameters?.maxTokens, 4096)
      assert.strictEqual(updated.parameters?.topP, 0.95)

      const enabledList = modelRegistry.getEnabled()
      assert.ok(!enabledList.some((m) => m.id === customTestId))
    })

    it('should delete custom model safely', () => {
      const deleted = modelRegistry.deleteCustom(customTestId)
      assert.strictEqual(deleted, true)
      assert.strictEqual(modelRegistry.get(customTestId), undefined)
    })

    it('should prevent deleting built-in models', () => {
      const deleted = modelRegistry.deleteCustom('gemini-2.5-flash')
      assert.strictEqual(deleted, false)
      assert.ok(modelRegistry.get('gemini-2.5-flash'))
    })
  })

  // 3. Fallback Chains & Priority Ordering
  describe('Intelligent Fallback Chains & Dynamic Priority Resolution', () => {
    it('should construct fallback chain with enabled models sorted by fallbackOrder and priority', () => {
      const fallbacks = modelRegistry.getFallbackChain('gemini-2.5-flash')
      assert.ok(Array.isArray(fallbacks))
      assert.ok(fallbacks.length > 0)
      assert.ok(!fallbacks.some((m) => m.id === 'gemini-2.5-flash'), 'Fallback chain must exclude primary model')
      assert.ok(fallbacks.every((m) => m.enabled !== false), 'All fallback models must be enabled')
    })

    it('should exclude disabled models from candidate selection and fallback chains', () => {
      // Temporarily disable a model
      modelRegistry.update('gpt-4o', { enabled: false })
      const enabledModels = modelRegistry.getEnabled()
      assert.ok(!enabledModels.some((m) => m.id === 'gpt-4o'))

      const fallbacks = modelRegistry.getFallbackChain('claude-3-5-sonnet')
      assert.ok(!fallbacks.some((m) => m.id === 'gpt-4o'))

      // Re-enable
      modelRegistry.update('gpt-4o', { enabled: true })
      assert.ok(modelRegistry.get('gpt-4o')?.enabled === true)
    })
  })

  // 4. Model Testing & Health Diagnostics
  describe('Safe Model Health Testing & Diagnostics', () => {
    it('should test model endpoint safely and return structured ModelTestResult', async () => {
      const result = await modelRouter.testModel('gemini-2.5-flash')
      assert.ok(result)
      assert.strictEqual(result.modelId, 'gemini-2.5-flash')
      assert.strictEqual(result.provider, 'gemini')
      assert.ok(['CONNECTED', 'DEGRADED', 'NOT_CONFIGURED', 'ERROR'].includes(result.status))
      assert.strictEqual(typeof result.latencyMs, 'number')
      assert.strictEqual(typeof result.testedAt, 'number')
    })

    it('should return error gracefully when testing non-existent model', async () => {
      const result = await modelRouter.testModel('non-existent-model-xyz')
      assert.strictEqual(result.status, 'ERROR')
      assert.ok(result.error?.includes('not found'))
    })
  })

  // 5. Budget Protection & Cost Guardrails
  describe('Budget Guardrails & Telemetry Controls', () => {
    it('should provide default budget configuration and update budget limits', () => {
      const initialBudget = modelRouter.getBudgetConfig()
      assert.ok(initialBudget)
      assert.strictEqual(typeof initialBudget.maxCostPerRequestUsd, 'number')
      assert.strictEqual(typeof initialBudget.monthlyLimitUsd, 'number')
      assert.strictEqual(typeof initialBudget.enforceStrictLimits, 'boolean')

      const updated = modelRouter.setBudgetConfig({
        maxCostPerRequestUsd: 0.15,
        monthlyLimitUsd: 50.0,
        enforceStrictLimits: true,
      })

      assert.strictEqual(updated.maxCostPerRequestUsd, 0.15)
      assert.strictEqual(updated.monthlyLimitUsd, 50.0)
      assert.strictEqual(updated.enforceStrictLimits, true)
    })

    it('should pass budget check when under limits', () => {
      const check = modelRouter.checkBudget(0.01)
      assert.strictEqual(check.allowed, true)
      assert.strictEqual(check.reason, undefined)
    })

    it('should reject requests exceeding single-request budget when enforced', () => {
      modelRouter.setBudgetConfig({
        maxCostPerRequestUsd: 0.05,
        enforceStrictLimits: true,
      })

      const check = modelRouter.checkBudget(0.10)
      assert.strictEqual(check.allowed, false)
      assert.ok(check.reason?.includes('exceeded'))

      // Reset enforcement for further tests
      modelRouter.setBudgetConfig({
        maxCostPerRequestUsd: 0.50,
        enforceStrictLimits: false,
      })
    })
  })

  // 6. Model Parameters & Routing Overrides in Orchestration
  describe('AI Orchestrator Execution with Model Overrides', () => {
    it('should select candidate models according to task classification and capability', () => {
      const codingCandidates = aiOrchestrator.getCandidateModels('CODING')
      assert.ok(codingCandidates.length > 0)
      assert.ok(codingCandidates.every((m) => m.capabilities.includes('tool_calling') || m.capabilities.includes('text_generation')))

      const reasoningCandidates = aiOrchestrator.getCandidateModels('REASONING')
      assert.ok(reasoningCandidates.length > 0)
      assert.ok(reasoningCandidates.some((m) => m.capabilities.includes('reasoning') || m.roles.includes('REASONING') || m.id.includes('reasoner') || m.id.includes('r1') || m.id.includes('sonnet') || m.id.includes('gpt-4o')))
    })
  })
})
